import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource, EntityManager } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { GameList } from '../../../entities/game-list.entity';
import { GameCategory } from '../../../entities/game-category.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { nextRoundNoForGame } from '../../game/shared/round-number.util';
import { derivePositionLabels } from '../../game/shared/slat-reading.util';
import { Order } from '../../../entities/order.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { GameFeeConfig } from '../../../entities/game-fee-config.entity';
import { RaceRunnerFrame } from '../../../entities/race-runner-frame.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import {
  GameType,
  GameStatus,
  TinyFlag,
  RoundStatus,
  TransactionType,
  LotteryDrawMode,
  OrderStatus,
  ResultMode,
} from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';
import {
  GameConfigService,
  RaceRunnerView,
} from '../../game/shared/game-config.service';
import { DEFAULT_THREE_DIGIT_SLAT_PRODUCTS } from '../../game/shared/game-config.types';
import {
  GameRoundsListQuery,
  GameOptionsQuery,
  GameOption,
  GameScope,
  trimDate,
} from './admin-filter.types';

export enum GameCategoryControlField {
  IsHidden = 'isHidden',
  EmergencyStop = 'emergencyStop',
}

export type GameMutationInput = Omit<
  Partial<GameList>,
  'autoGenerate' | 'scheduledDrawTime' | 'startDate'
> & {
  name?: string;
  icon?: string | null;
  cover?: string | null;
  thumbnail?: string | null;
  stopBetBefore?: number;
  drawDelay?: number;
  autoGenerate?: boolean | number;
  scheduledDrawTime?: string | Date | null;
  scheduledDrawTimes?: unknown[];
  startDate?: string | Date | null;
};

export interface GameVisualEntry {
  colors: string[];
  labels: string[];
  numberColors: Record<string, string[]>;
  palette: Record<string, string>;
  themeColor: string | null;
  raceRunners: RaceRunnerView[];
}

export interface GameCategorySummary {
  id: number;
  categoryName: string;
  categoryCode: string;
  sortOrder: number;
  status: number;
  gameCount: number;
}

export interface GameCategoryControlResult {
  success: boolean;
  field: GameCategoryControlField;
  value: TinyFlag;
  affectedGames: number;
  cancelledRounds: number;
  refundedOrders: number;
}

interface GameRoundStatsRow {
  totalRounds: string;
  completedRounds: string;
}

interface GameOrderStatsRow {
  totalOrders: string;
  uniquePlayers: string;
  totalBet: string;
  totalPayout: string;
}

interface GameDailyStatsRow {
  date: string;
  totalBet: string;
  totalPayout: string;
  orderCount: string;
  playerCount: string;
}

interface GameTopPlayerRow {
  userId: string;
  totalBet: string;
  totalWin: string;
  orderCount: string;
}

interface GameTodayBetsRow {
  total: string;
}

@Injectable()
export class AdminGameService {
  constructor(
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    @InjectRepository(GameFeeConfig) private feeRepo: Repository<GameFeeConfig>,
    @InjectRepository(RaceRunnerFrame)
    private raceFrameRepo: Repository<RaceRunnerFrame>,
    private audit: AdminAuditService,
    private gameConfig: GameConfigService,
    private dataSource: DataSource,
  ) {}

