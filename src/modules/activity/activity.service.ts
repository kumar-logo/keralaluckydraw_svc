import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinRecord } from '../../entities/checkin-record.entity';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { CheckinConfig } from '../../entities/checkin-config.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(CheckinRecord)
    private checkinRepo: Repository<CheckinRecord>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(CheckinConfig)
    private checkinConfigRepo: Repository<CheckinConfig>,
  ) {}

  private async loadCheckinRewards(): Promise<
    { dayNum: number; awardNum: number; awardType: string }[]
  > {
    const rows = await this.checkinConfigRepo.find({
      order: { dayNum: 'ASC' },
    });
    if (rows.length > 0) {
      return rows.map((c) => ({
        dayNum: c.dayNum,
        awardNum: Number(c.awardNum),
        awardType: c.awardType,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => ({
      dayNum: i + 1,
      awardNum: 1,
      awardType: 'chip',
    }));
  }

  async getCheckinInfo(userId: string) {
    const todayKey = this.formatTimeKey(new Date());
    const streak = await this.resolveStreak(userId);
    const rewardConfig = await this.loadCheckinRewards();

    const items = rewardConfig.map((item) => {
      let status = 0;
      if (item.dayNum <= streak.claimedDays) {
        status = 3;
      } else if (item.dayNum === streak.claimableDay) {
        status = 2;
      }

      return {
        actKey: '',
        awardNum: item.awardNum,
        awardType: item.awardType,
        dayNum: item.dayNum,
        status,
        timeKey: todayKey,
      };
    });

    return {
      actID: 1,
      dayList: items,
    };
  }

  private istDateString(): string {
    const IST_OFFSET_MIN = 330;
    return new Date(Date.now() + IST_OFFSET_MIN * 60000)
      .toISOString()
      .slice(0, 10);
  }

  private async hasRechargedToday(userId: string): Promise<boolean> {
    const todayStart = `${this.istDateString()} 00:00:00`;
    const row = await this.userRepo.manager.connection
      .createQueryBuilder()
      .select('COALESCE(COUNT(*), 0)', 'cnt')
      .from('recharge_records', 'r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.status = :status', { status: 1 })
      .andWhere('r.approved_at >= :todayStart', { todayStart })
      .getRawOne<{ cnt: string }>();
    return row ? Number(row.cnt) > 0 : false;
  }

  async claimCheckinAward(
    userId: string,
    dto: { actID: number; actKey: string; timeKey: string },
  ) {
    if (!(await this.hasRechargedToday(userId))) {
      throw new BadRequestException(
        'Recharge today to claim the daily check-in reward',
      );
    }

    const now = new Date();
    const timeKey = this.formatTimeKey(now);

    const streak = await this.resolveStreak(userId);
    if (streak.claimableDay === 0) {
      throw new BadRequestException('Already checked in today');
    }
    const claimDay = streak.claimableDay;

    const existing = await this.checkinRepo.findOne({
      where: { userId, dayNum: claimDay, timeKey },
    });

    if (existing) {
      throw new BadRequestException('Already checked in today');
    }

    const rewards = await this.loadCheckinRewards();
    const dayReward = rewards.find((r) => r.dayNum === claimDay);
    const rewardAmount = dayReward ? dayReward.awardNum : 1;
    const awardType = dayReward ? dayReward.awardType : 'chip';

    const actKey = `checkin_day${claimDay}_${Date.now()}`;

    const record = this.checkinRepo.create({
      userId,
      dayNum: claimDay,
      timeKey,
      actKey,
      awardNum: rewardAmount,
    });
    await this.checkinRepo.save(record);

    const useMainBalance = awardType === 'chip' || awardType === 'balance';
    const balanceColumn = useMainBalance ? 'balance' : 'bonus_balance';
    const balanceField = useMainBalance ? 'balance' : 'bonusBalance';
    await this.userRepo.update(
      { userId },
      { [balanceField]: () => `${balanceColumn} + ${rewardAmount}` },
    );

    const user = await this.userRepo.findOne({ where: { userId } });
    await this.txnRepo.save(
      this.txnRepo.create({
        userId,
        sourceType: 'bonus',
        amount: rewardAmount,
        balance: Number(user?.balance || 0),
        refId: actKey,
        description: `Check-in day ${claimDay} reward`,
      }),
    );

    return {
      awardNum: rewardAmount,
      awardType,
      dayNum: claimDay,
    };
  }

  async getActivityList() {
    const config = await this.configRepo.findOne({
      where: { configKey: 'activity_list' },
    });

    if (config?.configVal) {
      try {
        return JSON.parse(config.configVal);
      } catch {
        return [];
      }
    }

    return [];
  }

  async getDoneStatus(userId: string, activityID: number) {
    const doneConfig = await this.configRepo.findOne({
      where: { configKey: `activity_done_${userId}_${activityID}` },
    });

    return {
      activityID,
      done: doneConfig ? 1 : 0,
      status: doneConfig ? 1 : 0,
    };
  }

  private async resolveStreak(
    userId: string,
  ): Promise<{ claimedDays: number; claimableDay: number }> {
    const records = await this.checkinRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    if (records.length === 0) {
      return { claimedDays: 0, claimableDay: 1 };
    }

    const dayKeys = Array.from(
      new Set(records.map((r) => this.formatTimeKey(new Date(r.createdAt)))),
    ).sort();

    let streakLen = 1;
    for (let i = dayKeys.length - 1; i > 0; i--) {
      if (this.isPreviousDay(dayKeys[i - 1], dayKeys[i])) {
        streakLen += 1;
      } else {
        break;
      }
    }

    const lastKey = dayKeys[dayKeys.length - 1];
    const todayKey = this.formatTimeKey(new Date());

    if (lastKey === todayKey) {
      const cyclePos = ((streakLen - 1) % 7) + 1;
      return { claimedDays: cyclePos, claimableDay: 0 };
    }

    if (this.isPreviousDay(lastKey, todayKey)) {
      const cyclePos = ((streakLen - 1) % 7) + 1;
      if (cyclePos === 7) {
        return { claimedDays: 0, claimableDay: 1 };
      }
      return { claimedDays: cyclePos, claimableDay: cyclePos + 1 };
    }

    return { claimedDays: 0, claimableDay: 1 };
  }

  private isPreviousDay(earlierKey: string, laterKey: string): boolean {
    const earlier = new Date(`${earlierKey}T00:00:00`);
    const later = new Date(`${laterKey}T00:00:00`);
    const diff = Math.round(
      (later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000),
    );
    return diff === 1;
  }

  private formatTimeKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
