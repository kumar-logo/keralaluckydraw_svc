import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { CashrainWindow } from '../../../entities/cashrain-window.entity';
import { GameEngineService } from '../shared/game-engine.service';
import { ProfitGuardService } from '../shared/profit-guard.service';
import { OrderStatus } from '../../../common/enums/order-status.enum';
import { buildOrderNo } from '../../../common/order-no.generator';

const CASH_RAIN_JOIN = 'cash_rain_join';
const CASH_RAIN_REWARD_DESCRIPTION = 'Cash Rain reward';
const IST_OFFSET_MIN = 330;
const DEFAULT_CASH_RAIN_CAP = 10;

interface CashRainWinRow {
  u_nickname: string | null;
  u_avatar: string | null;
  o_win_amount: string;
  o_created_at: Date;
}

export interface CashRainUserRecord {
  nickName: string;
  time: Date;
  prize: number;
  avatar: string;
}

interface CashRainParsedResult {
  drawResult: string;
  nums: number[];
  sum: number;
  sizeType: 'big' | 'small';
  parityType: 'even' | 'odd';
}

@Injectable()
export class CashRainService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CashrainWindow)
    private windowRepo: Repository<CashrainWindow>,
    private gameEngine: GameEngineService,
    private profitGuard: ProfitGuardService,
  ) {}

  private istMinuteNow(): number {
    return (Math.floor(Date.now() / 60000) + IST_OFFSET_MIN) % 1440;
  }

  private istDayOfMonth(): number {
    return new Date(Date.now() + IST_OFFSET_MIN * 60000).getUTCDate();
  }

  private windowContains(
    istNow: number,
    startMinute: number,
    endMinute: number,
  ): boolean {
    return startMinute <= endMinute
      ? istNow >= startMinute && istNow <= endMinute
      : istNow >= startMinute || istNow <= endMinute;
  }

  private dayMatches(day: number, dayStart: number, dayEnd: number): boolean {
    return dayStart <= dayEnd
      ? day >= dayStart && day <= dayEnd
      : day >= dayStart || day <= dayEnd;
  }

  private async getActiveWindows(gameId: number): Promise<CashrainWindow[]> {
    return this.windowRepo.find({ where: { gameId, status: 1 } });
  }

  private todaysWindows(windows: CashrainWindow[]): CashrainWindow[] {
    const day = this.istDayOfMonth();
    return windows.filter((w) => this.dayMatches(day, w.dayStart, w.dayEnd));
  }

  private isWithinWindowList(windows: CashrainWindow[]): boolean {
    return this.activeWindowFrom(windows) !== null;
  }

  private activeWindowFrom(windows: CashrainWindow[]): CashrainWindow | null {
    const today = this.todaysWindows(windows);
    if (today.length === 0) return null;
    const istNow = this.istMinuteNow();
    const active = today.find((w) =>
      this.windowContains(istNow, w.startMinute, w.endMinute),
    );
    return active ?? null;
  }

  private async getActiveWindow(gameId: number): Promise<CashrainWindow | null> {
    return this.activeWindowFrom(await this.getActiveWindows(gameId));
  }

  private async isWithinWindow(gameId: number): Promise<boolean> {
    return (await this.getActiveWindow(gameId)) !== null;
  }

  private windowIstRange(window: CashrainWindow): {
    startUtcMs: number;
    endUtcMs: number;
  } {
    const istNowMs = Date.now() + IST_OFFSET_MIN * 60000;
    const istMidnightMs =
      Math.floor(istNowMs / (1440 * 60000)) * (1440 * 60000);
    const crossesMidnight = window.startMinute > window.endMinute;
    const istNowMinute = this.istMinuteNow();
    const startDayOffset =
      crossesMidnight && istNowMinute <= window.endMinute ? -1 : 0;
    const startIstMs =
      istMidnightMs +
      (startDayOffset * 1440 + window.startMinute) * 60000;
    const endDayOffset =
      crossesMidnight && istNowMinute >= window.startMinute ? 1 : 0;
    const endIstMs =
      istMidnightMs + (endDayOffset * 1440 + window.endMinute) * 60000 + 59999;
    return {
      startUtcMs: startIstMs - IST_OFFSET_MIN * 60000,
      endUtcMs: endIstMs - IST_OFFSET_MIN * 60000,
    };
  }

  private async countClaimsInWindow(
    userId: string,
    gameId: number,
    window: CashrainWindow,
  ): Promise<number> {
    // Count every claim attempt (Pending awaiting `over`, plus settled Won)
    // inside the active window. Pending is included so repeated `start` calls
    // across the per-minute rounds cannot stockpile claims before redeeming.
    const { startUtcMs, endUtcMs } = this.windowIstRange(window);
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.game_id = :gameId', { gameId })
      .andWhere('o.bet_type = :betType', { betType: CASH_RAIN_JOIN })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.Pending, OrderStatus.Won],
      })
      .andWhere('o.created_at >= :start', { start: new Date(startUtcMs) })
      .andWhere('o.created_at <= :end', { end: new Date(endUtcMs) })
      .getCount();
  }

  private formatIstMinute(minute: number): string {
    const m = ((Math.trunc(minute) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
  }

  private buildWindowLabels(windows: CashrainWindow[]): {
    current: string;
    next: string;
  } {
    const today = this.todaysWindows(windows);
    if (today.length === 0) return { current: '', next: '' };
    const istNow = this.istMinuteNow();
    const sorted = [...today].sort((a, b) => a.startMinute - b.startMinute);
    const active = sorted.find((w) =>
      this.windowContains(istNow, w.startMinute, w.endMinute),
    );
    const nextWindow = sorted.find((w) => w.startMinute > istNow);
    const upcoming = nextWindow !== undefined ? nextWindow : sorted[0];
    const range = (w: CashrainWindow) =>
      `${this.formatIstMinute(w.startMinute)}-${this.formatIstMinute(w.endMinute)}`;
    return {
      current: active ? range(active) : range(upcoming),
      next: range(upcoming),
    };
  }

  async getInfo(userId?: string) {
    const game = await this.gameListRepo.findOne({
      where: { gameType: 'cash_rain', status: 1 },
    });

    if (!game) {
      return {
        isActivity: false,
        lessSec: 0,
        gameID: 0,
        roundNo: 0,
        alreadyPlay: false,
        alreadyRecharge: false,
        roundDate: '',
        nextRoundDate: '',
        otherRecord: [],
        userRecord: [],
      };
    }
    this.gameEngine.assertPlayable(game);

    const currentRound = await this.roundRepo.findOne({
      where: { gameId: game.id, status: 0 },
      order: { createdAt: 'DESC' },
    });

    const liveRound = await this.roundRepo.findOne({
      where: { gameId: game.id, status: 1 },
      order: { createdAt: 'DESC' },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const computeLessSec = (round: GameRound | null): number => {
      if (!round?.drawTime) return 0;
      const drawTimeSec = Math.floor(new Date(round.drawTime).getTime() / 1000);
      return Math.max(0, drawTimeSec - nowSec);
    };

    const windows = await this.getActiveWindows(game.id);
    const withinWindow = this.isWithinWindowList(windows);
    const windowLabels = this.buildWindowLabels(windows);

    // Fail-closed: only mint a round while a window is active. Outside every
    // window, Cash Rain must never create rounds (a round is the prerequisite
    // for a free claim), so polling cannot manufacture an endless supply.
    let activeRound = liveRound ?? currentRound;
    const roundExpired =
      !activeRound || (!liveRound && computeLessSec(activeRound) <= 0);
    if (roundExpired && withinWindow) {
      activeRound = await this.createRound(game);
    } else if (roundExpired) {
      activeRound = null;
    }

    const lessSec = computeLessSec(activeRound);
    const isActivity =
      withinWindow && !!activeRound && activeRound.status !== 2 && lessSec > 0;

    let alreadyPlay = false;
    let alreadyRecharge = false;
    const userRecord: CashRainUserRecord[] = [];

    if (userId && activeRound) {
      const userOrders = await this.orderRepo.find({
        where: { userId, gameId: game.id, roundNo: activeRound.roundNo },
        order: { createdAt: 'DESC' },
      });
      alreadyPlay = userOrders.length > 0;

      const user = await this.userRepo.findOne({ where: { userId } });
      if (user) {
        alreadyRecharge = await this.hasRechargedToday(userId);

        const settledUserOrders = await this.orderRepo.find({
          where: { userId, gameId: game.id },
          order: { createdAt: 'DESC' },
          take: 20,
        });
        for (const o of settledUserOrders) {
          if (Number(o.winAmount) > 0) {
            userRecord.push({
              nickName: user.nickname ?? '',
              time: o.createdAt,
              prize: Number(o.winAmount),
              avatar: user.avatar,
            });
          }
        }
      }
    }

    const recentWins = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect(User, 'u', 'u.user_id = o.user_id')
      .where('o.game_id = :gameId', { gameId: game.id })
      .andWhere('o.win_amount > 0')
      .andWhere('o.status IN (:...statuses)', { statuses: [1, 2] })
      .orderBy('o.created_at', 'DESC')
      .take(20)
      .getRawMany<CashRainWinRow>();

    const otherRecord = recentWins.map((r) => ({
      nickName: r.u_nickname ?? '',
      time: r.o_created_at,
      prize: Number(r.o_win_amount),
      avatar: r.u_avatar ?? '',
    }));

    const roundDate =
      windows.length > 0
        ? windowLabels.current
        : activeRound?.drawTime
          ? this.formatRoundDate(activeRound.drawTime)
          : '';
    const nextDrawTime = activeRound?.drawTime
      ? new Date(
          new Date(activeRound.drawTime).getTime() + game.drawInterval * 1000,
        )
      : null;
    const nextRoundDate =
      windows.length > 0
        ? windowLabels.next
        : nextDrawTime
          ? this.formatRoundDate(nextDrawTime)
          : '';

    const startTimestamp = activeRound?.drawTime
      ? Math.floor(new Date(activeRound.drawTime).getTime() / 1000) -
        game.drawInterval
      : 0;
    const stopTimestamp = activeRound?.drawTime
      ? Math.floor(new Date(activeRound.drawTime).getTime() / 1000)
      : 0;
    const nextStartTimestamp = nextDrawTime
      ? Math.floor(nextDrawTime.getTime() / 1000) - game.drawInterval
      : 0;
    const nextStopTimestamp = nextDrawTime
      ? Math.floor(nextDrawTime.getTime() / 1000)
      : 0;

    const nextRoundNo = activeRound?.roundNo
      ? this.incrementRoundNo(activeRound.roundNo)
      : '';

    return {
      alreadyPlay,
      alreadyRecharge,
      gameID: game.id,
      image: game.iconUrl ?? '',
      isActivity,
      lessSec,
      nextRoundDate,
      nextRoundNo,
      nextStartTimestamp,
      nextStopTimestamp,
      otherRecord,
      roundDate,
      roundNo: activeRound?.roundNo ?? '',
      startTimestamp,
      stopTimestamp,
      userRecord,
    };
  }

  private formatRoundDate(date: Date | string): string {
    const d = new Date(date);
    const startH = d.getHours();
    const startM = d.getMinutes();
    const endH = startH;
    const endM = 59;
    const fmt = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    return `${fmt(startH, startM)}-${fmt(endH, endM)}`;
  }

  private incrementRoundNo(roundNo: string): string {
    const prefix = roundNo.slice(0, -3);
    const seq = parseInt(roundNo.slice(-3), 10);
    return prefix + String(seq + 1).padStart(3, '0');
  }

  async start(dto: { userId: string; gameId: number; roundNo: string }) {
    if (!dto.userId) throw new BadRequestException('Authentication required');

    const round = await this.roundRepo.findOne({
      where: { gameId: dto.gameId, roundNo: dto.roundNo },
    });
    if (!round) throw new BadRequestException('Round not found');
    if (round.status === 2) {
      throw new BadRequestException('Round already ended');
    }

    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameId, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    const activeWindow = await this.getActiveWindow(game.id);
    if (!activeWindow) {
      throw new BadRequestException('Cash Rain is not active right now');
    }

    if (!(await this.hasRechargedToday(dto.userId))) {
      throw new BadRequestException('Recharge today to claim Cash Rain');
    }

    const existing = await this.findParticipation(
      dto.userId,
      dto.gameId,
      dto.roundNo,
    );
    if (existing) {
      throw new BadRequestException('Already joined this round');
    }

    const maxClaims = Math.max(0, Math.trunc(activeWindow.maxClaimsPerUser));
    const claimsThisWindow = await this.countClaimsInWindow(
      dto.userId,
      dto.gameId,
      activeWindow,
    );
    if (claimsThisWindow >= maxClaims) {
      throw new BadRequestException(
        'You have reached the Cash Rain claim limit for this window',
      );
    }

    const prize = this.drawReward(game);

    await this.orderRepo.save(
      this.orderRepo.create({
        orderNo: buildOrderNo('CR'),
        userId: dto.userId,
        gameId: dto.gameId,
        gameType: round.gameType,
        roundNo: dto.roundNo,
        betType: CASH_RAIN_JOIN,
        betContent: {},
        amount: 0,
        quantity: 1,
        totalAmount: 0,
        odds: 1,
        winAmount: prize,
        isBonus: 0,
        status: 0,
      }),
    );

    return this.buildRewardJars(prize);
  }

  private buildRewardJars(
    prize: number,
  ): { notMe: boolean; amount: number; avatar?: string }[] {
    const jars: { notMe: boolean; amount: number; avatar?: string }[] = [];
    for (const amount of this.splitIntoJars(prize)) {
      jars.push({ notMe: false, amount });
    }
    for (let i = 0; i < 6; i++) {
      jars.push({
        notMe: true,
        amount: 1 + Math.floor(Math.random() * 50),
        avatar: '/images/common/default-avatar.webp',
      });
    }
    for (let i = jars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [jars[i], jars[j]] = [jars[j], jars[i]];
    }
    return jars;
  }

  private splitIntoJars(total: number): number[] {
    if (total <= 0) return [0];
    const n = Math.min(total, 3 + Math.floor(Math.random() * 3));
    const parts: number[] = [];
    let remaining = total;
    for (let i = 0; i < n - 1; i++) {
      const maxForThis = remaining - (n - 1 - i);
      const capped = Math.min(
        1 + Math.floor(Math.random() * Math.max(1, maxForThis)),
        maxForThis,
      );
      parts.push(capped);
      remaining -= capped;
    }
    parts.push(remaining);
    return parts;
  }

  async over(dto: { userId: string; gameId: number; roundNo: string }) {
    if (!dto.userId) throw new BadRequestException('Authentication required');

    const round = await this.roundRepo.findOne({
      where: { gameId: dto.gameId, roundNo: dto.roundNo },
    });
    if (!round) throw new BadRequestException('Round not found');

    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameId, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');

    if (!(await this.isWithinWindow(game.id))) {
      throw new BadRequestException('Cash Rain is not active right now');
    }

    const intervalSec = game.drawInterval > 0 ? game.drawInterval : 60;
    const drawTimeSec = round.drawTime
      ? Math.floor(new Date(round.drawTime).getTime() / 1000)
      : 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (drawTimeSec && nowSec > drawTimeSec + intervalSec) {
      throw new BadRequestException('Round expired');
    }

    const participation = await this.findParticipation(
      dto.userId,
      dto.gameId,
      dto.roundNo,
    );
    if (!participation) {
      throw new BadRequestException('Round not joined');
    }
    if (participation.status !== OrderStatus.Pending) {
      throw new BadRequestException('Round already finished');
    }

    const intendedPrize = Number(participation.winAmount);
    const parsedMaxPrize = Number(game.maxPrize);
    const maxPrize = Number.isFinite(parsedMaxPrize) ? parsedMaxPrize : 0;
    const granted =
      maxPrize > 0
        ? Math.max(0, Math.min(intendedPrize, maxPrize))
        : Math.max(0, intendedPrize);

    const claim = await this.orderRepo.update(
      { id: participation.id, status: OrderStatus.Pending },
      {
        status: granted > 0 ? OrderStatus.Won : OrderStatus.Lost,
        winAmount: granted,
        settledAt: new Date(),
      },
    );
    if (claim.affected === 0) {
      throw new BadRequestException('Round already finished');
    }

    if (granted > 0) {
      await this.gameEngine.creditBalance(
        dto.userId,
        granted,
        participation.orderNo,
        CASH_RAIN_REWARD_DESCRIPTION,
        undefined,
        participation.isBonus === 1,
        { sourceType: 'cashrain' },
      );
    }

    return {
      gameId: dto.gameId,
      roundNo: dto.roundNo,
      status: 'completed',
      prize: granted,
      settledAt: new Date(),
    };
  }

  private istDateString(): string {
    return new Date(Date.now() + IST_OFFSET_MIN * 60000)
      .toISOString()
      .slice(0, 10);
  }

  private async hasRechargedToday(userId: string): Promise<boolean> {
    const todayStart = `${this.istDateString()} 00:00:00`;
    const row = await this.orderRepo.manager.connection
      .createQueryBuilder()
      .select('COALESCE(COUNT(*), 0)', 'cnt')
      .from('recharge_records', 'r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.status = :status', { status: 1 })
      .andWhere('r.approved_at >= :todayStart', { todayStart })
      .getRawOne<{ cnt: string }>();
    return row ? Number(row.cnt) > 0 : false;
  }

  private drawReward(game: GameList): number {
    const maxPrize = Number(game.maxPrize);
    const sellingPrice = Number(game.sellingPrice);
    const capSource =
      Number.isFinite(maxPrize) && maxPrize > 0
        ? maxPrize
        : Number.isFinite(sellingPrice) && sellingPrice > 0
          ? sellingPrice
          : DEFAULT_CASH_RAIN_CAP;
    const cap = Math.max(1, Math.floor(capSource));
    return 1 + Math.floor(Math.random() * cap);
  }

  private async createRound(game: GameList): Promise<GameRound> {
    const intervalSec = game.drawInterval > 0 ? game.drawInterval : 60;
    const drawTime = new Date(Date.now() + intervalSec * 1000);
    return this.roundRepo.save(
      this.roundRepo.create({
        gameId: game.id,
        gameType: game.gameType,
        roundNo: `CR${Date.now()}`,
        status: 0,
        drawTime,
      }),
    );
  }

  private async findParticipation(
    userId: string,
    gameId: number,
    roundNo: string,
  ): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { userId, gameId, roundNo, betType: CASH_RAIN_JOIN },
    });
  }

  private cosmeticDrawResult(): string {
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join(
      ',',
    );
  }

  private parseDrawResult(
    drawResult: string,
    bigSmallThreshold = 23,
  ): CashRainParsedResult {
    const nums = drawResult.split(',').map(Number);
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      drawResult,
      nums,
      sum,
      sizeType: sum >= bigSmallThreshold ? 'big' : 'small',
      parityType: sum % 2 === 0 ? 'even' : 'odd',
    };
  }
}
