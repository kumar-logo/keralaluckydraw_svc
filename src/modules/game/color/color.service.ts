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
  ColorCreateOrderDto,
  ColorDrawHistoryDto,
  ColorOrderItemDto,
  ColorOrderListDto,
} from './dto/color.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface ColorRoundResult {
  number?: number;
}

interface ColorBetContent {
  orderGroup?: string;
  betNum?: string;
  betType?: string;
  betItem?: string;
}

interface ColorTicketView {
  item: string;
  betItem: string;
  amount: number;
  prize: number;
  fee: number;
  status: number;
  createTime: Date;
}

export interface ColorOrderGroup {
  orderGroup: string;
  orderNo: string;
  roundNo: string;
  gameName: string;
  icon: string;
  tabMin: number;
  createTime: Date;
  drawSec: number;
  status: number;
  wonCode: string;
  totalAmount: number;
  totalPrize: number;
  tickets: ColorTicketView[];
}

@Injectable()
export class ColorService {
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

  async getGameInfo(colorID: number, userId?: string) {
    const game = await this.gameListRepo.findOne({
      where: { id: colorID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let currentRound = await this.roundRepo.findOne({
      where: [
        { gameId: colorID, status: 0 },
        { gameId: colorID, status: 1 },
      ],
      order: { drawTime: 'ASC' },
    });

    if (!currentRound) {
      currentRound = await this.createNewRound(game);
    }

    const lastRound = await this.roundRepo.findOne({
      where: {
        gameId: colorID,
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
    const tickets = userId
      ? await this.buildUserRoundTickets(colorID, currentRound.roundNo, userId)
      : [];
    const palette = await this.gameConfig.getColorPaletteMap(game.id);
    const numberColors = await this.gameConfig.getNumberColorMap(game.id);

    return {
      coinType: 1,
      colorID: game.id,
      icon: game.iconUrl ?? '',
      tabMin,
      stopSec,
      lessSec,
      drawTimeSec,
      roundNo: currentRound.roundNo,
      lastRoundNo: lastRound?.roundNo ?? '',
      lastResult:
        ((lastRound?.result ?? null) as ColorRoundResult | null)?.number ??
        null,
      status: currentRound.status,
      palette,
      numberColors,
      tabs,
      tickets,
    };
  }

  async getDrawHistory(dto: ColorDrawHistoryDto) {
    const pageNo = dto.pageNo;
    const size = dto.size;
    const [list, total] = await this.roundRepo.findAndCount({
      where: { gameId: dto.colorID, status: 2 },
      order: { drawTime: 'DESC' },
      skip: (pageNo - 1) * size,
      take: size,
    });

    const mapped = list.map((r) => ({
      issueNo: r.roundNo,
      number: ((r.result ?? null) as ColorRoundResult | null)?.number ?? null,
    }));

    return new PaginatedResponse(mapped, total, pageNo, size);
  }

  async createOrder(userId: string, dto: ColorCreateOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.colorID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let round = await this.roundRepo.findOne({
      where: { gameId: dto.colorID, roundNo: dto.roundNo, status: 0 },
    });
    if (!round && game.autoGenerate === TinyFlag.Yes) {
      round = await this.roundRepo.findOne({
        where: { gameId: dto.colorID, status: 0 },
        order: { drawTime: 'ASC' },
      });
      if (round) dto.roundNo = round.roundNo;
    }
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    let orderItems: ColorOrderItemDto[];
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
      where: { gameId: dto.colorID, status: 1 },
    });
    const oddsMap = new Map(
      oddsConfigs.map((c) => [c.betType, Number(c.odds)]),
    );

    const orderGroup = buildOrderNo('CG');
    const orders: Order[] = [];

    for (const item of orderItems) {
      const betKey = item.betNum;
      const numberOdds = /^\d$/.test(betKey)
        ? oddsMap.get('number')
        : undefined;
      const resolvedOdds =
        oddsMap.get(betKey) ??
        oddsMap.get(`color_${betKey}`) ??
        numberOdds ??
        1;

      const orderNo = buildOrderNo('CO');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: dto.colorID,
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
        description: `Color bet ${dto.roundNo}`,
      }),
    );

    return {
      orderGroup,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async getOrderList(userId: string, dto: ColorOrderListDto) {
    const pageSize = dto.size;
    const game = await this.gameListRepo.findOne({
      where: { id: dto.colorID },
    });
    const tabMin = game ? Math.max(1, Math.round(game.drawInterval / 60)) : 1;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.colorID) {
      qb.andWhere('o.game_id = :gameId', { gameId: dto.colorID });
    } else {
      qb.andWhere('o.game_type = :gameType', { gameType: GameType.Color });
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

  async getDrawResult(colorID: number, roundNo: string) {
    const orders = await this.orderRepo.find({
      where: { gameId: colorID, roundNo, status: 1 },
    });

    const totalPrize = orders.reduce((sum, o) => sum + Number(o.winAmount), 0);

    return { totalPrize };
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
      colorID: g.id,
      tabMin: Math.max(1, Math.round(g.drawInterval / 60)),
      stopSec: g.stopBetBeforeSec,
    }));
  }

  private resolveColorLabel(order: Order): string {
    const betContent = (order.betContent ?? null) as ColorBetContent | null;
    if (betContent?.betItem) return betContent.betItem;
    if (betContent?.betNum) return betContent.betNum;
    if (order.betType) return order.betType;
    return '';
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
      const code = this.resolveColorLabel(o);
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

  private async loadGameMap(orders: Order[]): Promise<Map<number, GameList>> {
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    if (gameIds.length === 0) return new Map<number, GameList>();
    const games = await this.gameListRepo.find({
      where: { id: In(gameIds) },
    });
    return new Map(games.map((g) => [g.id, g]));
  }

  private groupOrders(
    orders: Order[],
    roundMap: Map<string, GameRound>,
    tabMin: number,
    gameMap: Map<number, GameList>,
  ): ColorOrderGroup[] {
    const groups: Record<string, ColorOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(`${order.gameId}:${order.roundNo}`);
      const game = gameMap.get(order.gameId) ?? null;
      const betContent = (order.betContent ?? null) as ColorBetContent | null;
      const roundResult = (round?.result ?? null) as ColorRoundResult | null;
      if (!groups[group]) {
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          orderNo: order.orderNo,
          roundNo: order.roundNo,
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          tabMin: game
            ? Math.max(1, Math.round(game.drawInterval / 60))
            : tabMin,
          createTime: order.createdAt,
          drawSec: round?.drawTime ? new Date(round.drawTime).getTime() : 0,
          status: order.status,
          wonCode:
            roundResult?.number != null ? String(roundResult.number) : '',
          totalAmount: 0,
          totalPrize: 0,
          tickets: [],
        };
      }
      const label = this.resolveColorLabel(order);
      groups[group].totalAmount += Number(order.totalAmount);
      groups[group].totalPrize += Number(order.winAmount);
      groups[group].tickets.push({
        item: label,
        betItem: label,
        amount: Number(order.totalAmount),
        prize: Number(order.winAmount),
        fee: 0,
        status: order.status,
        createTime: order.createdAt,
      });
    }

    const result = Object.values(groups);
    for (const group of result) {
      const statuses = group.tickets.map((t: { status: number }) => t.status);
      group.status = statuses.some((s: number) => s === 0)
        ? 0
        : statuses.some((s: number) => s === 1)
          ? 1
          : 2;
    }
    return result;
  }
}
