import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { GameType } from '../../../common/enums/game-type.enum';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import { GameConfigService } from '../shared/game-config.service';
import { SlatProductView } from '../shared/game-config.types';
import { derivePositionLabels } from '../shared/slat-reading.util';
import { SlatMatchMode, TinyFlag } from '../../../common/enums';
import {
  FourFiveDigitCreateOrderDto,
  FourFiveDigitDrawHistoryDto,
  FourFiveDigitGameInfoDto,
  FourFiveDigitOrderListDto,
} from './dto/four-five-digit.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface FourFiveDigitRoundResult {
  drawResult?: string;
  number?: string | number;
}

export interface FourFiveDigitLatestDrawRow {
  drawNo: string;
  drawResult: string;
  drawTime: Date | null;
  gameName: string;
  icon: string;
}

interface FourFiveDigitBetContent {
  orderGroup?: string;
  numbers?: string;
}

interface FourFiveDigitCodeView {
  orderNo: string;
  betType: string;
  number: string;
  numbers: string;
  count: number;
  pickCount: number;
  amount: number;
  pickAmount: number;
  prize: number;
  winAmount: number;
  status: number;
}

export interface FourFiveDigitOrderGroup {
  orderGroup: string;
  drawNo: string;
  roundNo: string;
  gameId: number;
  gameName: string;
  icon: string;
  createTime: Date;
  drawTime: Date;
  status: number;
  drawResult: string;
  result: string;
  wonCode: string;
  totalAmount: number;
  totalPrize: number;
  winAmount: number;
  codeLists: FourFiveDigitCodeView[];
}

interface FourFiveDigitPickInfo {
  betType: string;
  numbers: string;
  amount: number;
  slatProductId?: number;
  positions?: number[];
  count: number;
}

