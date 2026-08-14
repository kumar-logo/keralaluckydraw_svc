import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { GameType } from '../../../common/enums/game-type.enum';
import { TinyFlag } from '../../../common/enums';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { RaceRunnerFrame } from '../../../entities/race-runner-frame.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import { GameConfigService } from '../shared/game-config.service';
import {
  generateRaceResult,
  generateRaceFrames,
} from '../shared/draw-generators/race.generator';
import {
  RaceCreateOrderDto,
  RaceDrawHistoryDto,
  RaceOrderListDto,
} from './dto/race.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface RaceRoundResult {
  top3?: string;
  positions?: number[];
}

interface RaceBetContent {
  orderGroup?: string;
  betNum?: string;
  numbers?: string;
  runnerCount?: number;
}

interface RaceCodeView {
  orderNo: string;
  type: number;
  betNum: string;
  amount: number;
  prize: number;
  status: number;
}

export interface RaceOrderGroup {
  orderGroup: string;
  roundNo: string;
  gameId: number;
  gameName: string;
  icon: string;
  createTime: Date;
  drawTime: Date;
  status: number;
  resultTop3: string;
  runnerCount: number;
  totalAmount: number;
  totalPrize: number;
  codeList: RaceCodeView[];
}

const RACE_DEFAULT_RUNNER_COUNT_SIX = 6;
const RACE_DEFAULT_RUNNER_COUNT_TWELVE = 12;

