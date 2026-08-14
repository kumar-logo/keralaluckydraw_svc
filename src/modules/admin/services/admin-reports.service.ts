import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Order } from '../../../entities/order.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../../entities/withdrawal-record.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { RechargeStatus } from '../../../common/enums/recharge-status.enum';
import { WithdrawStatus } from '../../../common/enums/withdraw-status.enum';
import { OrderStatus } from '../../../common/enums/order-status.enum';

const APP_TIME_ZONE = 'Asia/Kolkata';

const SETTLED_ORDER_STATUSES = [
  OrderStatus.Won,
  OrderStatus.Lost,
  OrderStatus.Settled,
] as const;

interface SumTotalRow {
  total: string;
}

interface ProfitRow {
  bets: string;
  payouts: string;
}

interface TodayStatsRow {
  count: string;
  totalBet: string;
  totalPayout: string;
}

interface NameValueRow {
  name: string;
  value: string;
}

interface RevenuePointRow {
  date: string;
  bets: string;
  payouts: string;
}

interface UserGrowthRow {
  date: string;
  users: string;
}

interface CountRow {
  count: string;
}

interface RevenueGameRow {
  gameType: string;
  gameId: string;
  totalBet: string;
  totalPayout: string;
  orderCount: string;
}

interface RoundCountRow {
  gameType: string;
  roundCount: string;
}

interface DailyRevenueRow {
  date: string;
  totalBet: string;
  totalPayout: string;
}

interface DateCountRow {
  date: string;
  count: string;
}

interface TopUserRow {
  userId: string;
  totalRecharge?: string;
  totalWin?: string;
}

interface UserBetRow {
  userId: string;
  totalBet: string;
}

interface GameReportRow {
  gameId: string;
  gameName: string;
  gameType: string;
  totalRounds: string;
  totalBets: string;
  totalPayouts: string;
  highPayoutRounds: string;
}

interface GameOrderCountRow {
  gameId: string;
  totalOrders: string;
}

interface LotteryTypeRow {
  gameType: string;
  totalSold: string;
  totalPrize: string;
  ticketCount: string;
  playerCount: string;
}

interface PaymentStatusRow {
  status: number | string;
  count: string;
  total: string;
}

interface OverallDailyRow {
  date: string;
  totalBet: string;
  totalPayout: string;
  activePlayers: string;
  orderCount: string;
}