  async getGames(dto: {
    pageNo: number;
    pageSize: number;
    search?: string;
    gameType?: string;
    status?: number;
    category?: string;
  }) {
    const qb = this.gameRepo
      .createQueryBuilder('g')
      .orderBy('g.sort_order', 'ASC');
    if (dto.search) {
      qb.andWhere('(g.game_name LIKE :q OR g.game_code LIKE :q)', {
        q: `%${dto.search}%`,
      });
    }
    if (dto.gameType) qb.andWhere('g.game_type = :gt', { gt: dto.gameType });
    if (dto.status !== undefined)
      qb.andWhere('g.status = :s', { s: dto.status });
    if (dto.category === 'our')
      qb.andWhere('g.is_third_party = 0 AND g.is_lottery = 0');
    else if (dto.category === 'third_party')
      qb.andWhere('g.is_third_party = 1');
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();

    const nowSec = Math.floor(Date.now() / 1000);
    const tkIds = list
      .filter((g) => g.source === 'TK' && g.drawInterval > 0)
      .map((g) => g.id);
    const roundMap: Record<number, GameRound> = {};
    if (tkIds.length > 0) {
      const rounds = await this.roundRepo
        .createQueryBuilder('r')
        .where('r.game_id IN (:...ids)', { ids: tkIds })
        .andWhere('r.status = :st', { st: 0 })
        .orderBy('r.created_at', 'DESC')
        .getMany();
      for (const r of rounds) if (!roundMap[r.gameId]) roundMap[r.gameId] = r;
    }
    const enriched = list.map((g) => {
      const round = roundMap[g.id];
      let countDown = 0;
      let drawTime: string | null = null;
      if (g.source === 'TK' && g.drawInterval > 0) {
        const drawSec = round?.drawTime
          ? Math.floor(new Date(round.drawTime).getTime() / 1000)
          : nowSec + g.drawInterval;
        countDown = Math.max(0, drawSec - nowSec);
        drawTime = new Date(drawSec * 1000).toISOString();
      }
      return {
        ...g,
        currentRound: round
          ? {
              roundNo: round.roundNo,
              drawTime: round.drawTime,
              status: round.status,
            }
          : null,
        countDown,
        drawTime,
      };
    });
    return new PaginatedResponse(enriched, total, dto.pageNo, dto.pageSize);
  }