@Injectable()
export class RaceService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(RaceRunnerFrame)
    private frameRepo: Repository<RaceRunnerFrame>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
  ) {}

  async getGameInfo(gameID: number, userId?: string) {
    const game = await this.gameListRepo.findOne({
      where: { id: gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let currentRound = await this.roundRepo.findOne({
      where: [
        { gameId: gameID, status: 0 },
        { gameId: gameID, status: 1 },
      ],
      order: { drawTime: 'ASC' },
    });

    if (!currentRound) {
      currentRound = await this.createNewRound(game);
    }

    const lastRound = await this.roundRepo.findOne({
      where: {
        gameId: gameID,
        result: Not(IsNull()),
        drawTime: LessThanOrEqual(new Date()),
      },
      order: { drawTime: 'DESC' },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const drawTimeSec = currentRound.drawTime
      ? Math.floor(new Date(currentRound.drawTime).getTime() / 1000)
      : nowSec + game.drawInterval;
    const stopBettingSec = game.stopBetBeforeSec;
    const frameSec = stopBettingSec - 2;
    const stopBettingTimestamp = drawTimeSec - stopBettingSec;
    const frameTimestamp = drawTimeSec - frameSec;
    const betLessSec = stopBettingTimestamp - nowSec;

    const tabs = await this.getGameTabs(game);
    const last100Top1 = await this.getLast100Top1(gameID);
    const raceConfig = await this.gameConfig.getRaceConfig(game.id);
    const runnerCount =
      raceConfig?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_SIX;
    const raceRunners = await this.gameConfig.getRaceRunners(game.id);
    const lastPrize =
      userId && lastRound
        ? await this.getUserRoundPrize(gameID, lastRound.roundNo, userId)
        : 0;

    return {
      gameID: game.id,
      gameName: game.gameName,
      gameCode: game.gameCode,
      gameType: game.gameType,
      icon: game.iconUrl,
      sellingPrice: Number(game.sellingPrice),
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      drawInterval: game.drawInterval,
      roundNo: currentRound.roundNo,
      drawTimeSec,
      stopBettingTimestamp,
      stopBettingSec,
      frameTimestamp,
      frameSec,
      betLessSec,
      status: currentRound.status,
      payRate: await this.getRacePayRate(game),
      runnerCount,
      raceRunners,
      lastPrize,
      lastResult: lastRound
        ? {
            roundNo: lastRound.roundNo,
            resultTop3:
              ((lastRound.result ?? null) as RaceRoundResult | null)?.top3 ??
              '',
            result: lastRound.result,
          }
        : null,
      tabs,
      last100Top1,
    };
  }

  async createOrder(userId: string, dto: RaceCreateOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

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

    const raceConfig = await this.gameConfig.getRaceConfig(dto.gameID);
    const runnerCount =
      raceConfig?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_TWELVE;
    const orderGroup = buildOrderNo('RG');
    const orders: Order[] = [];

    for (const item of dto.orders) {
      const betType = item.orderType;
      const betNum = item.betNum;
      if (!betNum) {
        throw new BadRequestException('Bet selection is required');
      }

      const orderNo = buildOrderNo('RO');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: dto.gameID,
        gameType: game.gameType,
        roundNo: dto.roundNo,
        betType: String(betType),
        betContent: {
          orderGroup,
          numbers: betNum,
          betType: betType,
          betNum: betNum,
          runnerCount,
        },
        amount: item.amount,
        quantity: 1,
        totalAmount: item.amount,
        odds: await this.getOddsByBetType(game, betType),
        isBonus,
        status: 0,
      });
      orders.push(order);
    }

    await this.orderRepo.save(orders);

    await this.gameEngine.deductBalance(userId, totalAmount, !!isBonus);

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
        description: `Race bet ${dto.roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async getDrawHistory(dto: RaceDrawHistoryDto) {
    const pageNo = dto.pageNo;
    const pageSize = dto.pageSize;

    const baseQuery = () =>
      this.roundRepo
        .createQueryBuilder('r')
        .where('r.gameId = :gameID', { gameID: dto.gameID })
        .andWhere('r.status = :status', { status: 2 })
        .andWhere('r.result IS NOT NULL')
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(r.result, '$.top3')) <> ''");

    const total = await baseQuery().getCount();
    const list = await baseQuery()
      .orderBy('r.drawTime', 'DESC')
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const mapped = list.map((r) => {
      const result = (r.result ?? null) as RaceRoundResult | null;
      return {
        roundNo: r.roundNo,
        resultTop3: result?.top3 ?? '',
        result: r.result,
        drawTime: r.drawTime,
      };
    });

    return new PaginatedResponse(mapped, total, pageNo, pageSize);
  }

  async getOrderList(userId: string, dto: RaceOrderListDto) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.gameID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.gameID });
    } else {
      qb.andWhere('o.game_type = :gameType', { gameType: GameType.Race });
    }

    if (dto.yearMonth) {
      const cleaned = dto.yearMonth.replace('-', '');
      const year = Number(cleaned.substring(0, 4));
      const month = Number(cleaned.substring(4, 6));
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      qb.andWhere('o.created_at >= :start AND o.created_at < :end', {
        start: `${year}-${pad2(month)}-01 00:00:00`,
        end: `${nextYear}-${pad2(nextMonth)}-01 00:00:00`,
      });
    }

    const orders = await qb.getMany();

    const roundNos = [...new Set(orders.map((o) => o.roundNo))];
    const roundGameIds = [...new Set(orders.map((o) => o.gameId))];
    const rounds =
      roundNos.length && roundGameIds.length
        ? await this.roundRepo
            .createQueryBuilder('r')
            .where('r.game_id IN (:...roundGameIds)', { roundGameIds })
            .andWhere('r.round_no IN (:...roundNos)', { roundNos })
            .getMany()
        : [];
    const roundMap = new Map(
      rounds.map((r) => [`${r.gameId}:${r.roundNo}`, r]),
    );
    const gameMap = await this.loadGameMap(orders);
    const allGroups = this.groupOrders(orders, gameMap, roundMap);
    const orderStatus = dto.orderStatus;
    const filtered =
      orderStatus === undefined || orderStatus === 3
        ? allGroups
        : allGroups.filter((g) => g.status === orderStatus);

    const total = filtered.length;
    const grouped = filtered.slice(
      (dto.pageNo - 1) * dto.pageSize,
      dto.pageNo * dto.pageSize,
    );

    return new PaginatedResponse(grouped, total, dto.pageNo, dto.pageSize);
  }

  async getRunnerFrames(gameID: number) {
    const raceConfig = await this.gameConfig.getRaceConfig(gameID);
    const runnerCount =
      raceConfig?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_SIX;

    const latestRound = await this.roundRepo.findOne({
      where: { gameId: gameID },
      order: { createdAt: 'DESC' },
    });

    if (latestRound) {
      const frame = await this.frameRepo.findOne({
        where: { gameId: gameID, roundNo: latestRound.roundNo },
      });
      if (Array.isArray(frame?.frames) && frame.frames.length)
        return frame.frames;

      const resultPositions = (
        latestRound.result as { positions?: number[] } | null
      )?.positions;
      if (resultPositions?.length) {
        return generateRaceFrames(resultPositions);
      }
    }

    const { positions } = generateRaceResult(runnerCount);
    return generateRaceFrames(positions);
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    return this.gameEngine.createRound(game);
  }

  private async getGameTabs(game: GameList) {
    const relatedGames = await this.gameListRepo.find({
      where: { gameType: game.gameType, status: 1 },
      order: { sortOrder: 'ASC' },
    });

    const tabs: { id: number; name: string; count: number }[] = [];
    for (const g of relatedGames) {
      const raceConfig = await this.gameConfig.getRaceConfig(g.id);
      tabs.push({
        id: g.id,
        name: g.gameName,
        count: raceConfig?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_TWELVE,
      });
    }
    return tabs;
  }

  private async getUserRoundPrize(
    gameID: number,
    roundNo: string,
    userId: string,
  ): Promise<number> {
    const orders = await this.orderRepo.find({
      where: { gameId: gameID, roundNo, userId, status: 1 },
    });
    return orders.reduce((sum, o) => sum + Number(o.winAmount), 0);
  }

  private async getLast100Top1(
    gameID: number,
  ): Promise<Record<string, number>> {
    const last100 = await this.roundRepo.find({
      where: { gameId: gameID, status: 2 },
      order: { drawTime: 'DESC' },
      take: 100,
    });

    const counts: Record<string, number> = {};
    for (const r of last100) {
      const result = (r.result ?? null) as RaceRoundResult | null;
      const top3 = result?.top3 ?? '';
      const winner = top3.split(',')[0];
      if (winner) {
        const current = counts[winner];
        counts[winner] = (current === undefined ? 0 : current) + 1;
      }
    }
    return counts;
  }

  private async getRacePayRate(
    game: GameList,
  ): Promise<{ type: number; odds: number }[]> {
    const raceConfig = await this.gameConfig.getRaceConfig(game.id);
    const runnerCount =
      raceConfig?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_SIX;

    const sixPlayerSet = [
      { type: 1, odds: 5.4 },
      { type: 4, odds: 1.85 },
      { type: 5, odds: 17 },
    ];
    const twelvePlayerSet = [
      { type: 1, odds: 10 },
      { type: 2, odds: 1000 },
      { type: 3, odds: 5 },
    ];

    return runnerCount >= 12 ? twelvePlayerSet : sixPlayerSet;
  }

  private async getOddsByBetType(
    game: GameList,
    betType: number,
  ): Promise<number> {
    const payRate = await this.getRacePayRate(game);
    const rate = payRate.find((p) => p.type === betType);
    return rate?.odds || 1;
  }

  private async loadGameMap(orders: Order[]): Promise<Map<number, GameList>> {
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    if (gameIds.length === 0) return new Map<number, GameList>();
    const games = await this.gameListRepo.find({
      where: { id: In(gameIds) },
    });
    return new Map(games.map((g) => [g.id, g]));
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
  ): RaceOrderGroup[] {
    const groups: Record<string, RaceOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(`${order.gameId}:${order.roundNo}`);
      const game = gameMap.get(order.gameId) ?? null;
      const betContent = (order.betContent ?? null) as RaceBetContent | null;
      const roundResult = (round?.result ?? null) as RaceRoundResult | null;
      if (!groups[group]) {
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          roundNo: order.roundNo,
          gameId: order.gameId,
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          createTime: order.createdAt,
          drawTime: round?.drawTime ?? order.createdAt,
          status: order.status,
          resultTop3: roundResult?.top3 ?? '',
          runnerCount:
            betContent?.runnerCount ?? RACE_DEFAULT_RUNNER_COUNT_TWELVE,
          totalAmount: 0,
          totalPrize: 0,
          codeList: [],
        };
      }
      const lineBetNum = betContent?.betNum ?? betContent?.numbers ?? '';
      groups[group].totalAmount += Number(order.totalAmount);
      groups[group].totalPrize += Number(order.winAmount);
      groups[group].codeList.push({
        orderNo: order.orderNo,
        type: Number(order.betType),
        betNum: lineBetNum,
        amount: Number(order.totalAmount),
        prize: Number(order.winAmount),
        status: order.status,
      });
    }

    for (const group of Object.values(groups)) {
      group.status = this.resolveGroupStatus(
        group.codeList.map((c: { status: number }) => c.status),
      );
    }

    return Object.values(groups);
  }
}
