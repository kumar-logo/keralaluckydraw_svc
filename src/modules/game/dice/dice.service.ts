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
  DiceCreateOrderDto,
  DiceDrawAnalyzeDto,
  DiceDrawHistoryDto,
  DiceOrderItemDto,
  DiceOrderListDto,
} from './dto/dice.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface DiceRoundResult {
  dice?: number[];
}

interface DiceBetContent {
  orderGroup?: string;
  betNum?: string;
  betType?: string;
  betItem?: string;
}

interface DiceTypeView {
  betItem: string;
  amount: number;
  prize: number;
  basePrice: number;
  status: number;
  createTime: Date;
}

export interface DiceOrderGroup {
  orderGroup: string;
  roundNo: string;
  gameName: string;
  icon: string;
  tabMin: number;
  result: string;
  resultCount: number;
  drawSec: number;
  createTime: Date;
  status: number;
  totalAmount: number;
  totalPrize: number;
  typeList: DiceTypeView[];
}

const DICE_DEFAULT_ODDS: Record<string, number> = {
  sum_big: 2,
  sum_small: 2,
  sum_odd: 2,
  sum_even: 2,
  sum_three: 207,
  sum_four: 69,
  sum_five: 34.5,
  sum_six: 20.7,
  sum_seven: 13.8,
  sum_eight: 9.94,
  sum_nine: 8.28,
  sum_ten: 8.28,
  sum_eleven: 8.28,
  sum_twelve: 9.94,
  sum_thirteen: 13.8,
  sum_fourteen: 20.7,
  sum_fifteen: 34.5,
  sum_sixteen: 69,
  sum_seventeen: 207,
  sum_eighteen: 207,
  leopard_any: 24,
  leopard_one: 207,
  leopard_two: 207,
  leopard_three: 207,
  leopard_four: 207,
  leopard_five: 207,
  leopard_six: 207,
  double_one: 11.04,
  double_two: 11.04,
  double_three: 11.04,
  double_four: 11.04,
  double_five: 11.04,
  double_six: 11.04,
  single_one: 3.45,
  single_two: 3.45,
  single_three: 3.45,
  single_four: 3.45,
  single_five: 3.45,
  single_six: 3.45,
};

@Injectable()
export class DiceService {
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

