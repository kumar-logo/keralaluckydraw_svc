import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { GameType } from '../../../common/enums/game-type.enum';
import { TinyFlag } from '../../../common/enums';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import { GameConfigService } from '../shared/game-config.service';
import {
  DubaiCreateOrderDto,
  DubaiDrawHistoryDto,
  DubaiOrderListDto,
} from './dto/dubai.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface DubaiRoundResult {
  drawResult?: string;
  number?: number | null;
  prize?: number;
}

interface DubaiBetContent {
  orderGroup?: string;
  betNum?: string;
  betCode?: string;
}

interface DubaiCodeView {
  orderNo: string;
  betNum: string;
  amount: number;
  prize: number;
  status: number;
}

export interface DubaiOrderGroup {
  orderGroup: string;
  roundNo: string;
  gameName: string;
  icon: string;
  drawTime: Date;
  result: string | number;
  drawSec: number;
  createTime: Date;
  status: number;
  totalAmount: number;
  totalPrize: number;
  codeList: DubaiCodeView[];
}

const DUBAI_DEFAULT_PAY_RATE = 9;
const DUBAI_DEFAULT_RANGE_MIN = 1;
const DUBAI_DEFAULT_RANGE_MAX = 36;

@Injectable()
export class DubaiService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
  ) {}

  async getGameInfo(gameID: number) {
    const game = await this.gameListRepo.findOne({
      where: { id: gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    if (this.gameEngine.isBeforeStartDate(game)) {
      return this.gameEngine.buildNotStartedLotteryInfo(game);
    }

    let currentRound = await this.roundRepo.findOne({
      where: [
        { gameId: game.id, status: 0 },
        { gameId: game.id, status: 1 },
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
        gameId: game.id,
        result: Not(IsNull()),
        drawTime: LessThanOrEqual(new Date()),
      },
      order: { drawTime: 'DESC' },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const drawTimeSec = currentRound.drawTime
      ? Math.floor(new Date(currentRound.drawTime).getTime() / 1000)
      : nowSec + game.drawInterval;
    const lessSec = Math.max(1, drawTimeSec - nowSec);
    const stopBettingSec = game.stopBetBeforeSec;
    const isManual =
      game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;
    const tabs = isManual
      ? await this.buildManualTabs(game.id, currentRound, Date.now())
      : undefined;

    const assets = await this.gameConfig.getGameAssetBundle(game.id);

    const rangeMin =
      Number.isInteger(game.numberMin) &&
      Number(game.numberMin) >= DUBAI_DEFAULT_RANGE_MIN
        ? Number(game.numberMin)
        : DUBAI_DEFAULT_RANGE_MIN;
    const rangeMax =
      Number.isInteger(game.numberMax) && Number(game.numberMax) >= rangeMin
        ? Number(game.numberMax)
        : DUBAI_DEFAULT_RANGE_MAX;

    const defaultOdds =
      game.payRate !== null && game.payRate !== undefined
        ? Number(game.payRate)
        : DUBAI_DEFAULT_PAY_RATE;
    const oddsConfigs = await this.oddsRepo.find({
      where: { gameId: game.id, status: 1 },
    });
    const numberOdds: Record<string, number> = {};
    for (const c of oddsConfigs) {
      const m = /^(?:number_|p1b_)?(\d+)$/.exec(c.betType);
      if (m) numberOdds[m[1]] = Number(c.odds);
    }

    const lastResult = (lastRound?.result ?? null) as DubaiRoundResult | null;
    return {
      gameID: game.id,
      gameName: game.gameName,
      gameCode: game.gameCode,
      gameType: game.gameType,
      icon: game.iconUrl,
      cover: game.bannerUrl ?? '',
      price: Number(game.sellingPrice),
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      drawInterval: game.drawInterval,
      roundNo: currentRound.roundNo,
      drawTimeSec,
      lessSec,
      stopBettingSec,
      isManual,
      tabs,
      status: currentRound.status,
      payRate: defaultOdds,
      numberMin: rangeMin,
      numberMax: rangeMax,
      maxPrize: game.maxPrize,
      numberOdds,
      themeColor: game.themeColor,
      assetIcons: assets.icons,
      assetBackground: assets.background,
      lastPrize: lastResult?.prize ?? 0,
      lastResult: lastRound
        ? {
            roundNo: lastRound.roundNo,
            drawResult: lastResult?.drawResult ?? '',
            number: lastResult?.number ?? null,
            drawTime: lastRound.drawTime,
          }
        : null,
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
      const result = (r.result ?? null) as DubaiRoundResult | null;
      return {
        roundNo: r.roundNo,
        drawTime: r.drawTime,
        drawTimeLess: Math.max(0, Math.floor((dMs - nowMs) / 1000)),
        status: r.status,
        drawResult: result?.drawResult ?? '',
        number: result?.number ?? null,
      };
    });
  }

  async drawHistory(dto: DubaiDrawHistoryDto) {
    const pageSize = dto.pageSize;
    const [list, total] = await this.roundRepo.findAndCount({
      where: { gameId: dto.gameID, status: 2 },
      order: { drawTime: 'DESC' },
      skip: (dto.pageNo - 1) * pageSize,
      take: pageSize,
    });

    const mapped = list.map((r) => {
      const result = (r.result ?? null) as DubaiRoundResult | null;
      return {
        roundNo: r.roundNo,
        result: result?.number ?? result?.drawResult ?? '',
        drawSec: r.drawTime
          ? Math.floor(new Date(r.drawTime).getTime() / 1000)
          : 0,
        drawTime: r.drawTime,
      };
    });

    return new PaginatedResponse(mapped, total, dto.pageNo, pageSize);
  }

  async createOrder(userId: string, dto: DubaiCreateOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);
    this.gameEngine.assertLotteryStarted(game);

    let round = await this.roundRepo.findOne({
      where: { gameId: dto.gameID, roundNo: dto.roundNo, status: 0 },
    });
    if (!round && game.autoGenerate === TinyFlag.Yes) {
      round = await this.roundRepo.findOne({
        where: { gameId: dto.gameID, status: 0 },
        order: { drawTime: 'ASC' },
      });
      if (round) dto.roundNo = round.roundNo;
    }
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    const totalAmount = dto.orders.reduce((sum, o) => sum + o.amount, 0);

    if (!(totalAmount > 0)) {
      throw new BadRequestException('Invalid bet amount');
    }
    this.gameEngine.assertBetWithinLimits(game, totalAmount);

    if (Number(user[balanceField]) < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    const oddsConfigs = await this.oddsRepo.find({
      where: { gameId: dto.gameID, status: 1 },
    });
    const oddsMap = new Map(
      oddsConfigs.map((c) => [c.betType, Number(c.odds)]),
    );
    const defaultOdds =
      game.payRate !== null && game.payRate !== undefined
        ? Number(game.payRate)
        : DUBAI_DEFAULT_PAY_RATE;

    const rangeMin =
      Number.isInteger(game.numberMin) &&
      Number(game.numberMin) >= DUBAI_DEFAULT_RANGE_MIN
        ? Number(game.numberMin)
        : DUBAI_DEFAULT_RANGE_MIN;
    const rangeMax =
      Number.isInteger(game.numberMax) && Number(game.numberMax) >= rangeMin
        ? Number(game.numberMax)
        : DUBAI_DEFAULT_RANGE_MAX;

    const orderGroup = buildOrderNo('P1B');
    const orders: Order[] = [];

    for (const item of dto.orders) {
      const betNum = String(item.number);
      const pickedNum = Number(betNum);
      if (
        !Number.isInteger(pickedNum) ||
        pickedNum < rangeMin ||
        pickedNum > rangeMax
      ) {
        throw new BadRequestException(
          `Number must be between ${rangeMin} and ${rangeMax}`,
        );
      }
      const resolvedOdds =
        oddsMap.get(betNum) ??
        oddsMap.get(`number_${betNum}`) ??
        oddsMap.get(`p1b_${betNum}`) ??
        defaultOdds;

      const orderNo = buildOrderNo('P1O');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: dto.gameID,
        gameType: game.gameType,
        roundNo: dto.roundNo,
        betType: betNum,
        betContent: {
          orderGroup,
          betCode: betNum,
          betNum: betNum,
          betType: betNum,
        },
        amount: item.amount,
        quantity: 1,
        totalAmount: item.amount,
        odds: resolvedOdds,
        isBonus,
        status: 0,
      });
      orders.push(order);
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
        description: `Dubai bet ${dto.roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async orderList(userId: string, dto: DubaiOrderListDto) {
    const pageSize = dto.pageSize;
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.gameID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.gameID });
    } else {
      qb.andWhere('o.game_type = :gameType', { gameType: GameType.Dubai });
    }

    if (dto.yearMonth) {
      const cleaned = dto.yearMonth.replace('-', '');
      const year = Number(cleaned.substring(0, 4));
      const month = Number(cleaned.substring(4, 6));
      if (year && month) {
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        qb.andWhere('o.created_at >= :start AND o.created_at < :end', {
          start: `${year}-${pad2(month)}-01 00:00:00`,
          end: `${nextYear}-${pad2(nextMonth)}-01 00:00:00`,
        });
      }
    }

    const orders = await qb.getMany();

    const roundNos = [...new Set(orders.map((o) => o.roundNo))];
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    const rounds =
      roundNos.length > 0
        ? await this.roundRepo
            .createQueryBuilder('r')
            .where('r.game_id IN (:...gameIds)', { gameIds })
            .andWhere('r.round_no IN (:...roundNos)', { roundNos })
            .getMany()
        : [];
    const roundMap = new Map(
      rounds.map((r) => [`${r.gameId}:${r.roundNo}`, r]),
    );

    const gameMap = await this.loadGameMap(orders);
    const allGroups = this.groupOrders(orders, roundMap, gameMap);
    const orderStatus = dto.orderStatus;
    const filtered =
      orderStatus === undefined || orderStatus === 3
        ? allGroups
        : allGroups.filter((g) => g.status === orderStatus);

    const total = filtered.length;
    const grouped = filtered.slice(
      (dto.pageNo - 1) * pageSize,
      dto.pageNo * pageSize,
    );

    return new PaginatedResponse(grouped, total, dto.pageNo, pageSize);
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    return this.gameEngine.createRound(game);
  }

  private async loadGameMap(orders: Order[]): Promise<Map<number, GameList>> {
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    if (gameIds.length === 0) return new Map<number, GameList>();
    const games = await this.gameListRepo.find({
      where: { id: In(gameIds) },
    });
    return new Map(games.map((g) => [g.id, g]));
  }

  private resolveDubaiBetNum(order: Order): string {
    const betContent = (order.betContent ?? null) as DubaiBetContent | null;
    if (betContent?.betNum) return betContent.betNum;
    if (betContent?.betCode) return betContent.betCode;
    if (order.betType) return order.betType;
    return '';
  }

  private groupOrders(
    orders: Order[],
    roundMap: Map<string, GameRound>,
    gameMap: Map<number, GameList>,
  ): DubaiOrderGroup[] {
    const groups: Record<string, DubaiOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(`${order.gameId}:${order.roundNo}`);
      const game = gameMap.get(order.gameId) ?? null;
      const roundResult = (round?.result ?? null) as DubaiRoundResult | null;
      if (!groups[group]) {
        const betContent = (order.betContent ?? null) as DubaiBetContent | null;
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          roundNo: order.roundNo,
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          drawTime: round?.drawTime ?? order.createdAt,
          result: roundResult?.number ?? roundResult?.drawResult ?? '',
          drawSec: round?.drawTime
            ? Math.floor(new Date(round.drawTime).getTime() / 1000)
            : 0,
          createTime: order.createdAt,
          status: order.status,
          totalAmount: 0,
          totalPrize: 0,
          codeList: [],
        };
      }
      groups[group].totalAmount += Number(order.totalAmount);
      groups[group].totalPrize += Number(order.winAmount);
      groups[group].codeList.push({
        orderNo: order.orderNo,
        betNum: this.resolveDubaiBetNum(order),
        amount: Number(order.totalAmount),
        prize: Number(order.winAmount),
        status: order.status,
      });
    }

    for (const group of Object.values(groups)) {
      const statuses = group.codeList.map((c: { status: number }) => c.status);
      group.status = statuses.some((s: number) => s === 1)
        ? 1
        : statuses.length > 0 && statuses.every((s: number) => s === 2)
          ? 2
          : 0;
    }

    return Object.values(groups);
  }
}
