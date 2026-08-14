import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { RankConfig } from '../../entities/rank-config.entity';
import { RankConfigPrize } from '../../entities/rank-config-prize.entity';
import { RankRecord } from '../../entities/rank-record.entity';
import { RankPeriod, RankType } from './rank.enums';
import { RankAwardDto, RankInfoDto } from './dto/rank.dto';

interface RankAggRow {
  userId: string;
  total: string;
}

interface MyRankAggRow {
  total: string | null;
}

@Injectable()
export class RankService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(RankConfig)
    private rankConfigRepo: Repository<RankConfig>,
    @InjectRepository(RankConfigPrize)
    private rankPrizeRepo: Repository<RankConfigPrize>,
    @InjectRepository(RankRecord)
    private rankRecordRepo: Repository<RankRecord>,
    private dataSource: DataSource,
  ) {}

  async getInfo(userId: string, dto: RankInfoDto) {
    const rankType = dto.rankType;
    const period = dto.period;
    const pageNo = dto.pageNo;
    const pageSize = dto.pageSize;

    const { startDate, endDate } = this.getPeriodRange(period);

    const sourceTypes = rankType === RankType.Wins ? ['win'] : ['bet'];

    const qb = this.txnRepo
      .createQueryBuilder('t')
      .select('t.user_id', 'userId')
      .addSelect('ABS(SUM(t.amount))', 'total')
      .where('t.source_type IN (:...types)', { types: sourceTypes })
      .andWhere('t.created_at >= :start', { start: startDate })
      .andWhere('t.created_at <= :end', { end: endDate })
      .groupBy('t.user_id')
      .orderBy('total', 'DESC')
      .offset((pageNo - 1) * pageSize)
      .limit(pageSize);

    const rawResults = await qb.getRawMany<RankAggRow>();

    const userIds = rawResults.map((r) => r.userId);
    const userMap: Record<string, User> = {};

    if (userIds.length > 0) {
      const users = await this.userRepo
        .createQueryBuilder('u')
        .where('u.user_id IN (:...ids)', { ids: userIds })
        .getMany();

      for (const u of users) {
        userMap[u.userId] = u;
      }
    }

    const list = rawResults.map((r, index) => {
      const user = userMap[r.userId];
      const nickname = user && user.nickname ? user.nickname : '***';
      const avatar = user && user.avatar ? user.avatar : '';
      const phone =
        user && user.phone
          ? user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
          : '';
      return {
        rank: (pageNo - 1) * pageSize + index + 1,
        userId: r.userId,
        nickname,
        avatar,
        phone,
        total: Number(r.total),
      };
    });

    const myRankQb = this.txnRepo
      .createQueryBuilder('t')
      .select('ABS(SUM(t.amount))', 'total')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type IN (:...types)', { types: sourceTypes })
      .andWhere('t.created_at >= :start', { start: startDate })
      .andWhere('t.created_at <= :end', { end: endDate });

    const myResult = await myRankQb.getRawOne<MyRankAggRow>();

    return {
      rankType,
      period,
      list,
      myRank: {
        userId,
        total: myResult ? Number(myResult.total) : 0,
      },
    };
  }

  async claimAward(userId: string, dto: RankAwardDto) {
    const rankType = dto.rankType;
    const period = dto.period;

    const info = await this.getInfo(userId, {
      rankType,
      period,
      pageNo: 1,
      pageSize: 10,
    });
    const myEntry = info.list.find((e) => e.userId === userId);

    if (!myEntry || myEntry.rank > 10) {
      throw new BadRequestException('Not eligible for rank reward');
    }

    const config = await this.getRankConfig(rankType, period);
    if (!config) {
      throw new BadRequestException('Not eligible for rank reward');
    }

    const prize = await this.rankPrizeRepo.findOne({
      where: { rankConfigId: config.id, rankPosition: myEntry.rank },
    });
    const rewardAmount = prize ? Number(prize.prizeAmount) : 0;
    if (rewardAmount <= 0) {
      throw new BadRequestException('Not eligible for rank reward');
    }

    const roundNo = this.getRoundNo(period);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.query(
        `INSERT IGNORE INTO rank_records
           (rank_id, round_no, user_id, score, rank_pos, prize, is_claimed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          config.rankId,
          roundNo,
          userId,
          myEntry.total,
          myEntry.rank,
          rewardAmount,
        ],
      );

      const claimResult = await queryRunner.manager
        .getRepository(RankRecord)
        .createQueryBuilder()
        .update(RankRecord)
        .set({ isClaimed: 1, prize: rewardAmount, rankPos: myEntry.rank })
        .where(
          'user_id = :userId AND rank_id = :rankId AND round_no = :roundNo AND is_claimed = 0',
          { userId, rankId: config.rankId, roundNo },
        )
        .execute();

      if (claimResult.affected !== 1) {
        throw new BadRequestException('Already claimed');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${rewardAmount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();

      const updatedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });

      if (!updatedUser) {
        throw new BadRequestException('User not found');
      }
      const newBalance = Number(updatedUser.balance);

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId,
          sourceType: 'bonus',
          amount: rewardAmount,
          balance: newBalance,
          refId: `RANK_${config.rankId}_${roundNo}`,
          description: `Rank #${myEntry.rank} reward`,
        }),
      );

      await queryRunner.commitTransaction();

      return {
        rank: myEntry.rank,
        rewardAmount,
        balance: newBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getPeriodRange(period: RankPeriod): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );
    let startDate: Date;

    switch (period) {
      case RankPeriod.Yesterday: {
        const yd = new Date(now);
        yd.setDate(yd.getDate() - 1);
        startDate = new Date(
          yd.getFullYear(),
          yd.getMonth(),
          yd.getDate(),
          0,
          0,
          0,
        );
        break;
      }
      case RankPeriod.Week: {
        const wd = new Date(now);
        wd.setDate(wd.getDate() - wd.getDay());
        startDate = new Date(
          wd.getFullYear(),
          wd.getMonth(),
          wd.getDate(),
          0,
          0,
          0,
        );
        break;
      }
      case RankPeriod.Month:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case RankPeriod.Today:
      default:
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
        );
        break;
    }

    return { startDate, endDate };
  }

  private async getRankConfig(
    rankType: RankType,
    period: RankPeriod,
  ): Promise<RankConfig | null> {
    const typeMap: Record<RankType, string> = {
      [RankType.Betting]: 'bet_amount',
      [RankType.Wins]: 'win_amount',
    };
    const periodMap: Record<RankPeriod, string> = {
      [RankPeriod.Today]: 'daily',
      [RankPeriod.Yesterday]: 'daily',
      [RankPeriod.Week]: 'weekly',
      [RankPeriod.Month]: 'monthly',
    };
    return this.rankConfigRepo.findOne({
      where: {
        rankType: typeMap[rankType],
        period: periodMap[period],
        status: 1,
      },
    });
  }

  private getRoundNo(period: RankPeriod): string {
    const { startDate } = this.getPeriodRange(period);
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const d = String(startDate.getDate()).padStart(2, '0');
    return `${period}_${y}-${m}-${d}`;
  }
}