@Injectable()
export class FourFiveDigitService {
  private static readonly HISTORY_PER_GAME = 10;

  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
  ) {}

  async getGameInfo(dto: FourFiveDigitGameInfoDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    if (this.gameEngine.isBeforeStartDate(game)) {
      return this.gameEngine.buildNotStartedLotteryInfo(game);
    }

    let currentRound = await this.roundRepo.findOne({
      where: [
        { gameId: dto.gameID, status: 0 },
        { gameId: dto.gameID, status: 1 },
      ],
      order: { drawTime: 'ASC' },
    });

    if (!currentRound) {
      const isAdminDrawn =
        game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;
      if (isAdminDrawn) {
        currentRound = await this.roundRepo.findOne({
          where: { gameId: game.id },
          order: { drawTime: 'DESC' },
        });
        if (!currentRound) {
          const scheduledMs = game.scheduledDrawTime
            ? new Date(game.scheduledDrawTime).getTime()
            : 0;
          if (scheduledMs <= Date.now()) {
            throw new BadRequestException(
              'No draw scheduled for this lottery yet',
            );
          }
          currentRound = await this.createNewRound(game);
        }
      } else {
        currentRound = await this.createNewRound(game);
      }
    }

    const lastRound = await this.roundRepo.findOne({
      where: {
        gameId: dto.gameID,
        result: Not(IsNull()),
        drawTime: LessThanOrEqual(new Date()),
      },
      order: { drawTime: 'DESC' },
    });

    const nowMs = Date.now();
    const drawTimeMs = currentRound.drawTime
      ? new Date(currentRound.drawTime).getTime()
      : nowMs + game.drawInterval * 1000;
    const drawTimeLess = Math.max(1, Math.floor((drawTimeMs - nowMs) / 1000));

    const lastRoundResult = (lastRound?.result ??
      null) as FourFiveDigitRoundResult | null;
    const lastResultStr =
      lastRoundResult?.drawResult !== undefined
        ? lastRoundResult.drawResult
        : '00000';
    const pick4Prize = await this.gameConfig.getPickPrizes(game.id, 4);
    const pick5Prize = await this.gameConfig.getPickPrizes(game.id, 5);
    const pickTimes = await this.gameConfig.getPickTimes(game.id);
    const pickInfos = await this.gameConfig.getPickInfos(game.id);
    const pick4Config = await this.gameConfig.getPick4Config(game.id);
    const pick4Price = Number(pick4Config?.pick4Price ?? game.sellingPrice);
    const pick5Price = Number(
      pick4Config?.pick5Price ?? Number(game.sellingPrice) * 2,
    );

    const isManual =
      game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;
    const tabs = isManual
      ? await this.buildManualTabs(game.id, currentRound, nowMs)
      : [
          {
            roundNo: currentRound.roundNo,
            drawTime: currentRound.drawTime,
            drawTimeLess,
          },
        ];

    const slatProducts = await this.gameConfig.getSlatProducts(game.id);
    const positionLabels = derivePositionLabels(game.digitCount, slatProducts);
    const positionColors = await this.gameConfig.getPositionColors(game.id);

    return {
      gameId: game.id,
      gameName: game.gameName,
      gameCode: game.gameCode,
      gameType: game.gameType,
      icon: game.iconUrl,
      sellingPrice: Number(game.sellingPrice),
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      drawInterval: game.drawInterval,
      isManual,
      tabs,
      lastResult: {
        roundNo: lastRound?.roundNo ?? '',
        drawResult: lastResultStr,
        digits: lastResultStr.split('').map(Number),
      },
      lastPrize: 0,
      pick4Price,
      pick5Price,
      pick4Prize: pick4Prize,
      pick5Prize: pick5Prize,
      pickTimes: pickTimes,
      pickInfos,
      slatProducts,
      digitCount: game.digitCount,
      positionLabels,
      positionColors: positionColors.colors,
      positionGradients: positionColors.gradients,
      payRate: [],
      status: currentRound.status,
    };
  }

  private async buildManualTabs(
    gameId: number,
    fallbackRound: GameRound,
    nowMs: number,
  ) {
    const rounds = await this.gameEngine.getManualRounds(gameId);
    const active = rounds.filter((r) => r.status !== 2);
    const source = active.length ? active : [fallbackRound];
    return source.map((r) => {
      const dMs = r.drawTime ? new Date(r.drawTime).getTime() : nowMs;
      const result = (r.result ?? null) as FourFiveDigitRoundResult | null;
      return {
        roundNo: r.roundNo,
        drawTime: r.drawTime,
        drawTimeLess: Math.max(0, Math.floor((dMs - nowMs) / 1000)),
        status: r.status,
        drawResult: result?.drawResult ?? '',
      };
    });
  }

  async drawHistory(dto: FourFiveDigitDrawHistoryDto) {
    const perPage = dto.pageSize;
    const [list, total] = await this.roundRepo.findAndCount({
      where: { gameId: dto.gameID, status: 2 },
      order: { drawTime: 'DESC' },
      skip: (dto.pageNo - 1) * perPage,
      take: perPage,
    });

    const mapped = list.map((r) => {
      const result = (r.result ?? null) as FourFiveDigitRoundResult | null;
      return {
        roundNo: r.roundNo,
        drawNo: r.roundNo,
        drawResult: result?.drawResult ?? '',
        drawTime: r.drawTime,
        result: r.result,
      };
    });

    return new PaginatedResponse(mapped, total, dto.pageNo, perPage);
  }

  async drawHistoryLatest(gameID: number) {
    if (gameID && !isNaN(gameID)) {
      const game = await this.gameListRepo.findOne({
        where: { id: gameID },
      });
      const rounds = await this.roundRepo.find({
        where: { status: 2, gameId: gameID },
        order: { drawTime: 'DESC' },
        take: FourFiveDigitService.HISTORY_PER_GAME,
      });
      return rounds.map((r) => this.toLatestDrawRow(r, game));
    }

    const games = await this.gameListRepo.find({
      where: { gameType: GameType.FourFiveDigit, status: 1 },
    });
    const manualGames = games.filter(
      (g) => g.isLottery === TinyFlag.Yes && g.autoGenerate === TinyFlag.No,
    );
    const autoGames = games.filter(
      (g) => !(g.isLottery === TinyFlag.Yes && g.autoGenerate === TinyFlag.No),
    );

    const manualRows = await this.collectHistoryRows(manualGames);
    const autoRows = await this.collectHistoryRows(autoGames);

    return [...manualRows, ...autoRows];
  }

  // Quick Digits tab: latest results of the AUTO/quick 4-5D games only
  // (auto_generate=1), capped per game so one busy game cannot flood the list.
  async drawHistoryQuick(): Promise<FourFiveDigitLatestDrawRow[]> {
    const autoGames = await this.findGamesByMode(false);
    return this.collectHistoryRows(autoGames);
  }

  // 4-5D tab: FULL history of the MANUAL lotteries only (auto_generate=0),
  // ordered by draw time across all manual games, paginated for "Load More".
  async drawHistoryManual(
    pageNo: number,
    pageSize: number,
  ): Promise<PaginatedResponse<FourFiveDigitLatestDrawRow>> {
    const manualGames = await this.findGamesByMode(true);
    return this.paginateHistoryRows(manualGames, pageNo, pageSize);
  }

  private async findGamesByMode(manual: boolean): Promise<GameList[]> {
    const games = await this.gameListRepo.find({
      where: { gameType: GameType.FourFiveDigit, status: 1 },
    });
    return games.filter((g) => {
      const isManual =
        g.isLottery === TinyFlag.Yes && g.autoGenerate === TinyFlag.No;
      return manual ? isManual : !isManual;
    });
  }

  private async paginateHistoryRows(
    games: GameList[],
    pageNo: number,
    pageSize: number,
  ): Promise<PaginatedResponse<FourFiveDigitLatestDrawRow>> {
    if (!games.length) {
      return new PaginatedResponse<FourFiveDigitLatestDrawRow>(
        [],
        0,
        pageNo,
        pageSize,
      );
    }
    const gameIds = games.map((g) => g.id);
    const gameById = new Map(games.map((g) => [g.id, g]));
    const total = await this.roundRepo.count({
      where: { status: 2, gameId: In(gameIds) },
    });
    const rounds = await this.roundRepo.find({
      where: { status: 2, gameId: In(gameIds) },
      order: { drawTime: 'DESC' },
      skip: (pageNo - 1) * pageSize,
      take: pageSize,
    });
    const rows = rounds.map((r) =>
      this.toLatestDrawRow(r, gameById.get(r.gameId) ?? null),
    );
    return new PaginatedResponse<FourFiveDigitLatestDrawRow>(
      rows,
      total,
      pageNo,
      pageSize,
    );
  }

  private async collectHistoryRows(
    games: GameList[],
  ): Promise<FourFiveDigitLatestDrawRow[]> {
    const blocks: { rows: FourFiveDigitLatestDrawRow[]; latest: number }[] = [];
    for (const game of games) {
      const rounds = await this.roundRepo.find({
        where: { status: 2, gameId: game.id },
        order: { drawTime: 'DESC' },
        take: FourFiveDigitService.HISTORY_PER_GAME,
      });
      if (!rounds.length) continue;
      const latest = rounds[0].drawTime
        ? new Date(rounds[0].drawTime).getTime()
        : 0;
      blocks.push({
        rows: rounds.map((r) => this.toLatestDrawRow(r, game)),
        latest,
      });
    }
    blocks.sort((a, b) => b.latest - a.latest);
    return blocks.flatMap((b) => b.rows);
  }

  private toLatestDrawRow(
    round: GameRound,
    game: GameList | null,
  ): FourFiveDigitLatestDrawRow {
    const result = (round.result ?? null) as FourFiveDigitRoundResult | null;
    return {
      drawNo: round.roundNo,
      drawResult: result?.drawResult ?? '',
      drawTime: round.drawTime,
      gameName: game?.gameName ?? '',
      icon: game?.iconUrl ?? '',
    };
  }

  async createOrder(userId: string, dto: FourFiveDigitCreateOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);
    this.gameEngine.assertLotteryStarted(game);
    const requestedRoundNo = dto.roundNo;

    let round = await this.roundRepo.findOne({
      where: { gameId: dto.gameID, roundNo: requestedRoundNo, status: 0 },
    });
    if (!round && game.autoGenerate === TinyFlag.Yes) {
      round = await this.roundRepo.findOne({
        where: { gameId: dto.gameID, status: 0 },
        order: { drawTime: 'ASC' },
      });
    }
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);
    const roundNo = round.roundNo;

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    const pickInfos: FourFiveDigitPickInfo[] = dto.orders.map((o) => ({
      betType: o.type,
      numbers: o.number,
      amount: o.count * Number(game.sellingPrice),
      slatProductId: o.slatProductId,
      positions: o.positions,
      count: o.count,
    }));

    if (!pickInfos.length) throw new BadRequestException('No picks provided');

    const hasSlat = pickInfos.some((p) => p.slatProductId != null);
    const slatProducts = hasSlat
      ? await this.gameConfig.getSlatProducts(game.id)
      : [];

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';

    const orderGroup = buildOrderNo('P4G');
    const orders: Order[] = [];
    let totalAmount = 0;

    for (const pick of pickInfos) {
      const orderNo = buildOrderNo('P4B');

      if (pick.slatProductId != null) {
        const product = slatProducts.find((p) => p.id === pick.slatProductId);
        if (!product) throw new BadRequestException('Slat product not found');
        const isGroup = product.matchMode === SlatMatchMode.Group;
        const tier = isGroup
          ? product.tiers.find((t) => t.label === pick.betType)
          : [...product.tiers].sort((a, b) => b.tierRank - a.tierRank)[0];
        if (!tier || tier.positions.length === 0) {
          throw new BadRequestException('Slat bet type not found');
        }
        const pickWidth = tier.positions.length;
        if (pick.numbers.length !== pickWidth) {
          throw new BadRequestException(
            `Pick must be exactly ${pickWidth} digits`,
          );
        }
        const storedNumbers = pick.numbers;
        const count = Math.max(1, pick.count);
        const amount = Number(product.price);
        const lineTotal = amount * count;
        totalAmount += lineTotal;
        orders.push(
          this.orderRepo.create({
            orderNo,
            userId,
            gameId: dto.gameID,
            gameType: game.gameType,
            roundNo,
            betType: pick.betType,
            betContent: {
              orderGroup,
              numbers: storedNumbers,
              betType: pick.betType,
              slatProductId: product.id,
              position: pick.betType,
              positions: tier.positions,
              slot: Math.round(amount),
              winPrice: this.slatWinPrice(product, pick.betType),
            },
            amount,
            quantity: count,
            totalAmount: lineTotal,
            odds: this.getOddsByBetType(),
            isBonus,
            status: 0,
          }),
        );
        continue;
      }

      const betTypeStr = pick.betType;
      const expectedLen =
        betTypeStr === '1'
          ? 4
          : betTypeStr === '2'
            ? 5
            : game.digitCount && game.digitCount > 0
              ? game.digitCount
              : 5;
      if (
        !pick.numbers ||
        !/^\d+$/.test(pick.numbers) ||
        pick.numbers.length !== expectedLen
      ) {
        throw new BadRequestException(
          `Pick must be exactly ${expectedLen} digits (0-9 only)`,
        );
      }
      if (!Number.isFinite(pick.amount) || pick.amount <= 0) {
        throw new BadRequestException('Pick amount must be a positive number');
      }
      const resolvedBetType =
        betTypeStr === '1' || betTypeStr === '2'
          ? `exact${expectedLen}`
          : betTypeStr;
      totalAmount += pick.amount;
      orders.push(
        this.orderRepo.create({
          orderNo,
          userId,
          gameId: dto.gameID,
          gameType: game.gameType,
          roundNo,
          betType: resolvedBetType,
          betContent: {
            orderGroup,
            numbers: pick.numbers,
            betType: resolvedBetType,
          },
          amount: Number(game.sellingPrice),
          quantity: Math.max(1, pick.count),
          totalAmount: pick.amount,
          odds: this.getOddsByBetType(),
          isBonus,
          status: 0,
        }),
      );
    }

    if (!(totalAmount > 0)) {
      throw new BadRequestException('Invalid bet amount');
    }
    this.gameEngine.assertBetWithinLimits(game, totalAmount);

    if (Number(user[balanceField]) < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    const betRunner = this.gameEngine.getDataSource().createQueryRunner();
    await betRunner.connect();
    await betRunner.startTransaction();
    try {
      await betRunner.manager.getRepository(Order).save(orders);
      await this.gameEngine.deductBalance(
        userId,
        totalAmount,
        !!isBonus,
        betRunner,
      );
      await betRunner.commitTransaction();
    } catch (betErr) {
      await betRunner.rollbackTransaction();
      throw betErr;
    } finally {
      await betRunner.release();
    }

    await this.roundRepo.update(round.id, {
      totalBet: () => `total_bet + ${totalAmount}`,
    });

    const updatedUser = await this.userRepo.findOne({ where: { userId } });
    if (!updatedUser) {
      throw new BadRequestException('User not found after balance deduction');
    }
    await this.txnRepo.save(
      this.txnRepo.create({
        userId,
        sourceType: 'bet',
        amount: -totalAmount,
        balance: Number(updatedUser.balance),
        refId: orderGroup,
        description: `4 & 5 Digit bet ${roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async orderList(userId: string, dto: FourFiveDigitOrderListDto) {
    const perPage = dto.pageSize;
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.gameID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.gameID });
    } else {
      qb.andWhere('o.game_type = :gameType', {
        gameType: GameType.FourFiveDigit,
      });
    }

    const monthStr = dto.yearMonth;
    if (monthStr) {
      let year: number, month: number;
      if (monthStr.includes('-')) {
        [year, month] = monthStr.split('-').map(Number);
      } else {
        year = Number(monthStr.substring(0, 4));
        month = Number(monthStr.substring(4, 6));
      }
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      qb.andWhere('o.created_at >= :start AND o.created_at < :end', {
        start: `${year}-${pad2(month)}-01 00:00:00`,
        end: `${nextYear}-${pad2(nextMonth)}-01 00:00:00`,
      });
    }

    const orders = await qb.getMany();

    const roundMap = await this.loadRoundMap(orders);
    const gameMap = await this.loadGameMap(orders);
    const allGroups = this.groupOrders(orders, gameMap, roundMap);
    const orderStatus = dto.orderStatus;
    const filtered =
      orderStatus === undefined || orderStatus === 3
        ? allGroups
        : allGroups.filter((g) => g.status === orderStatus);

    const total = filtered.length;
    const grouped = filtered.slice(
      (dto.pageNo - 1) * perPage,
      dto.pageNo * perPage,
    );

    return new PaginatedResponse(grouped, total, dto.pageNo, perPage);
  }

  async shareInfo(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    return {
      inviteCode: user.inviteCode ?? '',
      nickname: user.nickname ?? '',
      avatar: user.avatar,
    };
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    return this.gameEngine.createRound(game);
  }

  private getOddsByBetType(): number {
    return 1;
  }

  private slatWinPrice(product: SlatProductView, label: string): number {
    if (product.matchMode === SlatMatchMode.Group) {
      const tier = product.tiers.find((t) => t.label === label);
      return tier ? Number(tier.winAmount) : 0;
    }
    const top = [...product.tiers].sort((a, b) => b.tierRank - a.tierRank)[0];
    return top ? Number(top.winAmount) : 0;
  }

  private async loadGameMap(orders: Order[]): Promise<Map<number, GameList>> {
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    if (gameIds.length === 0) return new Map<number, GameList>();
    const games = await this.gameListRepo.find({
      where: { id: In(gameIds) },
    });
    return new Map(games.map((g) => [g.id, g]));
  }

  private roundKey(gameId: number, roundNo: string): string {
    return `${gameId}:${roundNo}`;
  }

  private async loadRoundMap(orders: Order[]): Promise<Map<string, GameRound>> {
    if (orders.length === 0) return new Map<string, GameRound>();
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    const roundNos = [...new Set(orders.map((o) => o.roundNo))];
    const rounds = await this.roundRepo
      .createQueryBuilder('r')
      .where('r.game_id IN (:...gameIds)', { gameIds })
      .andWhere('r.round_no IN (:...roundNos)', { roundNos })
      .getMany();
    const map = new Map<string, GameRound>();
    for (const round of rounds) {
      map.set(this.roundKey(round.gameId, round.roundNo), round);
    }
    return map;
  }

  private resultNumber(round: GameRound | undefined): string {
    if (!round || round.status !== 2) return '';
    const result = (round.result ?? null) as FourFiveDigitRoundResult | null;
    if (result?.drawResult !== undefined) return String(result.drawResult);
    if (result?.number !== undefined) return String(result.number);
    return '';
  }

  private resolveGroupStatus(lineStatuses: number[]): number {
    if (lineStatuses.some((s) => s === 1)) return 1;
    if (lineStatuses.length > 0 && lineStatuses.every((s) => s === 2)) return 2;
    return 0;
  }

  private groupOrders(
    orders: Order[],
    gameMap: Map<number, GameList>,
    roundMap: Map<string, GameRound>,
  ): FourFiveDigitOrderGroup[] {
    const groups: Record<string, FourFiveDigitOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(this.roundKey(order.gameId, order.roundNo));
      const game = gameMap.get(order.gameId) ?? null;
      const wonCode = this.resultNumber(round);
      const betContent = (order.betContent ??
        null) as FourFiveDigitBetContent | null;
      if (!groups[group]) {
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          drawNo: order.roundNo,
          roundNo: order.roundNo,
          gameId: order.gameId,
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          createTime: order.createdAt,
          drawTime: round?.drawTime ?? order.createdAt,
          status: order.status,
          drawResult: wonCode,
          result: wonCode,
          wonCode,
          totalAmount: 0,
          totalPrize: 0,
          winAmount: 0,
          codeLists: [],
        };
      }
      const lineAmount = Number(order.totalAmount);
      const lineWin = Number(order.winAmount);
      const number = betContent?.numbers ?? '';
      const quantity = Number(order.quantity);
      const unitAmount = Number(order.amount);
      groups[group].totalAmount += lineAmount;
      groups[group].totalPrize += lineWin;
      groups[group].winAmount += lineWin;
      groups[group].codeLists.push({
        orderNo: order.orderNo,
        betType: order.betType,
        number,
        numbers: number,
        count: quantity,
        pickCount: quantity,
        amount: lineAmount,
        pickAmount: unitAmount,
        prize: lineWin,
        winAmount: lineWin,
        status: order.status,
      });
    }

    for (const group of Object.values(groups)) {
      group.status = this.resolveGroupStatus(
        group.codeLists.map((c: { status: number }) => c.status),
      );
    }

    return Object.values(groups);
  }
}