  async getGameInfo(diceID: number, userId?: string) {
    const game = await this.gameListRepo.findOne({
      where: { id: diceID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let currentRound = await this.roundRepo.findOne({
      where: [
        { gameId: diceID, status: 0 },
        { gameId: diceID, status: 1 },
      ],
      order: { drawTime: 'ASC' },
    });

    if (!currentRound) {
      currentRound = await this.createNewRound(game);
    }

    const lastRound = await this.roundRepo.findOne({
      where: {
        gameId: diceID,
        result: Not(IsNull()),
        drawTime: LessThanOrEqual(new Date()),
      },
      order: { drawTime: 'DESC' },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const drawTimeSec = currentRound.drawTime
      ? Math.floor(new Date(currentRound.drawTime).getTime() / 1000)
      : nowSec + game.drawInterval;
    const stopSec = game.stopBetBeforeSec;
    const lessSec = Math.max(1, drawTimeSec - nowSec);
    const tabMin = Math.max(1, Math.round(game.drawInterval / 60));

    const tabs = await this.getGameTabs(game);
    const odds = await this.getDiceOddsObject(game.id);
    const tickets = userId
      ? await this.buildUserRoundTickets(diceID, currentRound.roundNo, userId)
      : [];

    const lastResult = (lastRound?.result ?? null) as DiceRoundResult | null;
    const lastDiceNums = lastResult?.dice ?? [];
    const lastSum = lastDiceNums.reduce((a: number, b: number) => a + b, 0);
    const lastIsLeopard =
      lastDiceNums.length === 3 &&
      lastDiceNums[0] === lastDiceNums[1] &&
      lastDiceNums[1] === lastDiceNums[2];

    const palette = await this.gameConfig.getColorPaletteMap(game.id);

    return {
      diceID: game.id,
      tabMin,
      stopSec,
      lessSec,
      drawTimeSec,
      roundNo: currentRound.roundNo,
      lastRoundNo: lastRound?.roundNo ?? '',
      lastResult: lastDiceNums.length > 0 ? lastDiceNums.join(',') : '',
      lastTotalCount: lastSum,
      lastIsLeopard,
      status: currentRound.status,
      palette,
      tabs,
      odds,
      tickets,
    };
  }

  async getDrawHistory(dto: DiceDrawHistoryDto) {
    const pageNo = dto.pageNo;
    const size = dto.size;
    const [list, total] = await this.roundRepo.findAndCount({
      where: { gameId: dto.diceID, status: 2 },
      order: { drawTime: 'DESC' },
      skip: (pageNo - 1) * size,
      take: size,
    });

    const mapped = list.map((r) => {
      const result = (r.result ?? null) as DiceRoundResult | null;
      const dice = result?.dice ?? [];
      const totalCount = dice.reduce((a: number, b: number) => a + b, 0);
      return {
        issueNo: r.roundNo,
        result: dice.join(','),
        totalCount,
      };
    });

    return new PaginatedResponse(mapped, total, pageNo, size);
  }

  async getDrawAnalyze(dto: DiceDrawAnalyzeDto) {
    const rounds = await this.roundRepo.find({
      where: { gameId: dto.diceID, status: 2 },
      order: { drawTime: 'DESC' },
      take: dto.size,
    });

    const total = Math.max(1, rounds.length);
    let bigCount = 0;
    let smallCount = 0;
    const faceCounts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };
    let totalDice = 0;

    for (const r of rounds) {
      const result = (r.result ?? null) as DiceRoundResult | null;
      const dice = result?.dice ?? [];
      const sum = dice.reduce((a: number, b: number) => a + b, 0);
      if (sum > 10) bigCount++;
      else smallCount++;

      for (const n of dice) {
        if (n >= 1 && n <= 6) {
          faceCounts[n]++;
          totalDice++;
        }
      }
    }

    const diceTotal = Math.max(1, totalDice);

    return {
      latest: rounds.map((r) => {
        const result = (r.result ?? null) as DiceRoundResult | null;
        return { result: (result?.dice ?? []).join(',') };
      }),
      count1: Math.round((faceCounts[1] / diceTotal) * 100),
      count2: Math.round((faceCounts[2] / diceTotal) * 100),
      count3: Math.round((faceCounts[3] / diceTotal) * 100),
      count4: Math.round((faceCounts[4] / diceTotal) * 100),
      count5: Math.round((faceCounts[5] / diceTotal) * 100),
      count6: Math.round((faceCounts[6] / diceTotal) * 100),
      bigPer: Math.round((bigCount / total) * 100),
      smallPer: Math.round((smallCount / total) * 100),
    };
  }

  async createOrder(userId: string, dto: DiceCreateOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.diceID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let round = await this.roundRepo.findOne({
      where: { gameId: dto.diceID, roundNo: dto.roundNo, status: 0 },
    });
    if (!round && game.autoGenerate === TinyFlag.Yes) {
      round = await this.roundRepo.findOne({
        where: { gameId: dto.diceID, status: 0 },
        order: { drawTime: 'ASC' },
      });
      if (round) dto.roundNo = round.roundNo;
    }
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    let orderItems: DiceOrderItemDto[];
    if (dto.betItem !== undefined && dto.amount !== undefined) {
      orderItems = [
        { betType: dto.betItem, betNum: dto.betItem, amount: dto.amount },
      ];
    } else if (dto.orders && dto.orders.length > 0) {
      orderItems = dto.orders;
    } else {
      throw new BadRequestException('Invalid order payload');
    }

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    const totalAmount = orderItems.reduce((sum, o) => sum + o.amount, 0);

    if (!(totalAmount > 0)) {
      throw new BadRequestException('Invalid bet amount');
    }
    this.gameEngine.assertBetWithinLimits(game, totalAmount);
    if (Number(user[balanceField]) < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    const oddsConfigs = await this.oddsRepo.find({
      where: { gameId: dto.diceID, status: 1 },
    });
    const oddsMap = new Map(
      oddsConfigs.map((c) => [c.betType, Number(c.odds)]),
    );

    const orderGroup = buildOrderNo('DG');
    const orders: Order[] = [];

    for (const item of orderItems) {
      const betKey = item.betNum;
      const resolvedOdds =
        oddsMap.get(betKey) ??
        oddsMap.get(`sum_${betKey}`) ??
        DICE_DEFAULT_ODDS[betKey] ??
        DICE_DEFAULT_ODDS[`sum_${betKey}`];
      if (!resolvedOdds || resolvedOdds <= 0) {
        throw new BadRequestException(`Invalid dice bet: ${betKey}`);
      }

      const orderNo = buildOrderNo('DO');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: dto.diceID,
        gameType: game.gameType,
        roundNo: dto.roundNo,
        betType: item.betType,
        betContent: {
          orderGroup,
          betNum: item.betNum,
          betType: item.betType,
          betItem: item.betNum,
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
        description: `Dice bet ${dto.roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async getOrderList(userId: string, dto: DiceOrderListDto) {
    const pageSize = dto.size;
    const game = await this.gameListRepo.findOne({ where: { id: dto.diceID } });
    const tabMin = game ? Math.max(1, Math.round(game.drawInterval / 60)) : 1;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.diceID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.diceID });
    } else {
      qb.andWhere('o.game_type = :gameType', { gameType: GameType.Dice });
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
    const allGroups = this.groupOrders(orders, roundMap, tabMin, gameMap);
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

  private async loadGameMap(orders: Order[]): Promise<Map<number, GameList>> {
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    if (gameIds.length === 0) return new Map<number, GameList>();
    const games = await this.gameListRepo.find({
      where: { id: In(gameIds) },
    });
    return new Map(games.map((g) => [g.id, g]));
  }

  async getDrawResult(diceID: number, roundNo: string) {
    const orders = await this.orderRepo.find({
      where: { gameId: diceID, roundNo, status: 1 },
    });

    const totalPrize = orders.reduce((sum, o) => sum + Number(o.winAmount), 0);

    return { totalPrize };
  }

  private resolveDiceLabel(order: Order): string {
    const betContent = (order.betContent ?? null) as DiceBetContent | null;
    if (betContent?.betItem) return betContent.betItem;
    if (betContent?.betNum) return betContent.betNum;
    if (order.betType) return order.betType;
    return '';
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    return this.gameEngine.createRound(game);
  }

  private async getGameTabs(game: GameList) {
    const relatedGames = await this.gameListRepo.find({
      where: { gameType: game.gameType, status: 1 },
      order: { sortOrder: 'ASC' },
    });

    return relatedGames.map((g) => ({
      diceID: g.id,
      tabMin: Math.max(1, Math.round(g.drawInterval / 60)),
      stopSec: g.stopBetBeforeSec,
    }));
  }

  private async getDiceOddsObject(
    gameId: number,
  ): Promise<Record<string, number>> {
    const configs = await this.oddsRepo.find({
      where: { gameId, status: 1 },
    });

    const odds: Record<string, number> = { ...DICE_DEFAULT_ODDS };

    if (configs.length > 0) {
      for (const c of configs) {
        odds[c.betType] = Number(c.odds);
      }
    }

    return odds;
  }

  private async buildUserRoundTickets(
    gameId: number,
    roundNo: string,
    userId: string,
  ) {
    const orders = await this.orderRepo.find({
      where: { gameId, roundNo, userId },
      order: { createdAt: 'ASC' },
    });
    return orders.map((o) => {
      const code = this.resolveDiceLabel(o);
      return {
        item: code,
        betItem: code,
        amount: Number(o.totalAmount),
        prize: Number(o.winAmount),
        fee: 0,
        status: o.status,
        createTime: o.createdAt,
      };
    });
  }

  private groupOrders(
    orders: Order[],
    roundMap: Map<string, GameRound>,
    tabMin: number,
    gameMap: Map<number, GameList>,
  ): DiceOrderGroup[] {
    const groups: Record<string, DiceOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(`${order.gameId}:${order.roundNo}`);
      const roundResult = (round?.result ?? null) as DiceRoundResult | null;
      const dice = roundResult?.dice ?? [];
      const game = gameMap.get(order.gameId) ?? null;
      const betContent = (order.betContent ?? null) as DiceBetContent | null;
      if (!groups[group]) {
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          roundNo: order.roundNo,
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          tabMin: game
            ? Math.max(1, Math.round(game.drawInterval / 60))
            : tabMin,
          result: dice.join(','),
          resultCount: dice.reduce((a: number, b: number) => a + b, 0),
          drawSec: round?.drawTime ? new Date(round.drawTime).getTime() : 0,
          createTime: order.createdAt,
          status: order.status,
          totalAmount: 0,
          totalPrize: 0,
          typeList: [],
        };
      }
      groups[group].totalAmount += Number(order.totalAmount);
      groups[group].totalPrize += Number(order.winAmount);
      groups[group].typeList.push({
        betItem: this.resolveDiceLabel(order),
        amount: Number(order.totalAmount),
        prize: Number(order.winAmount),
        basePrice: Number(order.amount),
        status: order.status,
        createTime: order.createdAt,
      });
    }

    const result = Object.values(groups);
    for (const group of result) {
      const statuses = group.typeList.map((t: { status: number }) => t.status);
      group.status = statuses.some((s: number) => s === 0)
        ? 0
        : statuses.some((s: number) => s === 1)
          ? 1
          : 2;
    }
    return result;
  }
}
