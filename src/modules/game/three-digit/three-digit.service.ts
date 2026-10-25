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
  ThreeDigitCreateOrderDto,
  ThreeDigitDrawHistoryDto,
  ThreeDigitGameInfoDto,
  ThreeDigitOrderListDto,
} from './dto/three-digit.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface ThreeDigitRoundResult {
  drawResult?: string;
  number?: string | number;
}

export interface ThreeDigitLatestDrawRow {
  drawNo: string;
  drawResult: string;
  drawTime: Date | null;
  gameName: string;
  icon: string;
}

interface ThreeDigitBetContent {
  orderGroup?: string;
  numbers?: string;
}

interface ThreeDigitCodeView {
  orderNo: string;
  betType: string;
  indexCode: string;
  number: string;
  numbers: string;
  pickCount: number;
  count: number;
  pickAmount: number;
  amount: number;
  winAmount: number;
  prize: number;
  status: number;
}

export interface ThreeDigitOrderGroup {
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
  wonCode: string;
  totalAmount: number;
  winAmount: number;
  codeLists: ThreeDigitCodeView[];
}

interface ThreeDigitPickInfo {
  betType: string;
  numbers: string;
  amount: number;
  slatProductId?: number;
  positions?: number[];
  count: number;
}

@Injectable()
export class ThreeDigitService {
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

