import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { nextRoundNoForGame } from '../../game/shared/round-number.util';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { LotteryDrawDetail } from '../../../entities/lottery-draw-detail.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import {
  LotteryDrawMode,
  TinyFlag,
  RoundStatus,
  OrderStatus,
} from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';
import { GameConfigService } from '../../game/shared/game-config.service';

interface LotteryTicketAggRow {
  cnt: string;
  players: string;
  stake: string;
}

interface LotteryTodayBetsRow {
  total: number;
  payout: number;
  count: number;
}

interface LotteryTotalBetsRow {
  totalBet: number;
  totalPayout: number;
  totalOrders: number;
}

interface LotteryRoundStatsRow {
  totalRounds: string;
  completedRounds: string;
  totalBet: string;
  totalPayout: string;
}

interface LotteryOrderStatsRow {
  totalOrders: string;
  uniquePlayers: string;
}

interface LotteryOrderStatusCountRaw {
  status: string | number;
  count: string | number;
  bet: string | number | null;
  win: string | number | null;
}

export interface LotteryOrderStatusCount {
  status: number;
  count: number;
  bet: number;
  win: number;
}

export interface LotteryOrderSummary {
  totalOrders: number;
  totalTickets: number;
  totalBet: number;
  totalWin: number;
  netProfit: number;
  statusCounts: LotteryOrderStatusCount[];
}

interface LotteryOrderSummaryRaw {
  totalOrders: string | number;
  totalTickets: string | number | null;
  totalBet: string | number | null;
  totalWin: string | number | null;
}

interface LotteryDrawSummaryRaw {
  totalDraws: string | number;
  totalBet: string | number | null;
  totalPayout: string | number | null;
}

export interface LotteryDrawSummary {
  totalDraws: number;
  totalSales: number;
  totalPayout: number;
  netProfit: number;
}

interface UsernameInfo {
  nickname: string;
  phone: string;
  avatar: string;
}

@Injectable()
export class AdminLotteryManagementService {
  constructor(
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(LotteryDrawDetail)
    private lotteryDetailRepo: Repository<LotteryDrawDetail>,
    private audit: AdminAuditService,
    private gameConfig: GameConfigService,
  ) {}