interface DateTotalRow {
  date: string;
  total: string;
}

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
  ) {}

  async getDashboard(range?: { startDate?: string; endDate?: string }) {
    const { start, end, startDate, endDate } = this.resolveRange(range);
    const istToday = this.istDate();
    const todayStart = `${istToday} 00:00:00`;
    const monthStart = `${istToday.slice(0, 7)}-01 00:00:00`;
    const now = this.istNow();

    const [
      todayRecharge,
      todayWithdraw,
      todayProfit,
      todayReferralCommission,
      todayWinBonus,
      monthRecharge,
      monthWithdraw,
      monthProfit,
      monthReferralCommission,
      monthWinBonus,
      totalUsers,
      todayJoinUsers,
      gameDistribution,
      revenueChart,
      userGrowth,
    ] = await Promise.all([
      this.sumRechargeTotal(todayStart, now),
      this.sumWithdraw(todayStart, now),
      this.sumProfit(todayStart, now),
      this.sumReferralCommission(todayStart, now),
      this.sumWinBonus(todayStart, now),
      this.sumRechargeTotal(monthStart, now),
      this.sumWithdraw(monthStart, now),
      this.sumProfit(monthStart, now),
      this.sumReferralCommission(monthStart, now),
      this.sumWinBonus(monthStart, now),
      this.userRepo.count(),
      this.userRepo
        .createQueryBuilder('u')
        .where('u.created_at >= :start AND u.created_at <= :end', {
          start: todayStart,
          end: now,
        })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('g.game_name', 'name')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'value')
        .innerJoin(GameList, 'g', 'g.id = o.game_id')
        .where('o.created_at >= :start AND o.created_at <= :end', { start, end })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [...SETTLED_ORDER_STATUSES],
        })
        .groupBy('g.game_name')
        .orderBy('value', 'DESC')
        .limit(10)
        .getRawMany<NameValueRow>()
        .catch((): NameValueRow[] => []),
      this.orderRepo
        .createQueryBuilder('o')
        .select('DATE(o.created_at)', 'date')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'bets')
        .addSelect('COALESCE(SUM(o.win_amount), 0)', 'payouts')
        .where('o.created_at >= :start AND o.created_at <= :end', { start, end })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [...SETTLED_ORDER_STATUSES],
        })
        .groupBy('DATE(o.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany<RevenuePointRow>()
        .catch((): RevenuePointRow[] => []),
      this.userRepo
        .createQueryBuilder('u')
        .select('DATE(u.created_at)', 'date')
        .addSelect('COUNT(*)', 'users')
        .where('u.created_at >= :start AND u.created_at <= :end', { start, end })
        .groupBy('DATE(u.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany<UserGrowthRow>()
        .catch((): UserGrowthRow[] => []),
    ]);

    return {
      startDate,
      endDate,
      todayRecharge,
      todayWithdraw,
      todayProfit,
      todayReferralCommission,
      todayWinBonus,
      monthRecharge,
      monthWithdraw,
      monthProfit,
      monthReferralCommission,
      monthWinBonus,
      totalUsers,
      todayJoinUsers,
      gameDistribution: gameDistribution.map((g) => ({
        name: g.name,
        value: Number(g.value),
      })),
      revenueChart: revenueChart.map((r) => ({
        date: r.date,
        bets: Number(r.bets),
        payouts: Number(r.payouts),
        revenue: Number((Number(r.bets) - Number(r.payouts)).toFixed(2)),
      })),
      userGrowth: userGrowth.map((r) => ({
        date: r.date,
        users: Number(r.users),
      })),
    };
  }

  private async sumRecharge(start: string, end: string): Promise<number> {
    const row = await this.rcRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount), 0)', 'total')
      .where('r.status = :status', { status: RechargeStatus.Approved })
      .andWhere('r.created_at >= :start AND r.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<SumTotalRow>();
    return row ? Number(row.total) : 0;
  }

  private async sumManualCredit(start: string, end: string): Promise<number> {
    const row = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.source_type = :ty', { ty: 'adjustment' })
      .andWhere('t.created_at >= :start AND t.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<SumTotalRow>();
    return row ? Number(row.total) : 0;
  }

  private async sumRechargeTotal(start: string, end: string): Promise<number> {
    const [gateway, manual] = await Promise.all([
      this.sumRecharge(start, end),
      this.sumManualCredit(start, end),
    ]);
    return Number((gateway + manual).toFixed(2));
  }

  private async sumWithdraw(start: string, end: string): Promise<number> {
    const row = await this.wdRepo
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amount), 0)', 'total')
      .where('w.status = :status', { status: WithdrawStatus.Approved })
      .andWhere('w.created_at >= :start AND w.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<SumTotalRow>();
    return row ? Number(row.total) : 0;
  }

  private async sumProfit(start: string, end: string): Promise<number> {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'bets')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'payouts')
      .where('o.status IN (:...statuses)', {
        statuses: [...SETTLED_ORDER_STATUSES],
      })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<ProfitRow>();
    if (!row) return 0;
    return Number((Number(row.bets) - Number(row.payouts)).toFixed(2));
  }

  private async sumReferralCommission(
    start: string,
    end: string,
  ): Promise<number> {
    const row = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.source_type = :type', { type: 'commission' })
      .andWhere('t.created_at >= :start AND t.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<SumTotalRow>();
    return row ? Number(row.total) : 0;
  }

  private async sumWinBonus(start: string, end: string): Promise<number> {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.win_amount), 0)', 'total')
      .where('o.status IN (:...statuses)', {
        statuses: [...SETTLED_ORDER_STATUSES],
      })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start,
        end,
      })
      .getRawOne<SumTotalRow>();
    return row ? Number(row.total) : 0;
  }

  async getDashboardEnhanced() {
    const basic = await this.getDashboard();

    const todayStart = this.todayStart();
    const todayOrders = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .addSelect('COUNT(*)', 'count')
      .where('o.created_at >= :start', { start: todayStart })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [...SETTLED_ORDER_STATUSES],
      })
      .getRawOne<TodayStatsRow>();

    const todayNewUsers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.created_at >= :start', { start: todayStart })
      .getCount();

    const activeGames = await this.gameRepo.count({ where: { status: 1 } });
    const activeRounds = await this.roundRepo.count({
      where: [{ status: 0 }, { status: 1 }],
    });

    if (!todayOrders) {
      throw new NotFoundException('Dashboard order aggregate not available');
    }

    return {
      ...basic,
      todayBet: Number(todayOrders.totalBet),
      todayPayout: Number(todayOrders.totalPayout),
      todayOrderCount: Number(todayOrders.count),
      todayNewUsers,
      activeGames,
      activeRounds,
    };
  }

  async getRevenueReport(dto: {
    startDate: string;
    endDate: string;
    gameType?: string;
  }) {
    const endDate = `${dto.endDate} 23:59:59`;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.game_type', 'gameType')
      .addSelect('o.game_id', 'gameId')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .addSelect('COUNT(*)', 'orderCount')
      .where('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [...SETTLED_ORDER_STATUSES],
      })
      .groupBy('o.game_type')
      .addGroupBy('o.game_id');

    if (dto.gameType) qb.andWhere('o.game_type = :gt', { gt: dto.gameType });

    const rows = await qb.getRawMany<RevenueGameRow>();

    const gameIds = [
      ...new Set(rows.map((r) => Number(r.gameId)).filter(Boolean)),
    ];
    const gameMap = new Map<number, GameList>();
    if (gameIds.length > 0) {
      const games = await this.gameRepo.find({ where: { id: In(gameIds) } });
      games.forEach((g) => gameMap.set(g.id, g));
    }

    const roundCounts = await this.roundRepo
      .createQueryBuilder('r')
      .select('r.game_type', 'gameType')
      .addSelect('COUNT(*)', 'roundCount')
      .where('r.status = 2')
      .andWhere('r.created_at >= :start AND r.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('r.game_type')
      .getRawMany<RoundCountRow>();
    const roundMap = new Map<string, number>();
    roundCounts.forEach((r) => roundMap.set(r.gameType, Number(r.roundCount)));

    let totalBets = 0;
    let totalPayouts = 0;

    const byGame = rows.map((r) => {
      const bet = Number(r.totalBet);
      const payout = Number(r.totalPayout);
      totalBets += bet;
      totalPayouts += payout;
      const game = gameMap.get(Number(r.gameId));
      const roundCount = roundMap.get(r.gameType);
      return {
        gameType: r.gameType,
        gameName: game && game.gameName ? game.gameName : r.gameType,
        totalBets: bet,
        totalPayouts: payout,
        netRevenue: Number((bet - payout).toFixed(2)),
        roundCount: roundCount !== undefined ? roundCount : 0,
        orderCount: Number(r.orderCount),
      };
    });

    const dailyQb = this.orderRepo
      .createQueryBuilder('o')
      .select('DATE(o.created_at)', 'date')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .where('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [...SETTLED_ORDER_STATUSES],
      })
      .groupBy('DATE(o.created_at)')
      .orderBy('date', 'ASC');
    if (dto.gameType)
      dailyQb.andWhere('o.game_type = :gt', { gt: dto.gameType });
    const dailyRows = await dailyQb.getRawMany<DailyRevenueRow>();

    const daily = dailyRows.map((r) => ({
      date: r.date,
      totalBets: Number(r.totalBet),
      totalPayouts: Number(r.totalPayout),
      netRevenue: Number(
        (Number(r.totalBet) - Number(r.totalPayout)).toFixed(2),
      ),
    }));

    const netRevenue = Number((totalBets - totalPayouts).toFixed(2));

    return {
      summary: {
        totalBets,
        totalPayouts,
        netRevenue,
        marginPercent:
          totalBets > 0
            ? Number(((netRevenue / totalBets) * 100).toFixed(2))
            : 0,
      },
      byGame,
      daily,
    };
  }

  async getUserReport(dto: { startDate: string; endDate: string }) {
    const start = dto.startDate;
    const end = `${dto.endDate} 23:59:59`;
    const todayStart = this.todayStart();

    const [
      totalUsers,
      newUsersToday,
      activeRaw,
      rcRaw,
      wdRaw,
      trendRaw,
      depRaw,
      winRaw,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo
        .createQueryBuilder('u')
        .where('u.created_at >= :t', { t: todayStart })
        .getCount(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.user_id)', 'count')
        .where('o.created_at >= :t', { t: todayStart })
        .getRawOne<CountRow>(),
      this.rcRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.amount),0)', 'total')
        .where(
          'r.status = 1 AND r.created_at >= :start AND r.created_at <= :end',
          { start, end },
        )
        .getRawOne<SumTotalRow>(),
      this.wdRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount),0)', 'total')
        .where(
          'w.status = 1 AND w.created_at >= :start AND w.created_at <= :end',
          { start, end },
        )
        .getRawOne<SumTotalRow>(),
      this.userRepo
        .createQueryBuilder('u')
        .select('DATE(u.created_at)', 'date')
        .addSelect('COUNT(*)', 'count')
        .where('u.created_at >= :start AND u.created_at <= :end', {
          start,
          end,
        })
        .groupBy('DATE(u.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany<DateCountRow>(),
      this.txnRepo
        .createQueryBuilder('t')
        .select('t.user_id', 'userId')
        .addSelect('COALESCE(SUM(t.amount), 0)', 'totalRecharge')
        .where('t.source_type = :ty', { ty: 'recharge' })
        .andWhere('t.created_at >= :start AND t.created_at <= :end', {
          start,
          end,
        })
        .groupBy('t.user_id')
        .orderBy('totalRecharge', 'DESC')
        .limit(10)
        .getRawMany<TopUserRow>(),
      this.txnRepo
        .createQueryBuilder('t')
        .select('t.user_id', 'userId')
        .addSelect('COALESCE(SUM(t.amount), 0)', 'totalWin')
        .where('t.source_type = :ty', { ty: 'win' })
        .andWhere('t.created_at >= :start AND t.created_at <= :end', {
          start,
          end,
        })
        .groupBy('t.user_id')
        .orderBy('totalWin', 'DESC')
        .limit(10)
        .getRawMany<TopUserRow>(),
    ]);

    if (!activeRaw || !rcRaw || !wdRaw) {
      throw new NotFoundException('User report aggregate not available');
    }

    const userIds = [
      ...new Set([
        ...depRaw.map((r) => r.userId),
        ...winRaw.map((r) => r.userId),
      ]),
    ].filter(Boolean);
    const userMap = new Map<string, { nickname: string; phone: string }>();
    const betMap = new Map<string, number>();
    if (userIds.length > 0) {
      const users = await this.userRepo.find({
        where: { userId: In(userIds) },
        select: ['userId', 'nickname', 'phone'],
      });
      for (const u of users)
        userMap.set(u.userId, { nickname: u.nickname, phone: u.phone });
      const bets = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'userId')
        .addSelect('COALESCE(SUM(o.total_amount),0)', 'totalBet')
        .where('o.user_id IN (:...ids)', { ids: userIds })
        .groupBy('o.user_id')
        .getRawMany<UserBetRow>();
      for (const b of bets) betMap.set(b.userId, Number(b.totalBet));
    }
    const enrich = (r: TopUserRow, amtKey: 'totalRecharge' | 'totalWin') => {
      const info = userMap.get(r.userId);
      const amountRaw = r[amtKey];
      const totalBet = betMap.get(r.userId);
      return {
        userId: r.userId,
        nickname: info && info.nickname ? info.nickname : '',
        phone: info && info.phone ? info.phone : '',
        [amtKey]: amountRaw !== undefined ? Number(amountRaw) : 0,
        totalBet: totalBet !== undefined ? totalBet : 0,
      };
    };

    return {
      summary: {
        totalUsers,
        newUsersToday,
        activeUsersToday: Number(activeRaw.count),
        totalRecharge: Number(rcRaw.total),
        totalWithdraw: Number(wdRaw.total),
      },
      topDepositors: depRaw.map((r) => enrich(r, 'totalRecharge')),
      topWinners: winRaw.map((r) => enrich(r, 'totalWin')),
      registrationTrend: trendRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
  }

  async getGameReport(dto: { startDate: string; endDate: string }) {
    const end = `${dto.endDate} 23:59:59`;
    const rows = await this.roundRepo
      .createQueryBuilder('r')
      .select('r.game_id', 'gameId')
      .addSelect('g.game_name', 'gameName')
      .addSelect('g.game_type', 'gameType')
      .addSelect('COUNT(*)', 'totalRounds')
      .addSelect('COALESCE(SUM(r.total_bet),0)', 'totalBets')
      .addSelect('COALESCE(SUM(r.total_payout),0)', 'totalPayouts')
      .addSelect(
        'COALESCE(SUM(CASE WHEN r.total_payout > r.total_bet THEN 1 ELSE 0 END), 0)',
        'highPayoutRounds',
      )
      .innerJoin(GameList, 'g', 'g.id = r.game_id')
      .where('r.status = 2')
      .andWhere('r.created_at >= :start AND r.created_at <= :end', {
        start: dto.startDate,
        end,
      })
      .groupBy('r.game_id')
      .addGroupBy('g.game_name')
      .addGroupBy('g.game_type')
      .orderBy('totalBets', 'DESC')
      .getRawMany<GameReportRow>();

    const orderCounts = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.game_id', 'gameId')
      .addSelect('COUNT(*)', 'totalOrders')
      .where('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end,
      })
      .groupBy('o.game_id')
      .getRawMany<GameOrderCountRow>();
    const orderMap = new Map(
      orderCounts.map((o) => [Number(o.gameId), Number(o.totalOrders)]),
    );

    let sumRounds = 0,
      sumBets = 0,
      sumPayouts = 0;
    const games = rows.map((r) => {
      const totalRounds = Number(r.totalRounds);
      const totalBets = Number(r.totalBets);
      const totalPayouts = Number(r.totalPayouts);
      sumRounds += totalRounds;
      sumBets += totalBets;
      sumPayouts += totalPayouts;
      const netRevenue = Number((totalBets - totalPayouts).toFixed(2));
      const totalOrders = orderMap.get(Number(r.gameId));
      return {
        gameId: Number(r.gameId),
        gameName: r.gameName,
        gameType: r.gameType,
        totalRounds,
        totalOrders: totalOrders !== undefined ? totalOrders : 0,
        totalBets,
        totalPayouts,
        netRevenue,
        houseEdge:
          totalBets > 0
            ? Number(((netRevenue / totalBets) * 100).toFixed(2))
            : 0,
        avgBetPerRound:
          totalRounds > 0 ? Number((totalBets / totalRounds).toFixed(2)) : 0,
        highPayoutRounds: Number(r.highPayoutRounds),
      };
    });

    return {
      summary: {
        totalGames: games.length,
        totalRounds: sumRounds,
        totalBets: sumBets,
        totalPayouts: sumPayouts,
        overallMargin:
          sumBets > 0
            ? Number((((sumBets - sumPayouts) / sumBets) * 100).toFixed(2))
            : 0,
      },
      games,
    };
  }

  async getLotteryReport(dto: { startDate: string; endDate: string }) {
    const endDate = `${dto.endDate} 23:59:59`;
    const lotteryTypes = await this.getLotteryGameTypes();
    if (lotteryTypes.length === 0)
      return {
        summary: { totalSold: 0, totalPrize: 0, profit: 0, totalTickets: 0 },
        byType: [],
      };

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.game_type', 'gameType')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalSold')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPrize')
      .addSelect('COUNT(*)', 'ticketCount')
      .addSelect('COUNT(DISTINCT o.user_id)', 'playerCount')
      .where('o.game_type IN (:...types)', { types: lotteryTypes })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('o.game_type');

    const rows = await qb.getRawMany<LotteryTypeRow>();

    let totalSold = 0;
    let totalPrize = 0;
    let totalTickets = 0;

    const byType = rows.map((r) => {
      const sold = Number(r.totalSold);
      const prize = Number(r.totalPrize);
      totalSold += sold;
      totalPrize += prize;
      totalTickets += Number(r.ticketCount);
      return {
        gameType: r.gameType,
        totalSold: sold,
        totalPrize: prize,
        profit: Number((sold - prize).toFixed(2)),
        ticketCount: Number(r.ticketCount),
        playerCount: Number(r.playerCount),
      };
    });

    return {
      summary: {
        totalSold,
        totalPrize,
        profit: Number((totalSold - totalPrize).toFixed(2)),
        totalTickets,
      },
      byType,
    };
  }

  async streamLotteryOrdersCsv(
    res: Response,
    dto: { startDate: string; endDate: string; gameType?: string },
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lottery-orders-${dto.startDate}_${dto.endDate}.csv"`,
    );
    const header = [
      'orderNo',
      'userId',
      'gameType',
      'roundNo',
      'betType',
      'betContent',
      'amount',
      'quantity',
      'totalAmount',
      'winAmount',
      'odds',
      'status',
      'createdAt',
    ];
    res.write(`${header.join(',')}\n`);

    const lotteryTypes = await this.getLotteryGameTypes();
    if (lotteryTypes.length === 0) {
      res.end();
      return;
    }

    const endDate = `${dto.endDate} 23:59:59`;
    const chunkSize = 5000;
    let lastId = 0;
    for (;;) {
      const qb = this.orderRepo
        .createQueryBuilder('o')
        .where('o.id > :lastId', { lastId })
        .andWhere('o.game_type IN (:...types)', { types: lotteryTypes })
        .andWhere('o.created_at >= :start AND o.created_at <= :end', {
          start: dto.startDate,
          end: endDate,
        })
        .orderBy('o.id', 'ASC')
        .limit(chunkSize);
      if (dto.gameType) {
        qb.andWhere('o.game_type = :gt', { gt: dto.gameType });
      }
      const rows = await qb.getMany();
      if (rows.length === 0) break;

      let buffer = '';
      for (const o of rows) {
        buffer += this.toCsvRow([
          o.orderNo,
          o.userId,
          o.gameType,
          o.roundNo,
          o.betType,
          JSON.stringify(
            o.betContent !== null && o.betContent !== undefined
              ? o.betContent
              : {},
          ),
          o.amount,
          o.quantity,
          o.totalAmount,
          o.winAmount,
          o.odds,
          o.status,
          new Date(o.createdAt).toISOString(),
        ]);
      }
      if (!res.write(buffer)) {
        await new Promise<void>((resolve) =>
          res.once('drain', () => resolve()),
        );
      }
      lastId = Number(rows[rows.length - 1].id);
      if (rows.length < chunkSize) break;
    }
    res.end();
  }

  private toCsvField(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  private toCsvRow(fields: unknown[]): string {
    return `${fields.map((f) => this.toCsvField(f)).join(',')}\n`;
  }

  async getPaymentReport(dto: { startDate: string; endDate: string }) {
    const endDate = `${dto.endDate} 23:59:59`;

    const recharges = await this.rcRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'total')
      .where('r.created_at >= :start AND r.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('r.status')
      .getRawMany<PaymentStatusRow>();

    let totalRecharge = 0;
    let successRecharge = 0;
    let pendingRecharge = 0;
    let failedRecharge = 0;
    let successCount = 0;
    let totalCount = 0;
    recharges.forEach((r) => {
      const amt = Number(r.total);
      const cnt = Number(r.count);
      totalCount += cnt;
      totalRecharge += amt;
      if (r.status === 1 || r.status === '1') {
        successRecharge += amt;
        successCount += cnt;
      } else if (r.status === 0 || r.status === '0') {
        pendingRecharge += amt;
      } else {
        failedRecharge += amt;
      }
    });

    const withdrawals = await this.wdRepo
      .createQueryBuilder('w')
      .select('w.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(w.amount), 0)', 'total')
      .where('w.created_at >= :start AND w.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('w.status')
      .getRawMany<PaymentStatusRow>();

    let totalWithdraw = 0;
    let approvedWithdraw = 0;
    let pendingWithdraw = 0;
    withdrawals.forEach((w) => {
      const amt = Number(w.total);
      totalWithdraw += amt;
      if (w.status === 1 || w.status === '1') approvedWithdraw += amt;
      else if (w.status === 0 || w.status === '0') pendingWithdraw += amt;
    });

    return {
      recharge: {
        total: totalRecharge,
        success: successRecharge,
        pending: pendingRecharge,
        failed: failedRecharge,
        successRate:
          totalCount > 0
            ? Number(((successCount / totalCount) * 100).toFixed(2))
            : 0,
      },
      withdraw: {
        total: totalWithdraw,
        approved: approvedWithdraw,
        pending: pendingWithdraw,
      },
      netFlow: Number((successRecharge - approvedWithdraw).toFixed(2)),
    };
  }

  async getManualPaymentReport(dto: { startDate: string; endDate: string }) {
    const endDate = `${dto.endDate} 23:59:59`;

    const manualRecharges = await this.rcRepo
      .createQueryBuilder('r')
      .where('r.status = 1')
      .andWhere('r.callback_data IS NULL')
      .andWhere('r.created_at >= :start AND r.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .orderBy('r.created_at', 'DESC')
      .getMany();

    const manualWithdrawals = await this.wdRepo
      .createQueryBuilder('w')
      .where('w.status IN (1, 2)')
      .andWhere('w.created_at >= :start AND w.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .orderBy('w.created_at', 'DESC')
      .getMany();

    return {
      recharges: manualRecharges.map((r) => ({
        orderNo: r.orderNo,
        userId: r.userId,
        amount: Number(r.amount),
        status: r.status,
        createdAt: r.createdAt,
      })),
      withdrawals: manualWithdrawals.map((w) => ({
        orderNo: w.orderNo,
        userId: w.userId,
        amount: Number(w.amount),
        fee: Number(w.fee),
        actualAmount: Number(w.actualAmount),
        status: w.status,
        createdAt: w.createdAt,
      })),
      summary: {
        totalManualRecharge: manualRecharges.reduce(
          (s, r) => s + Number(r.amount),
          0,
        ),
        totalManualWithdrawApproved: manualWithdrawals
          .filter((w) => w.status === 1)
          .reduce((s, w) => s + Number(w.amount), 0),
        totalManualWithdrawRejected: manualWithdrawals
          .filter((w) => w.status === 2)
          .reduce((s, w) => s + Number(w.amount), 0),
      },
    };
  }

  async getOverallReport(dto: { startDate: string; endDate: string }) {
    const endDate = `${dto.endDate} 23:59:59`;

    const betData = await this.orderRepo
      .createQueryBuilder('o')
      .select('DATE(o.created_at)', 'date')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .addSelect('COUNT(DISTINCT o.user_id)', 'activePlayers')
      .addSelect('COUNT(*)', 'orderCount')
      .where('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('DATE(o.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany<OverallDailyRow>();

    const rechargeData = await this.rcRepo
      .createQueryBuilder('r')
      .select('DATE(r.created_at)', 'date')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'total')
      .where('r.status = 1')
      .andWhere('r.created_at >= :start AND r.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('DATE(r.created_at)')
      .getRawMany<DateTotalRow>();
    const rcMap = new Map<string, number>();
    rechargeData.forEach((r) => rcMap.set(r.date, Number(r.total)));

    const withdrawData = await this.wdRepo
      .createQueryBuilder('w')
      .select('DATE(w.created_at)', 'date')
      .addSelect('COALESCE(SUM(w.amount), 0)', 'total')
      .where('w.status = 1')
      .andWhere('w.created_at >= :start AND w.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('DATE(w.created_at)')
      .getRawMany<DateTotalRow>();
    const wdMap = new Map<string, number>();
    withdrawData.forEach((w) => wdMap.set(w.date, Number(w.total)));

    const registrationData = await this.userRepo
      .createQueryBuilder('u')
      .select('DATE(u.created_at)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('u.created_at >= :start AND u.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .groupBy('DATE(u.created_at)')
      .getRawMany<DateCountRow>();
    const regMap = new Map<string, number>();
    registrationData.forEach((r) => regMap.set(r.date, Number(r.count)));

    const daily = betData.map((r) => {
      const recharge = rcMap.get(r.date);
      const withdraw = wdMap.get(r.date);
      const newUsers = regMap.get(r.date);
      return {
        date: r.date,
        totalBet: Number(r.totalBet),
        totalPayout: Number(r.totalPayout),
        netRevenue: Number(
          (Number(r.totalBet) - Number(r.totalPayout)).toFixed(2),
        ),
        activePlayers: Number(r.activePlayers),
        orderCount: Number(r.orderCount),
        recharge: recharge !== undefined ? recharge : 0,
        withdraw: withdraw !== undefined ? withdraw : 0,
        newUsers: newUsers !== undefined ? newUsers : 0,
      };
    });

    const totals = daily.reduce(
      (acc, d) => {
        acc.totalBet += d.totalBet;
        acc.totalPayout += d.totalPayout;
        acc.totalRecharge += d.recharge;
        acc.totalWithdraw += d.withdraw;
        acc.totalOrders += d.orderCount;
        acc.totalNewUsers += d.newUsers;
        return acc;
      },
      {
        totalBet: 0,
        totalPayout: 0,
        totalRecharge: 0,
        totalWithdraw: 0,
        totalOrders: 0,
        totalNewUsers: 0,
      },
    );

    return {
      summary: {
        ...totals,
        netRevenue: Number((totals.totalBet - totals.totalPayout).toFixed(2)),
        netFlow: Number(
          (totals.totalRecharge - totals.totalWithdraw).toFixed(2),
        ),
      },
      daily,
    };
  }

  private async getLotteryGameTypes(): Promise<string[]> {
    const lotteries = await this.gameRepo
      .createQueryBuilder('g')
      .select('DISTINCT g.gameType', 'gameType')
      .where('g.is_lottery = 1')
      .getRawMany();
    return lotteries.map((r: any) => r.gameType);
  }

  private todayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private istParts(): Record<string, string> {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const part of parts) map[part.type] = part.value;
    return map;
  }

  private istDate(): string {
    const p = this.istParts();
    return `${p.year}-${p.month}-${p.day}`;
  }

  private istNow(): string {
    const p = this.istParts();
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  }

  private resolveRange(range?: { startDate?: string; endDate?: string }): {
    start: string;
    end: string;
    startDate: string;
    endDate: string;
  } {
    const isDate = (value?: string): value is string =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const today = this.istDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const startDate = isDate(range?.startDate) ? range.startDate : monthStart;
    const endDate = isDate(range?.endDate) ? range.endDate : today;
    return {
      start: `${startDate} 00:00:00`,
      end: `${endDate} 23:59:59`,
      startDate,
      endDate,
    };
  }
}