  async getGameInfo(dto: ThreeDigitGameInfoDto) {
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

    const nowSec = Math.floor(Date.now() / 1000);
    const drawTimeSec = currentRound.drawTime
      ? Math.floor(new Date(currentRound.drawTime).getTime() / 1000)
      : nowSec + game.drawInterval;

    const isQuick = game.isQuick === 1;
    const isManual =
      game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;

    const pickTimeRows = isQuick
      ? []
      : await this.gameConfig.getPickTimes(game.id);
    const pickTimes = pickTimeRows.map((t) => ({
      ...t,
      roundNo: currentRound.roundNo,
      drawNo: currentRound.roundNo,
      stopBetSec: game.stopBetBeforeSec,
    }));

    const tabs = isManual
      ? await this.buildManualTabs(game.id, currentRound, Date.now())
      : isQuick
        ? await this.getQuickGameTabs()
        : undefined;

    const lastRound = await this.roundRepo.findOne({
      where: {
        gameId: dto.gameID,
        result: Not(IsNull()),
        drawTime: LessThanOrEqual(new Date()),
      },
      order: { drawTime: 'DESC' },
    });
    const lastResult = this.buildLastResult(lastRound);

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
      isQuick,
      isManual,
      drawNo: currentRound.roundNo,
      roundNo: currentRound.roundNo,
      drawTimeLong: Math.max(1, drawTimeSec - nowSec),
      drawTimeSec,
      stopBetSec: game.stopBetBeforeSec,
      pickTimes,
      tabs,
      pickInfos: await this.gameConfig.getPickInfos(game.id),
      slatProducts,
      digitCount: game.digitCount,
      positionLabels,
      positionColors: positionColors.colors,
      positionGradients: positionColors.gradients,
      payRate: [],
      status: currentRound.status,
      lastRoundNo: lastResult?.roundNo ?? '',
      lastResult,
    };
  }

  private buildLastResult(
    round: GameRound | null,
  ): { roundNo: string; drawResult: string; drawTime: Date | null } | null {
    if (!round) return null;
    return {
      roundNo: round.roundNo,
      drawResult: this.resultNumber(round),
      drawTime: round.drawTime ?? null,
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
      return {
        roundNo: r.roundNo,
        drawTime: r.drawTime,
        drawTimeLess: Math.max(0, Math.floor((dMs - nowMs) / 1000)),
        status: r.status,
        drawResult: this.resultNumber(r),
      };
    });
  }

  async drawHistory(dto: ThreeDigitDrawHistoryDto) {
    const gameId = dto.gameID;
    const perPage = dto.size;
    const pageNo = dto.pageNo;
    const [list, total] = await this.roundRepo.findAndCount({
      where: { gameId, status: 2 },
      order: { drawTime: 'DESC' },
      skip: (pageNo - 1) * perPage,
      take: perPage,
    });

    const drawResultList = list.map((r) => {
      const result = (r.result ?? null) as ThreeDigitRoundResult | null;
      return {
        pickNo: r.roundNo,
        roundNo: r.roundNo,
        drawNo: r.roundNo,
        drawResult: result?.drawResult ?? '',
        drawTime: r.drawTime,
        result: r.result,
      };
    });

    return {
      ...new PaginatedResponse(drawResultList, total, pageNo, perPage),
      drawResultList,
    };
  }

  async drawHistoryLatest(gameID: number) {
    if (gameID && !isNaN(gameID)) {
      const game = await this.gameListRepo.findOne({
        where: { id: gameID },
      });
      const rounds = await this.roundRepo.find({
        where: { status: 2, gameId: gameID },
        order: { drawTime: 'DESC' },
        take: ThreeDigitService.HISTORY_PER_GAME,
      });
      return rounds.map((r) => this.toLatestDrawRow(r, game));
    }

    const games = await this.gameListRepo.find({
      where: { gameType: GameType.ThreeDigit, status: 1 },
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

  // Quick Digits tab: latest results of the AUTO/quick digit games only
  // (auto_generate=1), capped per game so one busy game cannot flood the list.
  async drawHistoryQuick(): Promise<ThreeDigitLatestDrawRow[]> {
    const autoGames = await this.findGamesByMode(false);
    return this.collectHistoryRows(autoGames);
  }

  // 3-Digit tab: FULL history of the MANUAL lotteries only (auto_generate=0),
  // ordered by draw time across all manual games, paginated for "Load More".
  async drawHistoryManual(
    pageNo: number,
    pageSize: number,
  ): Promise<PaginatedResponse<ThreeDigitLatestDrawRow>> {
    const manualGames = await this.findGamesByMode(true);
    return this.paginateHistoryRows(manualGames, pageNo, pageSize);
  }

  private async findGamesByMode(manual: boolean): Promise<GameList[]> {
    const games = await this.gameListRepo.find({
      where: { gameType: GameType.ThreeDigit, status: 1 },
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
  ): Promise<PaginatedResponse<ThreeDigitLatestDrawRow>> {
    if (!games.length) {
      return new PaginatedResponse<ThreeDigitLatestDrawRow>(
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
    return new PaginatedResponse<ThreeDigitLatestDrawRow>(
      rows,
      total,
      pageNo,
      pageSize,
    );
  }

  private async collectHistoryRows(
    games: GameList[],
  ): Promise<ThreeDigitLatestDrawRow[]> {
    const blocks: { rows: ThreeDigitLatestDrawRow[]; latest: number }[] = [];
    for (const game of games) {
      const rounds = await this.roundRepo.find({
        where: { status: 2, gameId: game.id },
        order: { drawTime: 'DESC' },
        take: ThreeDigitService.HISTORY_PER_GAME,
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
  ): ThreeDigitLatestDrawRow {
    const result = (round.result ?? null) as ThreeDigitRoundResult | null;
    return {
      drawNo: round.roundNo,
      drawResult: result?.drawResult ?? '',
      drawTime: round.drawTime,
      gameName: game?.gameName ?? '',
      icon: game?.iconUrl ?? '',
    };
  }

  async createOrder(userId: string, dto: ThreeDigitCreateOrderDto) {
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
    const pickInfos: ThreeDigitPickInfo[] = dto.tickets.map((t) => ({
      betType: t.level,
      numbers: t.number,
      amount: t.count * Number(game.sellingPrice),
      slatProductId: t.slatProductId,
      positions: t.positions,
      count: t.count,
    }));

    if (!pickInfos.length) throw new BadRequestException('No picks provided');

    const hasSlat = pickInfos.some((p) => p.slatProductId != null);
    const slatProducts = hasSlat
      ? await this.gameConfig.getSlatProducts(game.id)
      : [];

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';

    const orderGroup = buildOrderNo('P3G');
    const orders: Order[] = [];
    const maxDigits = game.digitCount;
    let totalAmount = 0;

    for (const pick of pickInfos) {
      const orderNo = buildOrderNo('P3O');

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

      if (
        !pick.numbers ||
        !/^\d+$/.test(pick.numbers) ||
        pick.numbers.length > maxDigits
      ) {
        throw new BadRequestException(
          `Pick must be 1 to ${maxDigits} digits (0-9 only)`,
        );
      }
      if (!Number.isFinite(pick.amount) || pick.amount <= 0) {
        throw new BadRequestException('Pick amount must be a positive number');
      }
      totalAmount += pick.amount;
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
            numbers: pick.numbers,
            betType: pick.betType,
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
        description: `3 Digit bet ${roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async orderList(userId: string, dto: ThreeDigitOrderListDto) {
    const perPage = dto.size;
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.gameID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.gameID });
    } else {
      qb.andWhere('o.game_type = :gameType', {
        gameType: GameType.ThreeDigit,
      });
    }

    if (dto.roundNo) {
      qb.andWhere('o.round_no = :roundNo', { roundNo: dto.roundNo });
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

  private async getQuickGameTabs() {
    const siblings = await this.gameListRepo
      .createQueryBuilder('g')
      .where('g.game_type = :gameType', { gameType: GameType.ThreeDigit })
      .andWhere('g.is_quick = 1')
      .andWhere('g.status = 1')
      .orderBy('g.sort_order', 'ASC')
      .addOrderBy('g.draw_interval', 'ASC')
      .getMany();

    return siblings.map((sibling) => {
      const cycleSec = sibling.quickCycleSec ?? sibling.drawInterval;
      const cycleMin = cycleSec / 60;
      return {
        pickThreeID: sibling.id,
        gameId: sibling.id,
        cycle: cycleMin,
        tabMin: cycleMin,
        drawInterval: sibling.drawInterval,
        name: sibling.gameName,
      };
    });
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
    const result = (round.result ?? null) as ThreeDigitRoundResult | null;
    if (result?.drawResult !== undefined) return String(result.drawResult);
    if (result?.number !== undefined) return String(result.number);
    return '';
  }

  private indexCodeFor(numbers: string, betType?: string): string {
    if (!numbers) return '';
    const labels = (betType ?? '').replace(/[^A-Za-z]/g, '');
    return `${labels}=${numbers}`;
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
  ): ThreeDigitOrderGroup[] {
    const groups: Record<string, ThreeDigitOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const game = gameMap.get(order.gameId) ?? null;
      const round = roundMap.get(this.roundKey(order.gameId, order.roundNo));
      const wonCode = this.resultNumber(round);
      const betContent = (order.betContent ??
        null) as ThreeDigitBetContent | null;
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
          wonCode,
          totalAmount: 0,
          winAmount: 0,
          codeLists: [],
        };
      }
      const lineAmount = Number(order.totalAmount);
      const lineWin = Number(order.winAmount);
      const numbers = betContent?.numbers ?? '';
      const quantity = Number(order.quantity);
      const unitAmount = Number(order.amount);
      groups[group].totalAmount += lineAmount;
      groups[group].winAmount += lineWin;
      groups[group].codeLists.push({
        orderNo: order.orderNo,
        betType: order.betType,
        indexCode: this.indexCodeFor(numbers, order.betType),
        number: numbers,
        numbers: numbers,
        pickCount: quantity,
        count: quantity,
        pickAmount: unitAmount,
        amount: lineAmount,
        winAmount: lineWin,
        prize: lineWin,
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