  async getDraws(dto: {
    gameId?: number;
    gameType?: string;
    status?: number;
    pageNo: number;
    pageSize: number;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.roundRepo
      .createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC');

    if (dto.gameId) qb.andWhere('r.game_id = :gid', { gid: dto.gameId });
    if (dto.gameType) qb.andWhere('r.game_type = :gt', { gt: dto.gameType });
    if (dto.status !== undefined && dto.status !== null)
      qb.andWhere('r.status = :s', { s: dto.status });
    if (dto.startDate)
      qb.andWhere('r.created_at >= :start', { start: dto.startDate });
    if (dto.endDate) qb.andWhere('r.created_at <= :end', { end: dto.endDate });

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async getLotteryDraws(body: {
    pageNo: number;
    pageSize: number;
    gameId?: number;
    gameIds?: number[];
    gameType?: string;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    filterType?: 'auto' | 'manual' | 'pending' | 'closed';
  }) {
    const {
      pageNo = 1,
      pageSize = 20,
      gameId,
      gameIds: filterGameIds,
      gameType,
      status,
      search,
      filterType,
    } = body;
    const startDate = body.startDate ? body.startDate.trim() : '';
    const endDate = body.endDate ? body.endDate.trim() : '';
    const applyFilters = (
      qb: ReturnType<Repository<GameRound>['createQueryBuilder']>,
    ) => {
      qb.where('r.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1)');
      if (gameId) qb.andWhere('r.gameId = :gid', { gid: gameId });
      if (filterGameIds && filterGameIds.length > 0)
        qb.andWhere('r.gameId IN (:...gids)', { gids: filterGameIds });
      if (gameType) qb.andWhere('r.gameType = :gt', { gt: gameType });
      if (status !== undefined && status !== null)
        qb.andWhere('r.status = :s', { s: status });
      if (filterType === 'pending')
        qb.andWhere('r.status = :ps', { ps: 1 }).andWhere(
          'r.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 0)',
        );
      else if (filterType === 'closed') qb.andWhere('r.status = :cs', { cs: 2 });
      else if (filterType === 'auto')
        qb.andWhere(
          'r.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 1)',
        );
      else if (filterType === 'manual')
        qb.andWhere(
          'r.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 0)',
        );
      if (search) qb.andWhere('r.roundNo LIKE :q', { q: `%${search}%` });
      if (startDate)
        qb.andWhere('r.draw_time >= :drStart', {
          drStart: `${startDate} 00:00:00`,
        });
      if (endDate)
        qb.andWhere('r.draw_time <= :drEnd', { drEnd: `${endDate} 23:59:59` });
      return qb;
    };
    const qb = applyFilters(
      this.roundRepo.createQueryBuilder('r'),
    ).orderBy('r.drawTime', 'DESC');
    const [list, total] = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const includeOrphans =
      (status === undefined || status === null) &&
      filterType !== 'pending' &&
      filterType !== 'closed' &&
      !search;
    const summary = await this.loadLotteryDrawSummary(applyFilters, {
      includeOrphans,
      gameId,
      gameIds: filterGameIds,
      gameType,
      filterType,
      startDate,
      endDate,
    });
    const resultGameIds = [...new Set(list.map((round) => round.gameId))];
    const nameMap = new Map<number, string>();
    const autoMap = new Map<number, number>();
    if (resultGameIds.length > 0) {
      const games = await this.gameRepo.find({
        where: { id: In(resultGameIds) },
      });
      for (const game of games) {
        nameMap.set(game.id, game.gameName);
        autoMap.set(game.id, game.autoGenerate);
      }
    }
    const enriched = list.map((round) => {
      const gameName = nameMap.get(round.gameId);
      return {
        ...round,
        gameName: gameName !== undefined ? gameName : '',
        autoGenerate: autoMap.get(round.gameId),
      };
    });
    return { list: enriched, total, pageNo, pageSize, summary };
  }

  private async loadLotteryDrawSummary(
    applyFilters: (
      qb: ReturnType<Repository<GameRound>['createQueryBuilder']>,
    ) => ReturnType<Repository<GameRound>['createQueryBuilder']>,
    orphanOpts: {
      includeOrphans: boolean;
      gameId?: number;
      gameIds?: number[];
      gameType?: string;
      filterType?: 'auto' | 'manual' | 'pending' | 'closed';
      startDate?: string;
      endDate?: string;
    },
  ): Promise<LotteryDrawSummary> {
    const raw = await applyFilters(this.roundRepo.createQueryBuilder('r'))
      .select('COUNT(*)', 'totalDraws')
      .addSelect('COALESCE(SUM(r.total_bet), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(r.total_payout), 0)', 'totalPayout')
      .getRawOne<LotteryDrawSummaryRaw>();
    if (!raw) {
      throw new NotFoundException('Lottery draw summary not available');
    }
    const orphan = orphanOpts.includeOrphans
      ? await this.loadOrphanDrawTotals(orphanOpts)
      : { bet: 0, payout: 0, draws: 0 };
    const totalSales = Number(raw.totalBet) + orphan.bet;
    const totalPayout = Number(raw.totalPayout) + orphan.payout;
    return {
      totalDraws: Number(raw.totalDraws) + orphan.draws,
      totalSales: Number(totalSales.toFixed(2)),
      totalPayout: Number(totalPayout.toFixed(2)),
      netProfit: Number((totalSales - totalPayout).toFixed(2)),
    };
  }

  private async loadOrphanDrawTotals(opts: {
    gameId?: number;
    gameIds?: number[];
    gameType?: string;
    filterType?: 'auto' | 'manual' | 'pending' | 'closed';
    startDate?: string;
    endDate?: string;
  }): Promise<{ bet: number; payout: number; draws: number }> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'bet')
      .addSelect(
        `COALESCE(SUM(CASE WHEN o.status = ${OrderStatus.Won} THEN o.win_amount ELSE 0 END), 0)`,
        'payout',
      )
      .addSelect('COUNT(DISTINCT o.game_id, o.round_no)', 'draws')
      .where('o.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1)')
      .andWhere('o.status NOT IN (:...excl)', {
        excl: [OrderStatus.Cancelled, OrderStatus.Refunded],
      })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM game_rounds gr WHERE gr.game_id = o.game_id AND gr.round_no = o.round_no)',
      );
    if (opts.gameId) qb.andWhere('o.game_id = :ogid', { ogid: opts.gameId });
    if (opts.gameIds && opts.gameIds.length > 0)
      qb.andWhere('o.game_id IN (:...ogids)', { ogids: opts.gameIds });
    if (opts.gameType) qb.andWhere('o.game_type = :ogt', { ogt: opts.gameType });
    if (opts.filterType === 'auto')
      qb.andWhere(
        'o.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 1)',
      );
    else if (opts.filterType === 'manual')
      qb.andWhere(
        'o.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 0)',
      );
    if (opts.startDate)
      qb.andWhere('o.created_at >= :ostart', {
        ostart: `${opts.startDate} 00:00:00`,
      });
    if (opts.endDate)
      qb.andWhere('o.created_at <= :oend', {
        oend: `${opts.endDate} 23:59:59`,
      });
    const row = await qb.getRawOne<{
      bet: string | number | null;
      payout: string | number | null;
      draws: string | number | null;
    }>();
    return {
      bet: row ? Number(row.bet) : 0,
      payout: row ? Number(row.payout) : 0,
      draws: row ? Number(row.draws) : 0,
    };
  }

  async getLotteryDrawDetail(roundNo: string, gameId?: number) {
    const round = await this.roundRepo.findOne({
      where: gameId ? { roundNo, gameId } : { roundNo },
    });
    const details = await this.lotteryDetailRepo.find({
      where: gameId ? { roundNo, gameId } : { roundNo },
      order: { prizeTier: 'ASC' },
    });
    const lotteryTypes = await this.getLotteryGameTypes();
    const ordersQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.roundNo = :rn', { rn: roundNo })
      .andWhere(lotteryTypes.length > 0 ? 'o.gameType IN (:...types)' : '1=0', {
        types: lotteryTypes,
      });
    if (gameId) ordersQb.andWhere('o.gameId = :gid', { gid: gameId });
    const orders = await ordersQb
      .orderBy('o.created_at', 'DESC')
      .take(100)
      .getMany();
    return {
      round,
      prizeTiers: details,
      orders,
      ticketCount: orders.length,
      wonCount: orders.filter((o) => Number(o.winAmount) > 0).length,
    };
  }

  async getLotteryDrawById(roundId: number) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    const game = await this.gameRepo.findOne({ where: { id: round.gameId } });
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.roundNo = :rn', { rn: round.roundNo })
      .andWhere('o.gameId = :gid', { gid: round.gameId })
      .orderBy('o.created_at', 'DESC')
      .take(200)
      .getMany();
    const agg = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'cnt')
      .addSelect('COUNT(DISTINCT o.user_id)', 'players')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'stake')
      .where('o.roundNo = :rn', { rn: round.roundNo })
      .andWhere('o.gameId = :gid', { gid: round.gameId })
      .getRawOne<LotteryTicketAggRow>();
    if (!agg) {
      throw new NotFoundException('Round aggregate not available');
    }
    const prizeTiers = await this.lotteryDetailRepo.find({
      where: { roundNo: round.roundNo, gameId: round.gameId },
      order: { prizeTier: 'ASC' },
    });
    return {
      round,
      game,
      orders,
      prizeTiers,
      ticketCount: Number(agg.cnt),
      uniquePlayers: Number(agg.players),
      totalStake: Number(Number(agg.stake).toFixed(2)),
    };
  }

  async getLotteryOrders(body: {
    pageNo: number;
    pageSize: number;
    gameId?: number;
    gameIds?: number[];
    roundNo?: string;
    userId?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const {
      pageNo = 1,
      pageSize = 20,
      gameId,
      gameIds,
      roundNo,
      userId,
      status,
    } = body;
    const startDate = body.startDate ? body.startDate.trim() : '';
    const endDate = body.endDate ? body.endDate.trim() : '';
    const lotteryTypes = await this.getLotteryGameTypes();
    const applyFilters = (
      qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    ) => {
      qb.where(lotteryTypes.length > 0 ? 'o.gameType IN (:...types)' : '1=0', {
        types: lotteryTypes,
      });
      if (gameId) qb.andWhere('o.gameId = :gid', { gid: gameId });
      if (gameIds && gameIds.length > 0)
        qb.andWhere('o.gameId IN (:...gids)', { gids: gameIds });
      if (roundNo) qb.andWhere('o.roundNo = :rn', { rn: roundNo });
      if (userId)
        qb.andWhere('(o.userId LIKE :u OR o.orderNo LIKE :u)', {
          u: `%${userId}%`,
        });
      if (startDate)
        qb.andWhere('o.created_at >= :odStart', {
          odStart: `${startDate} 00:00:00`,
        });
      if (endDate)
        qb.andWhere('o.created_at <= :odEnd', { odEnd: `${endDate} 23:59:59` });
      return qb;
    };
    const qb = applyFilters(this.orderRepo.createQueryBuilder('o')).orderBy(
      'o.created_at',
      'DESC',
    );
    if (status !== undefined && status !== null)
      qb.andWhere('o.status = :s', { s: status });
    const [list, total] = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const summary = await this.loadLotteryOrderSummary(applyFilters);
    const roundMap = await this.loadOrderRoundMap(list);
    const userMap = await this.loadUsernameMap(
      list.map((order) => order.userId),
    );
    const orderGameIds = [...new Set(list.map((order) => order.gameId))];
    const orderGames = orderGameIds.length
      ? await this.gameRepo.find({ where: { id: In(orderGameIds) } })
      : [];
    const gameNameMap = new Map(orderGames.map((g) => [g.id, g.gameName]));
    const enriched = list.map((order) => {
      const gameName = gameNameMap.get(order.gameId);
      const round = roundMap.get(this.roundKey(order.gameId, order.roundNo));
      return {
        ...order,
        username: this.resolveUsername(userMap.get(order.userId)),
        gameName: gameName !== undefined ? gameName : null,
        result: round ? round.result : null,
      };
    });
    return { list: enriched, total, pageNo, pageSize, summary };
  }

  private async loadLotteryOrderSummary(
    applyFilters: (
      qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    ) => ReturnType<Repository<Order>['createQueryBuilder']>,
  ): Promise<LotteryOrderSummary> {
    const totalsRaw = await applyFilters(this.orderRepo.createQueryBuilder('o'))
      .select('COUNT(*)', 'totalOrders')
      .addSelect('COALESCE(SUM(o.quantity), 0)', 'totalTickets')
      .addSelect(
        `COALESCE(SUM(CASE WHEN o.status NOT IN (${OrderStatus.Cancelled}, ${OrderStatus.Refunded}) THEN o.total_amount ELSE 0 END), 0)`,
        'totalBet',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN o.status NOT IN (${OrderStatus.Cancelled}, ${OrderStatus.Refunded}) THEN o.win_amount ELSE 0 END), 0)`,
        'totalWin',
      )
      .getRawOne<LotteryOrderSummaryRaw>();
    if (!totalsRaw) {
      throw new NotFoundException('Lottery order summary not available');
    }
    const statusRows = await applyFilters(this.orderRepo.createQueryBuilder('o'))
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'bet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'win')
      .groupBy('o.status')
      .getRawMany<LotteryOrderStatusCountRaw>();
    const totalBet = Number(totalsRaw.totalBet);
    const totalWin = Number(totalsRaw.totalWin);
    return {
      totalOrders: Number(totalsRaw.totalOrders),
      totalTickets: Number(totalsRaw.totalTickets),
      totalBet: Number(totalBet.toFixed(2)),
      totalWin: Number(totalWin.toFixed(2)),
      netProfit: Number((totalBet - totalWin).toFixed(2)),
      statusCounts: statusRows.map((row) => ({
        status: Number(row.status),
        count: Number(row.count),
        bet: Number(Number(row.bet).toFixed(2)),
        win: Number(Number(row.win).toFixed(2)),
      })),
    };
  }

  private roundKey(gameId: number, roundNo: string): string {
    return `${gameId}:${roundNo}`;
  }

  private async loadOrderRoundMap(
    orders: Order[],
  ): Promise<Map<string, GameRound>> {
    const map = new Map<string, GameRound>();
    if (orders.length === 0) return map;
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    const roundNos = [...new Set(orders.map((o) => o.roundNo).filter(Boolean))];
    if (gameIds.length === 0 || roundNos.length === 0) return map;
    const rounds = await this.roundRepo
      .createQueryBuilder('r')
      .where('r.game_id IN (:...gameIds)', { gameIds })
      .andWhere('r.round_no IN (:...roundNos)', { roundNos })
      .getMany();
    for (const round of rounds) {
      map.set(this.roundKey(round.gameId, round.roundNo), round);
    }
    return map;
  }

  private async loadUsernameMap(
    userIds: string[],
  ): Promise<Map<string, UsernameInfo>> {
    const map = new Map<string, UsernameInfo>();
    const distinctIds = [...new Set(userIds.filter(Boolean))];
    if (distinctIds.length === 0) return map;
    const users = await this.userRepo.find({
      where: { userId: In(distinctIds) },
      select: ['userId', 'nickname', 'phone', 'avatar'],
    });
    for (const user of users) {
      map.set(user.userId, {
        nickname: user.nickname,
        phone: user.phone,
        avatar: user.avatar,
      });
    }
    return map;
  }

  private resolveUsername(info: UsernameInfo | undefined): string {
    if (!info) return '';
    if (info.nickname) return info.nickname;
    if (info.phone) return info.phone;
    return '';
  }

  async getLotteryList() {
    const games = await this.gameRepo.find({
      where: { isLottery: 1 },
      order: { sortOrder: 'ASC' },
    });
    const now = Date.now();
    const result = await Promise.all(
      games.map(async (g) => {
        const liveRounds = await this.roundRepo.find({
          where: { gameId: g.id, status: In([0, 1]) },
          order: { drawTime: 'ASC' },
        });
        const isManualGame = g.autoGenerate === 0;
        const dueRounds = isManualGame
          ? liveRounds.filter(
              (r) =>
                r.status === 1 ||
                (r.drawTime ? new Date(r.drawTime).getTime() <= now : false),
            )
          : [];
        const openRound = liveRounds.find(
          (r) =>
            r.status === 0 &&
            (r.drawTime ? new Date(r.drawTime).getTime() > now : true),
        );
        const currentRound: GameRound | null =
          openRound !== undefined
            ? openRound
            : liveRounds.length > 0
              ? liveRounds[0]
              : null;
        const lastDraw = await this.roundRepo.findOne({
          where: { gameId: g.id, status: RoundStatus.Settled },
          order: { drawTime: 'DESC' },
        });
        const [todayBets, totalBets] = await Promise.all([
          this.orderRepo
            .createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .addSelect('COALESCE(SUM(o.win_amount), 0)', 'payout')
            .addSelect('COUNT(*)', 'count')
            .where('o.game_id = :gid AND o.created_at >= :start', {
              gid: g.id,
              start: this.todayStartIst(),
            })
            .getRawOne<LotteryTodayBetsRow>()
            .catch(
              (): LotteryTodayBetsRow => ({ total: 0, payout: 0, count: 0 }),
            ),
          this.orderRepo
            .createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
            .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
            .addSelect('COUNT(*)', 'totalOrders')
            .where('o.game_id = :gid', { gid: g.id })
            .getRawOne<LotteryTotalBetsRow>()
            .catch(
              (): LotteryTotalBetsRow => ({
                totalBet: 0,
                totalPayout: 0,
                totalOrders: 0,
              }),
            ),
        ]);
        if (!todayBets || !totalBets) {
          throw new NotFoundException('Lottery bet aggregate not available');
        }
        const isManual = isManualGame;
        const pendingDraws = dueRounds.map((r) => ({
          id: r.id,
          roundNo: r.roundNo,
          drawTime: r.drawTime,
          status: r.status,
        }));
        const pendingManualDraw = isManual && pendingDraws.length > 0;
        const closed = isManual && liveRounds.length === 0 && !!lastDraw;
        return {
          ...g,
          mode: isManual ? 'manual' : 'auto',
          pendingManualDraw,
          pendingDraws,
          pendingDrawCount: pendingDraws.length,
          closed,
          currentRound: currentRound
            ? {
                id: currentRound.id,
                roundNo: currentRound.roundNo,
                drawTime: currentRound.drawTime,
                stopBetTime: currentRound.stopBetTime,
                status: currentRound.status,
              }
            : null,
          lastDraw: lastDraw
            ? {
                roundNo: lastDraw.roundNo,
                result: lastDraw.result,
                drawTime: lastDraw.drawTime,
              }
            : null,
          todaySales: Number(todayBets.total),
          todayPayout: Number(todayBets.payout),
          todayProfit: Number(
            (Number(todayBets.total) - Number(todayBets.payout)).toFixed(2),
          ),
          todayTickets: Number(todayBets.count),
          totalBet: Number(totalBets.totalBet),
          totalPayout: Number(totalBets.totalPayout),
          totalOrders: Number(totalBets.totalOrders),
        };
      }),
    );
    return result;
  }

  async getLotteryOverview(gameId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Lottery not found');
    if (!game.isLottery) throw new BadRequestException('Not a lottery game');

    const currentRound = await this.roundRepo.findOne({
      where: { gameId, status: In([0, 1]) },
      order: { id: 'DESC' },
    });

    const roundStats = await this.roundRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'totalRounds')
      .addSelect(
        'COALESCE(SUM(CASE WHEN r.status = 2 THEN 1 ELSE 0 END), 0)',
        'completedRounds',
      )
      .addSelect('COALESCE(SUM(r.total_bet), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(r.total_payout), 0)', 'totalPayout')
      .where('r.game_id = :gid', { gid: gameId })
      .getRawOne<LotteryRoundStatsRow>();

    const orderStats = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'totalOrders')
      .addSelect('COUNT(DISTINCT o.user_id)', 'uniquePlayers')
      .where('o.game_id = :gid', { gid: gameId })
      .getRawOne<LotteryOrderStatsRow>();
    if (!roundStats || !orderStats) {
      throw new NotFoundException('Lottery overview aggregate not available');
    }

    const recentDraws = await this.roundRepo.find({
      where: { gameId, status: 2 },
      order: { id: 'DESC' },
      take: 5,
    });

    return {
      ...game,
      rules: await this.gameConfig.getRuleSections(gameId),
      prizeTiers: await this.gameConfig.getPrizeTiers(gameId),
      mode: game.autoGenerate === 0 ? 'manual' : 'auto',
      currentRound: currentRound
        ? {
            id: currentRound.id,
            roundNo: currentRound.roundNo,
            drawTime: currentRound.drawTime,
            stopBetTime: currentRound.stopBetTime,
            status: currentRound.status,
          }
        : null,
      stats: {
        totalRounds: Number(roundStats.totalRounds),
        completedRounds: Number(roundStats.completedRounds),
        totalBet: Number(roundStats.totalBet),
        totalPayout: Number(roundStats.totalPayout),
        netRevenue: Number(
          (
            Number(roundStats.totalBet) - Number(roundStats.totalPayout)
          ).toFixed(2),
        ),
        totalOrders: Number(orderStats.totalOrders),
        uniquePlayers: Number(orderStats.uniquePlayers),
      },
      recentDraws: recentDraws.map((r) => ({
        roundNo: r.roundNo,
        result: r.result,
        drawTime: r.drawTime,
        totalBet: r.totalBet,
        totalPayout: r.totalPayout,
      })),
    };
  }

  async toggleLotteryMode(
    gameId: number,
    autoGenerate: boolean,
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Lottery not found');
    if (!game.isLottery) throw new BadRequestException('Not a lottery game');
    const activeRounds = await this.roundRepo.find({
      where: {
        gameId,
        status: In([RoundStatus.BettingOpen, RoundStatus.BettingClosed]),
      },
    });
    if (activeRounds.length) {
      const betCount = await this.orderRepo.count({
        where: { gameId, roundNo: In(activeRounds.map((r) => r.roundNo)) },
      });
      if (betCount > 0)
        throw new BadRequestException(
          'An active round already has bets — settle or cancel it before changing the draw mode.',
        );
      await this.roundRepo.update(
        { id: In(activeRounds.map((r) => r.id)) },
        { status: RoundStatus.Cancelled },
      );
    }
    await this.gameRepo.update(gameId, {
      autoGenerate: autoGenerate ? TinyFlag.Yes : TinyFlag.No,
      lotteryType: autoGenerate ? LotteryDrawMode.Auto : LotteryDrawMode.Manual,
      ...(autoGenerate ? { startDate: null } : {}),
    });
    await this.audit.createAuditLog(
      adminId,
      'toggle_lottery_mode',
      'game',
      String(gameId),
      { autoGenerate },
    );
    return {
      success: true,
      mode: autoGenerate ? LotteryDrawMode.Auto : LotteryDrawMode.Manual,
    };
  }

  async createLotteryRound(gameId: number, drawTime: string, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Lottery not found');
    if (!game.isLottery) throw new BadRequestException('Not a lottery game');
    if (game.autoGenerate === TinyFlag.Yes)
      throw new BadRequestException(
        'Auto lotteries generate their own rounds. Switch to manual mode first.',
      );

    const activeRound = await this.roundRepo.findOne({
      where: {
        gameId,
        status: In([RoundStatus.BettingOpen, RoundStatus.BettingClosed]),
      },
    });
    if (activeRound)
      throw new BadRequestException(
        'An active round already exists. Complete or cancel it first.',
      );

    const stopBetBefore = game.stopBetBeforeSec;
    const dt = new Date(drawTime);
    const stopBetTime = new Date(dt.getTime() - stopBetBefore * 1000);
    const keralaChar =
      game.gameType === 'kerala'
        ? (await this.gameConfig.getKeralaConfig(gameId))?.prefix1st
        : null;
    const roundNo = await nextRoundNoForGame(
      this.roundRepo,
      dt,
      game,
      keralaChar,
    );

    const round = this.roundRepo.create({
      gameId,
      gameType: game.gameType,
      roundNo,
      status: 0,
      drawTime: dt,
      stopBetTime,
    } as any);
    const saved: any = await this.roundRepo.save(round);
    await this.audit.createAuditLog(
      adminId,
      'create_lottery_round',
      'game_round',
      String(saved.id),
      { roundNo, drawTime },
    );
    return saved;
  }

  private async getLotteryGameTypes(): Promise<string[]> {
    const lotteries = await this.gameRepo
      .createQueryBuilder('g')
      .select('DISTINCT g.gameType', 'gameType')
      .where('g.is_lottery = 1')
      .getRawMany();
    return lotteries.map((r: any) => r.gameType);
  }

  private todayStartIst(): Date {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(Date.now() + istOffsetMs);
    const istMidnightAsUtc = Date.UTC(
      nowIst.getUTCFullYear(),
      nowIst.getUTCMonth(),
      nowIst.getUTCDate(),
    );
    return new Date(istMidnightAsUtc - istOffsetMs);
  }
}