  async getGameOptions(dto: GameOptionsQuery): Promise<GameOption[]> {
    const scope: GameScope = dto.scope ? dto.scope : 'all';
    const qb = this.gameRepo
      .createQueryBuilder('g')
      .select([
        'g.id AS id',
        'g.game_name AS name',
        'g.game_type AS gameType',
        'g.is_lottery AS isLottery',
        'g.is_third_party AS isThirdParty',
      ])
      .orderBy('g.is_lottery', 'DESC')
      .addOrderBy('g.sort_order', 'ASC')
      .addOrderBy('g.id', 'ASC');
    if (scope === 'in_house') qb.where('g.is_third_party = 0');
    else if (scope === 'lottery') qb.where('g.is_lottery = 1');
    if (dto.search)
      qb.andWhere('(g.game_name LIKE :q OR g.game_code LIKE :q)', {
        q: `%${dto.search}%`,
      });
    const rows = await qb.getRawMany<{
      id: number;
      name: string;
      gameType: string;
      isLottery: number;
      isThirdParty: number;
    }>();
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      gameType: row.gameType,
      isLottery: Number(row.isLottery),
      isThirdParty: Number(row.isThirdParty),
    }));
  }

  private nullablePick(
    primary: unknown,
    secondary: unknown,
  ): string | undefined {
    if (primary !== undefined && primary !== null && primary !== '') {
      return String(primary);
    }
    if (secondary !== undefined && secondary !== null && secondary !== '') {
      return String(secondary);
    }
    return undefined;
  }

  async createGame(data: GameMutationInput, adminId: number) {
    const drawTimes = this.parseManualDrawTimes(data);
    const fallbackGameType = data.gameType ? data.gameType : 'game';
    const mapped: Partial<GameList> = {
      gameName: data.name ? data.name : data.gameName,
      gameCode: data.gameCode
        ? data.gameCode
        : `${fallbackGameType}_${Date.now()}`,
      gameUid: data.gameUid !== undefined ? data.gameUid : null,
      gameType: data.gameType,
      categoryId:
        data.categoryId !== undefined
          ? data.categoryId
          : data.isLottery
            ? 1
            : null,
      source: data.source ? data.source : 'TK',
      provider: data.provider ? data.provider : 'TK',
      iconUrl: this.nullablePick(data.icon, data.iconUrl),
      bannerUrl: this.nullablePick(data.cover, data.bannerUrl),
      thumbnailUrl: this.nullablePick(data.thumbnail, data.thumbnailUrl),
      drawInterval: data.drawInterval,
      sellingPrice: data.sellingPrice,
      minBet: data.minBet,
      maxBet: data.maxBet,
      isHot: data.isHot ? data.isHot : 0,
      isLottery: data.isLottery ? data.isLottery : 0,
      isThirdParty: data.isThirdParty ? data.isThirdParty : 0,
      groupName: data.groupName ? data.groupName : null,
      lotteryType:
        data.autoGenerate === false
          ? LotteryDrawMode.Manual
          : data.lotteryType
            ? data.lotteryType
            : LotteryDrawMode.Auto,
      scheduledDrawTime: drawTimes.length > 0 ? drawTimes[0] : null,
      startDate: this.parseStartDate(data.startDate),
      themeColor: data.themeColor ? data.themeColor : null,
      bgColor: data.bgColor ? data.bgColor : null,
      textColor: data.textColor ? data.textColor : null,
      borderColor: data.borderColor ? data.borderColor : null,
      emoji: data.emoji ? data.emoji : null,
      description: data.description ? data.description : null,
      sortOrder: data.sortOrder ? data.sortOrder : 0,
      status: data.status !== undefined ? data.status : 1,
      isHidden: data.isHidden !== undefined ? data.isHidden : TinyFlag.No,
      stopBetBeforeSec:
        data.stopBetBefore !== undefined ? data.stopBetBefore : 10,
      drawDelaySec: data.drawDelay !== undefined ? data.drawDelay : 5,
      autoGenerate: data.autoGenerate === false ? 0 : 1,
      maxPrize: data.maxPrize !== undefined ? data.maxPrize : null,
      digitCount: data.digitCount,
      resultMode: data.resultMode ? data.resultMode : ResultMode.MaxProfit,
    };
    const game = this.gameRepo.create(mapped);
    const saved = await this.gameRepo.save(game);

    if (saved.gameType === GameType.ThreeDigit) {
      await this.gameConfig.replaceSlatProducts(
        saved.id,
        DEFAULT_THREE_DIGIT_SLAT_PRODUCTS,
      );
    }

    if (
      saved.gameType === GameType.ThreeDigit ||
      saved.gameType === GameType.FourFiveDigit
    ) {
      await this.seedDefaultPositionColors(saved);
    }

    if (
      mapped.isLottery === TinyFlag.Yes &&
      mapped.lotteryType === LotteryDrawMode.Manual
    ) {
      if (drawTimes.length === 0) {
        throw new BadRequestException(
          'A manual lottery requires at least one scheduled draw time.',
        );
      }
      await this.materializeManualRounds(
        saved,
        drawTimes,
        mapped.stopBetBeforeSec !== undefined ? mapped.stopBetBeforeSec : 10,
      );
    }

    await this.audit.createAuditLog(
      adminId,
      'create_game',
      'game',
      String(saved.id),
      { gameName: mapped.gameName },
    );
    return saved;
  }

  private async seedDefaultPositionColors(game: GameList): Promise<void> {
    const existing = await this.gameConfig.getPositionColorRows(game.id);
    if (existing.length > 0) return;
    const palette = ['#BE0000', '#FF8A00', '#007CEF', '#00B209', '#00C7CE'];
    const fallbackCount = game.gameType === GameType.ThreeDigit ? 3 : 5;
    const count =
      game.digitCount && game.digitCount > 0 ? game.digitCount : fallbackCount;
    const items = Array.from(
      { length: Math.min(count, palette.length) },
      (_, i) => ({ position: i, color: palette[i] }),
    );
    await this.gameConfig.replacePositionColors(game.id, items);
  }

  async getDigitPositionConfig(): Promise<Record<number, GameVisualEntry>> {
    const games = await this.gameRepo.find({
      where: {
        gameType: In([
          GameType.ThreeDigit,
          GameType.FourFiveDigit,
          GameType.Color,
          GameType.Dubai,
          GameType.Kerala,
          GameType.Race,
        ]),
      },
    });
    const map: Record<number, GameVisualEntry> = {};
    for (const g of games) {
      const entry: GameVisualEntry = {
        colors: [],
        labels: [],
        numberColors: {},
        palette: {},
        themeColor: null,
        raceRunners: [],
      };
      if (
        g.gameType === GameType.ThreeDigit ||
        g.gameType === GameType.FourFiveDigit
      ) {
        const { colors } = await this.gameConfig.getPositionColors(g.id);
        const products = await this.gameConfig.getSlatProducts(g.id);
        entry.colors = colors;
        entry.labels = derivePositionLabels(
          g.digitCount !== null && g.digitCount !== undefined
            ? g.digitCount
            : 0,
          products,
        );
      } else if (g.gameType === GameType.Color) {
        entry.numberColors = await this.gameConfig.getNumberColorMap(g.id);
        entry.palette = await this.gameConfig.getColorPaletteMap(g.id);
      } else if (
        g.gameType === GameType.Dubai ||
        g.gameType === GameType.Kerala
      ) {
        entry.themeColor =
          g.themeColor !== null && g.themeColor !== undefined
            ? g.themeColor
            : null;
      } else if (g.gameType === GameType.Race) {
        entry.raceRunners = await this.gameConfig.getRaceRunners(g.id);
      }
      map[g.id] = entry;
    }
    return map;
  }

  parseStartDate(value: string | Date | null | undefined): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  parseManualDrawTimes(data: GameMutationInput): Date[] {
    const raw: unknown[] = Array.isArray(data.scheduledDrawTimes)
      ? data.scheduledDrawTimes
      : data.scheduledDrawTime
        ? [data.scheduledDrawTime]
        : [];
    const seen = new Set<number>();
    const out: Date[] = [];
    for (const value of raw) {
      const d = new Date(value as string);
      const ms = d.getTime();
      if (!Number.isFinite(ms) || seen.has(ms)) continue;
      seen.add(ms);
      out.push(d);
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  async materializeManualRounds(
    game: GameList,
    drawTimes: Date[],
    stopBetBefore: number,
  ): Promise<void> {
    const keralaChar =
      game.gameType === 'kerala'
        ? (await this.gameConfig.getKeralaConfig(game.id))?.prefix1st
        : null;
    for (const drawTime of drawTimes) {
      const existing = await this.roundRepo.findOne({
        where: {
          gameId: game.id,
          drawTime,
          status: In([RoundStatus.BettingOpen, RoundStatus.BettingClosed]),
        },
      });
      if (existing) continue;
      const stopBetTime = new Date(drawTime.getTime() - stopBetBefore * 1000);
      for (let attempt = 0; attempt < 5; attempt++) {
        const roundNo = await nextRoundNoForGame(
          this.roundRepo,
          drawTime,
          game,
          keralaChar,
        );
        try {
          await this.roundRepo.save(
            this.roundRepo.create({
              gameId: game.id,
              gameType: game.gameType,
              roundNo,
              status: RoundStatus.BettingOpen,
              drawTime,
              stopBetTime,
            }),
          );
          break;
        } catch (error) {
          const e = error as {
            code?: string;
            driverError?: { code?: string };
            message?: string;
          };
          const code =
            e.code !== undefined
              ? e.code
              : e.driverError !== undefined
                ? e.driverError.code
                : undefined;
          const message = e.message !== undefined ? e.message : '';
          const dup =
            code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(message);
          if (!dup || attempt === 4) throw error;
        }
      }
    }
  }

  async updateGame(id: number, data: GameMutationInput, adminId: number) {
    const updateData: Partial<GameList> = {};
    const dataRecord = data as Record<string, unknown>;
    const updateRecord = updateData as Record<string, unknown>;
    const fieldMap: Record<string, keyof GameList> = {
      name: 'gameName',
      gameName: 'gameName',
      icon: 'iconUrl',
      iconUrl: 'iconUrl',
      cover: 'bannerUrl',
      bannerUrl: 'bannerUrl',
      thumbnail: 'thumbnailUrl',
      thumbnailUrl: 'thumbnailUrl',
    };
    const directFields: (keyof GameList)[] = [
      'gameCode',
      'gameUid',
      'gameType',
      'categoryId',
      'source',
      'provider',
      'drawInterval',
      'sellingPrice',
      'minBet',
      'maxBet',
      'isHot',
      'isLottery',
      'isThirdParty',
      'groupName',
      'lotteryType',
      'themeColor',
      'bgColor',
      'textColor',
      'borderColor',
      'emoji',
      'description',
      'sortOrder',
      'status',
      'isHidden',
      'isPaused',
      'emergencyStop',
      'stopBetBeforeSec',
      'drawDelaySec',
      'autoGenerate',
      'maxPrize',
      'digitCount',
      'fivedBigSmallThreshold',
      'quickCycleSec',
      'isQuick',
      'imgId',
      'lobbyIconUrl',
      'payRate',
      'resultMode',
      'resultHouseEdgeTarget',
      'resultHoldForApproval',
      'resultAvoidBigPrize',
      'resultAvoidZeroOrder',
    ];
    for (const [src, dst] of Object.entries(fieldMap)) {
      if (dataRecord[src] !== undefined) updateRecord[dst] = dataRecord[src];
    }
    for (const f of directFields) {
      if (dataRecord[f] !== undefined) updateRecord[f] = dataRecord[f];
    }
    if (data.scheduledDrawTime !== undefined) {
      updateData.scheduledDrawTime = data.scheduledDrawTime
        ? new Date(data.scheduledDrawTime)
        : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = this.parseStartDate(data.startDate);
    }
    if (data.autoGenerate === true || data.autoGenerate === 1) {
      updateData.startDate = null;
    }
    if (Object.keys(updateData).length > 0) {
      await this.gameRepo.update(id, updateData);
    }
    await this.audit.createAuditLog(
      adminId,
      'update_game',
      'game',
      String(id),
      updateData,
    );
  }

  async cloneGame(sourceId: number, adminId: number): Promise<GameList> {
    const source = await this.gameRepo.findOne({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Game not found');

    const gameCode = await this.generateUniqueGameCode(source.gameCode);
    const adminTag = adminId ? String(adminId) : undefined;

    const cloned = await this.dataSource.transaction(async (manager) => {
      const gameRepo = manager.getRepository(GameList);
      const draft = gameRepo.create({
        ...source,
        id: undefined,
        gameCode,
        gameName: `${source.gameName} (Copy)`,
        status: GameStatus.Inactive,
        isHidden: TinyFlag.Yes,
        isPaused: TinyFlag.No,
        emergencyStop: TinyFlag.No,
        createdBy: adminTag,
        updatedBy: adminTag,
        createdAt: undefined,
        updatedAt: undefined,
      });
      const saved = await gameRepo.save(draft);
      await this.gameConfig.cloneAllForGame(sourceId, saved.id, manager);
      await this.cloneGameReferenceConfig(manager, sourceId, saved.id);
      return saved;
    });

    await this.audit.createAuditLog(
      adminId,
      'clone_game',
      'game',
      String(cloned.id),
      { sourceId, gameCode },
    );
    return cloned;
  }

  private async cloneGameReferenceConfig(
    manager: EntityManager,
    sourceId: number,
    targetId: number,
  ): Promise<void> {
    const oddsRepo = manager.getRepository(GameOddsConfig);
    const odds = await oddsRepo.find({ where: { gameId: sourceId } });
    if (odds.length > 0) {
      await oddsRepo.save(
        odds.map((entry) =>
          oddsRepo.create({ ...entry, id: undefined, gameId: targetId }),
        ),
      );
    }
    const feeRepo = manager.getRepository(GameFeeConfig);
    const fees = await feeRepo.find({ where: { gameId: sourceId } });
    if (fees.length > 0) {
      await feeRepo.save(
        fees.map((entry) =>
          feeRepo.create({ ...entry, id: undefined, gameId: targetId }),
        ),
      );
    }
  }

  private async generateUniqueGameCode(base: string): Promise<string> {
    const root = base && base.trim().length > 0 ? base.trim() : 'game';
    let candidate = `${root}_copy`;
    let suffix = 1;
    while (
      (await this.gameRepo.count({ where: { gameCode: candidate } })) > 0
    ) {
      suffix += 1;
      candidate = `${root}_copy${suffix}`;
    }
    return candidate;
  }

  async getGameDetail(id: number) {
    const game = await this.gameRepo.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');

    const roundStats = await this.roundRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'totalRounds')
      .addSelect(
        'COALESCE(SUM(CASE WHEN r.status = 2 THEN 1 ELSE 0 END), 0)',
        'completedRounds',
      )
      .where('r.game_id = :gid', { gid: id })
      .getRawOne<GameRoundStatsRow>();

    const orderStats = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'totalOrders')
      .addSelect('COUNT(DISTINCT o.user_id)', 'uniquePlayers')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .where('o.game_id = :gid', { gid: id })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.Cancelled, OrderStatus.Refunded],
      })
      .getRawOne<GameOrderStatsRow>();

    const activeRounds = await this.roundRepo.count({
      where: { gameId: id, status: 0 },
    });

    if (!roundStats || !orderStats) {
      throw new NotFoundException('Game statistics not available');
    }

    const totalBet = Number(orderStats.totalBet);
    const totalPayout = Number(orderStats.totalPayout);

    return {
      ...game,
      stats: {
        totalRounds: Number(roundStats.totalRounds),
        completedRounds: Number(roundStats.completedRounds),
        totalBet,
        totalPayout,
        netRevenue: Number((totalBet - totalPayout).toFixed(2)),
        totalOrders: Number(orderStats.totalOrders),
        uniquePlayers: Number(orderStats.uniquePlayers),
        activeRounds,
      },
    };
  }

  async getGameStats(id: number, dto: { startDate: string; endDate: string }) {
    const endDate = `${dto.endDate} 23:59:59`;

    const daily = await this.orderRepo
      .createQueryBuilder('o')
      .select('DATE(o.created_at)', 'date')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalPayout')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COUNT(DISTINCT o.user_id)', 'playerCount')
      .where('o.game_id = :gid', { gid: id })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.Cancelled, OrderStatus.Refunded],
      })
      .groupBy('DATE(o.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany<GameDailyStatsRow>();

    const topPlayers = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.user_id', 'userId')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalWin')
      .addSelect('COUNT(*)', 'orderCount')
      .where('o.game_id = :gid', { gid: id })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: dto.startDate,
        end: endDate,
      })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.Cancelled, OrderStatus.Refunded],
      })
      .groupBy('o.user_id')
      .orderBy('totalBet', 'DESC')
      .limit(20)
      .getRawMany<GameTopPlayerRow>();

    return {
      daily: daily.map((r) => ({
        date: r.date,
        totalBet: Number(r.totalBet),
        totalPayout: Number(r.totalPayout),
        netRevenue: Number(
          (Number(r.totalBet) - Number(r.totalPayout)).toFixed(2),
        ),
        orderCount: Number(r.orderCount),
        playerCount: Number(r.playerCount),
      })),
      topPlayers: topPlayers.map((r) => ({
        userId: r.userId,
        totalBet: Number(r.totalBet),
        totalWin: Number(r.totalWin),
        orderCount: Number(r.orderCount),
        winRate:
          Number(r.totalBet) > 0
            ? Number(
                ((Number(r.totalWin) / Number(r.totalBet)) * 100).toFixed(2),
              )
            : 0,
      })),
    };
  }

  async getGameRounds(dto: GameRoundsListQuery) {
    const startDate = trimDate(dto.startDate);
    const endDate = trimDate(dto.endDate);
    const qb = this.roundRepo
      .createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC');
    if (dto.gameId) qb.andWhere('r.game_id = :gid', { gid: dto.gameId });
    if (dto.gameIds && dto.gameIds.length > 0)
      qb.andWhere('r.game_id IN (:...gids)', { gids: dto.gameIds });
    if (dto.gameType) qb.andWhere('r.game_type = :gt', { gt: dto.gameType });
    if (dto.status !== undefined)
      qb.andWhere('r.status = :s', { s: dto.status });
    if (dto.search) qb.andWhere('r.round_no LIKE :q', { q: `%${dto.search}%` });
    if (startDate)
      qb.andWhere('r.created_at >= :grStart', {
        grStart: `${startDate} 00:00:00`,
      });
    if (endDate)
      qb.andWhere('r.created_at <= :grEnd', { grEnd: `${endDate} 23:59:59` });
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async setGameControl(
    gameId: number,
    field: 'isPaused' | 'isHidden' | 'emergencyStop',
    value: number,
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    await this.gameRepo.update(gameId, { [field]: value });
    await this.audit.createAuditLog(
      adminId,
      'game_control',
      'game',
      String(gameId),
      { field, value },
    );
    return { success: true, [field]: value };
  }

  async getGameCategories(): Promise<GameCategorySummary[]> {
    const categoryRepo = this.dataSource.getRepository(GameCategory);
    const categories = await categoryRepo.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const counts = await this.gameRepo
      .createQueryBuilder('g')
      .select('g.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'gameCount')
      .where('g.category_id IS NOT NULL')
      .groupBy('g.category_id')
      .getRawMany<{ categoryId: number; gameCount: string }>();
    const countMap = new Map<number, number>();
    for (const row of counts) {
      countMap.set(Number(row.categoryId), Number(row.gameCount));
    }
    return categories.map((category) => {
      const gameCount = countMap.get(category.id);
      return {
        id: category.id,
        categoryName: category.categoryName,
        categoryCode: category.categoryCode,
        sortOrder: category.sortOrder,
        status: category.status,
        gameCount: gameCount !== undefined ? gameCount : 0,
      };
    });
  }

  async setGameCategoryControl(
    categoryId: number,
    field: GameCategoryControlField,
    value: TinyFlag,
    adminId: number,
  ): Promise<GameCategoryControlResult> {
    const categoryRepo = this.dataSource.getRepository(GameCategory);
    const category = await categoryRepo.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    const games = await this.gameRepo.find({ where: { categoryId } });

    let cancelledRounds = 0;
    let refundedOrders = 0;

    if (
      field === GameCategoryControlField.EmergencyStop &&
      value === TinyFlag.Yes
    ) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        for (const game of games) {
          const tally = await this.stopGameWithinTransaction(
            queryRunner.manager,
            game.id,
          );
          cancelledRounds += tally.cancelledRounds;
          refundedOrders += tally.refundedOrders;
        }
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      await this.gameRepo.update({ categoryId }, { [field]: value });
    }

    await this.audit.createAuditLog(
      adminId,
      'game_category_control',
      'game_category',
      String(categoryId),
      {
        categoryName: category.categoryName,
        field,
        value,
        affectedGames: games.length,
        cancelledRounds,
        refundedOrders,
      },
    );

    return {
      success: true,
      field,
      value,
      affectedGames: games.length,
      cancelledRounds,
      refundedOrders,
    };
  }

  private async stopGameWithinTransaction(
    manager: EntityManager,
    gameId: number,
  ): Promise<{ cancelledRounds: number; refundedOrders: number }> {
    let cancelledRounds = 0;
    let refundedOrders = 0;

    await manager.update(GameList, gameId, {
      emergencyStop: TinyFlag.Yes,
    });

    const openRounds = await manager.find(GameRound, {
      where: { gameId, status: RoundStatus.BettingOpen },
    });

    for (const round of openRounds) {
      await manager.update(GameRound, round.id, {
        status: RoundStatus.Cancelled,
      });
      cancelledRounds++;

      const pendingOrders = await manager.find(Order, {
        where: { gameId, roundNo: round.roundNo, status: OrderStatus.Pending },
      });

      for (const order of pendingOrders) {
        await manager.update(Order, order.id, {
          status: OrderStatus.Cancelled,
        });

        if (order.isBonus) {
          await manager
            .createQueryBuilder()
            .update(User)
            .set({
              bonusBalance: () =>
                `bonus_balance + ${Number(order.totalAmount)}`,
            })
            .where('user_id = :userId', { userId: order.userId })
            .execute();
        } else {
          await manager
            .createQueryBuilder()
            .update(User)
            .set({ balance: () => `balance + ${Number(order.totalAmount)}` })
            .where('user_id = :userId', { userId: order.userId })
            .execute();
        }

        const updatedUser = await manager.findOne(User, {
          where: { userId: order.userId },
        });
        if (!updatedUser) {
          throw new NotFoundException(
            `User ${order.userId} not found during refund`,
          );
        }
        await manager.save(
          Transaction,
          manager.create(Transaction, {
            userId: order.userId,
            sourceType: TransactionType.Refund,
            amount: Number(order.totalAmount),
            balance: Number(updatedUser.balance),
            refId: order.orderNo,
            description: 'Emergency stop refund',
          }),
        );
        refundedOrders++;
      }
    }

    return { cancelledRounds, refundedOrders };
  }

  async updateGameCycle(
    gameId: number,
    dto: {
      drawInterval?: number;
      roundDuration?: number;
      stopBetBefore?: number;
      autoGenerate?: boolean;
    },
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');

    const updateData: Partial<GameList> = {};
    if (dto.drawInterval !== undefined)
      updateData.drawInterval = dto.drawInterval;
    if (dto.roundDuration !== undefined)
      updateData.drawInterval = dto.roundDuration;
    if (dto.stopBetBefore !== undefined)
      updateData.stopBetBeforeSec = dto.stopBetBefore;
    if (dto.autoGenerate !== undefined)
      updateData.autoGenerate = dto.autoGenerate ? 1 : 0;

    if (Object.keys(updateData).length > 0) {
      await this.gameRepo.update(gameId, updateData);
    }
    await this.audit.createAuditLog(
      adminId,
      'update_game_cycle',
      'game',
      String(gameId),
      dto,
    );
    return this.gameRepo.findOne({ where: { id: gameId } });
  }

  async deleteGame(id: number, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    await this.gameConfig.deleteAllForGame(id);
    await this.oddsRepo.delete({ gameId: id });
    await this.feeRepo.delete({ gameId: id });
    await this.roundRepo.delete({ gameId: id });
    await this.orderRepo.delete({ gameId: id });
    await this.gameRepo.delete(id);
    await this.audit.createAuditLog(adminId, 'delete_game', 'game', String(id));
  }

  async getGamesLiveStatus() {
    try {
      const games = await this.gameRepo.find({ order: { sortOrder: 'ASC' } });
      const liveData = await Promise.all(
        games.map(async (g) => {
          const currentRound = await this.roundRepo.findOne({
            where: { gameId: g.id, status: 0 },
            order: { id: 'DESC' },
          });
          const recentRounds = await this.roundRepo.find({
            where: { gameId: g.id, status: 2 },
            order: { id: 'DESC' },
            take: 5,
          });
          const todayBets = await this.orderRepo
            .createQueryBuilder('o')
            .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
            .where('o.gameId = :gid AND o.created_at >= :start', {
              gid: g.id,
              start: this.todayStart(),
            })
            .getRawOne<GameTodayBetsRow>()
            .catch((): GameTodayBetsRow => ({ total: '0' }));
          return {
            ...g,
            currentRound: currentRound
              ? {
                  roundNo: currentRound.roundNo,
                  drawTime: currentRound.drawTime,
                  status: currentRound.status,
                }
              : null,
            recentResults: recentRounds.map((r) => ({
              roundNo: r.roundNo,
              result: r.result,
              gameType: r.gameType,
            })),
            todayBetAmount: todayBets ? Number(todayBets.total) : 0,
          };
        }),
      );
      return liveData;
    } catch {
      return [];
    }
  }

  async getRaceFrames(body: {
    gameId?: number;
    pageNo: number;
    pageSize: number;
  }) {
    const { pageNo = 1, pageSize = 20, gameId } = body;
    const qb = this.raceFrameRepo
      .createQueryBuilder('f')
      .orderBy('f.created_at', 'DESC');
    if (gameId) qb.andWhere('f.gameId = :gid', { gid: gameId });
    const [list, total] = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { list, total, pageNo, pageSize };
  }

  private todayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
