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
import { GameKeralaConfig } from '../../../entities/game-kerala-config.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import { GameConfigService } from '../shared/game-config.service';
import {
  KeralaCreateOrderDto,
  KeralaDrawDetailDto,
  KeralaDrawDetailListDto,
  KeralaOrderCustomDto,
  KeralaOrderListDto,
  KeralaRandomOrderDto,
} from './dto/kerala.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

interface KeralaRoundResult {
  drawResult?: string;
  prefix?: string;
  prizes?: Record<string, string | string[]>;
  prizeTiers?: unknown[];
}

interface KeralaBetContent {
  orderGroup?: string;
  numbers?: string;
  insured?: boolean;
}

interface KeralaCodeView {
  orderNo: string;
  code: string;
  numbers: string;
  amount: number;
  prize: number;
  status: number;
  insured: boolean;
}

export interface KeralaOrderGroup {
  orderGroup: string;
  roundNo: string;
  drawNo: string;
  keralaName: string;
  gameName: string;
  icon: string;
  gameId: number;
  createTime: Date;
  drawTime: Date;
  status: number;
  drawResult: string;
  result1st: string;
  totalAmount: number;
  totalPrize: number;
  tags: string;
  codeList: KeralaCodeView[];
  tickets: KeralaCodeView[];
}

@Injectable()
export class KeralaService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
  ) {}

  async getGameInfo(keralaID: number) {
    const game = await this.gameListRepo.findOne({
      where: { id: keralaID, status: 1 },
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
    const drawTimeLong = Math.max(1, drawTimeSec - nowSec);
    const isManual =
      game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;
    const tabs = isManual
      ? await this.buildManualTabs(game.id, currentRound, Date.now())
      : undefined;

    const keralaConfig = await this.gameConfig.getKeralaConfig(game.id);
    const prefix2ndList = await this.gameConfig.getPrefix2ndList(game.id);
    const prizeTiers = await this.gameConfig.getPrizeTiers(game.id);

    const lastResult = (lastRound?.result ?? null) as KeralaRoundResult | null;
    const configPrefix = keralaConfig?.prefix1st ?? null;
    const lastDrawResult = lastResult?.drawResult ?? '';
    const lastDrawPrefix = lastResult?.prefix ?? configPrefix ?? '';

    return {
      keralaID: game.id,
      gameId: game.id,
      keralaName: game.gameName,
      gameName: game.gameName,
      gameCode: game.gameCode,
      gameType: game.gameType,
      icon: game.iconUrl,
      sellingPrice: Number(game.sellingPrice),
      price: Number(game.sellingPrice),
      canInsurance: keralaConfig ? keralaConfig.canInsurance === 1 : true,
      prefix1st: configPrefix ?? '',
      prefix2ndList,
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      drawInterval: game.drawInterval,
      roundNo: currentRound.roundNo,
      drawTime: drawTimeSec,
      drawTimeSec,
      drawTimeLong,
      isManual,
      tabs,
      status: currentRound.status,
      digitCount: this.resolveDigitCount(game, keralaConfig),
      prizeTiers,
      lastCode: lastDrawResult,
      lastPrefix: lastDrawPrefix,
      lastResult: lastRound
        ? {
            roundNo: lastRound.roundNo,
            drawResult: lastDrawResult,
            prefix: lastDrawPrefix,
            prizes: lastResult?.prizes ?? {},
            drawTime: lastRound.drawTime,
          }
        : null,
      rules: await this.gameConfig.getRuleSections(game.id),
      themeColor: game.themeColor,
      thumbnailUrl: game.thumbnailUrl,
    };
  }

  private resolveDigitCount(
    game: GameList,
    keralaConfig: GameKeralaConfig | null,
  ): number {
    if (game.digitCount !== null && game.digitCount !== undefined) {
      return game.digitCount;
    }
    if (keralaConfig) {
      return keralaConfig.ticketLength;
    }
    throw new BadRequestException('Kerala ticket length is not configured');
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
      const result = (r.result ?? null) as KeralaRoundResult | null;
      return {
        roundNo: r.roundNo,
        drawTime: r.drawTime,
        drawTimeLess: Math.max(0, Math.floor((dMs - nowMs) / 1000)),
        status: r.status,
        drawResult: result?.drawResult ?? '',
      };
    });
  }

  async getDrawDetail(dto: KeralaDrawDetailDto) {
    const round = await this.roundRepo.findOne({
      where: { gameId: dto.keralaID, roundNo: dto.roundNo },
    });
    if (!round) throw new BadRequestException('Draw not found');

    const result = (round.result ?? null) as KeralaRoundResult | null;
    return {
      roundNo: round.roundNo,
      keralaID: dto.keralaID,
      drawResult: result?.drawResult ?? '',
      prizes: result?.prizes ?? {},
      prizeTiers: result?.prizeTiers ?? [],
      drawTime: round.drawTime,
      status: round.status,
      totalBet: Number(round.totalBet),
      totalPayout: Number(round.totalPayout),
      result: round.result,
    };
  }

  async getDrawDetailList(dto: KeralaDrawDetailListDto) {
    const pageNo = dto.pageNo;
    const pageSize = dto.size;

    const qb = this.roundRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 2 })
      .orderBy('r.draw_time', 'DESC');

    if (dto.keralaID) {
      qb.andWhere('r.game_id = :gameId', { gameId: dto.keralaID });
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const mapped = list.map((r) => {
      const result = (r.result ?? null) as KeralaRoundResult | null;
      const prizes = result?.prizes ?? {};
      const codeList: { level: string; prize: number; codes: string[] }[] = [];
      const prizeLabels: Record<string, string> = {
        first: '1st',
        second: '2nd',
        third: '3rd',
        fourth: '4th',
        fifth: '5th',
        consolation: 'Cons',
      };
      for (const [key, label] of Object.entries(prizeLabels)) {
        const value = prizes[key];
        if (value !== undefined) {
          codeList.push({
            level: label,
            prize: 0,
            codes: Array.isArray(value) ? value : [value],
          });
        }
      }

      return {
        roundNo: r.roundNo,
        gameId: r.gameId,
        drawResult: result?.drawResult ?? '',
        prizes,
        codeList,
        drawTime: r.drawTime,
        totalBet: Number(r.totalBet),
        totalPayout: Number(r.totalPayout),
      };
    });

    return new PaginatedResponse(mapped, total, pageNo, pageSize);
  }

  async getRandomOrder(userId: string, dto: KeralaRandomOrderDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.keralaID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');

    const keralaConfig = await this.gameConfig.getKeralaConfig(game.id);
    const digitCount = this.resolveDigitCount(game, keralaConfig);
    const count = dto.count;
    const tickets: string[] = [];

    for (let i = 0; i < count; i++) {
      let ticket = '';
      for (let j = 0; j < digitCount; j++) {
        ticket += Math.floor(Math.random() * 10).toString();
      }
      tickets.push(ticket);
    }

    return tickets;
  }

  async getOrderCustom(userId: string, dto: KeralaOrderCustomDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.keralaID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');

    const keralaConfig = await this.gameConfig.getKeralaConfig(game.id);
    const digitCount = this.resolveDigitCount(game, keralaConfig);

    if (dto.code.length !== digitCount) {
      throw new BadRequestException(
        `Ticket must be exactly ${digitCount} digits`,
      );
    }
    if (!/^\d+$/.test(dto.code)) {
      throw new BadRequestException('Ticket must contain only digits');
    }

    return true;
  }

  async createOrder(userId: string, dto: KeralaCreateOrderDto) {
    const keralaID = dto.keralaID;
    const game = await this.gameListRepo.findOne({
      where: { id: keralaID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);
    this.gameEngine.assertLotteryStarted(game);

    const round = await this.roundRepo.findOne({
      where: {
        gameId: keralaID,
        roundNo: dto.roundNo,
        status: 0,
      },
    });
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const tickets: string[] = dto.codes;
    if (!tickets.length)
      throw new BadRequestException('At least one ticket is required');

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    const unitPrice = Number(game.sellingPrice);
    const totalAmount = unitPrice * tickets.length;

    if (!(totalAmount > 0)) {
      throw new BadRequestException('Invalid bet amount');
    }
    this.gameEngine.assertBetWithinLimits(game, totalAmount);
    if (Number(user[balanceField]) < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    const keralaConfig = await this.gameConfig.getKeralaConfig(game.id);
    const digitCount = this.resolveDigitCount(game, keralaConfig);
    for (const ticket of tickets) {
      if (ticket.length !== digitCount) {
        throw new BadRequestException(
          `Each ticket must be exactly ${digitCount} digits`,
        );
      }
    }

    const orderGroup = buildOrderNo('KL');
    const orders: Order[] = [];

    for (const ticket of tickets) {
      const orderNo = buildOrderNo('KLO');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: keralaID,
        gameType: game.gameType,
        roundNo: round.roundNo,
        betType: 'ticket',
        betContent: {
          orderGroup,
          numbers: ticket,
          digitCount,
        },
        amount: unitPrice,
        quantity: 1,
        totalAmount: unitPrice,
        odds: 1,
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
        description: `Kerala bet ${round.roundNo}`,
      }),
    );

    return {
      orderGroup,
      ticketCount: tickets.length,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async createOrderInsurance(userId: string, dto: KeralaCreateOrderDto) {
    const keralaID = dto.keralaID;
    const game = await this.gameListRepo.findOne({
      where: { id: keralaID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);
    this.gameEngine.assertLotteryStarted(game);

    const keralaConfig = await this.gameConfig.getKeralaConfig(keralaID);
    const insuranceRate = keralaConfig
      ? Number(keralaConfig.insuranceRate)
      : 0.1;
    const tickets: string[] = dto.codes;
    if (!tickets.length)
      throw new BadRequestException('At least one ticket is required');
    const unitPrice = Number(game.sellingPrice);
    const ticketCost = unitPrice * tickets.length;
    const insuranceCost = Math.ceil(ticketCost * insuranceRate);
    const totalAmount = ticketCost + insuranceCost;

    const round = await this.roundRepo.findOne({
      where: {
        gameId: keralaID,
        roundNo: dto.roundNo,
        status: 0,
      },
    });
    if (!round)
      throw new BadRequestException('Round not available for betting');
    this.gameEngine.assertBettingOpen(round);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';

    if (!(totalAmount > 0)) {
      throw new BadRequestException('Invalid bet amount');
    }
    this.gameEngine.assertBetWithinLimits(game, totalAmount);
    if (Number(user[balanceField]) < totalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    const digitCount = this.resolveDigitCount(game, keralaConfig);
    for (const ticket of tickets) {
      if (ticket.length !== digitCount) {
        throw new BadRequestException(
          `Each ticket must be exactly ${digitCount} digits`,
        );
      }
    }

    const orderGroup = buildOrderNo('KLI');
    const orders: Order[] = [];

    for (const ticket of tickets) {
      const orderNo = buildOrderNo('KIO');
      const order = this.orderRepo.create({
        orderNo,
        userId,
        gameId: keralaID,
        gameType: game.gameType,
        roundNo: round.roundNo,
        betType: 'ticket_insured',
        betContent: {
          orderGroup,
          numbers: ticket,
          digitCount,
          insured: true,
          insuranceRate,
          insuranceCost: Math.ceil(unitPrice * insuranceRate),
        },
        amount: unitPrice + Math.ceil(unitPrice * insuranceRate),
        quantity: 1,
        totalAmount: unitPrice + Math.ceil(unitPrice * insuranceRate),
        odds: 1,
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
        description: `Kerala insured bet ${round.roundNo}`,
      }),
    );

    return {
      orderGroup,
      ticketCount: tickets.length,
      ticketCost,
      insuranceCost,
      totalAmount,
      balance: Number(updatedUser.balance),
      bonusBalance: Number(updatedUser.bonusBalance),
    };
  }

  async getOrderList(userId: string, dto: KeralaOrderListDto) {
    const pageNo = dto.pageNo;
    const pageSize = dto.size;

    const gameId = dto.keralaID;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (gameId) {
      qb.andWhere('o.game_id = :gameId', { gameId });
    } else if (dto.gameCode) {
      const codeGame = await this.gameListRepo.findOne({
        where: { gameCode: dto.gameCode },
      });
      qb.andWhere('o.game_id = :gameId', {
        gameId: codeGame ? codeGame.id : 0,
      });
    } else {
      qb.andWhere('o.game_type = :gameType', { gameType: GameType.Kerala });
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

    const gameMap = await this.loadGameMap(orders);
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
    const allGroups = this.groupOrders(orders, gameMap, roundMap);
    const orderStatus = dto.orderStatus;
    const filtered =
      orderStatus === undefined || orderStatus === 3
        ? allGroups
        : allGroups.filter((g) => g.status === orderStatus);

    const total = filtered.length;
    const grouped = filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize);

    return new PaginatedResponse(grouped, total, pageNo, pageSize);
  }

  async getLatestDraw(gameType: string) {
    const games = await this.gameListRepo.find({
      where: { gameType, status: 1 },
    });

    if (!games.length) return [];

    const gameIds = games.map((g) => g.id);
    const iconById = new Map(games.map((g) => [g.id, g.iconUrl ?? '']));

    const rounds = await this.roundRepo
      .createQueryBuilder('r')
      .where('r.game_id IN (:...gameIds)', { gameIds })
      .andWhere('r.status = :status', { status: 2 })
      .orderBy('r.draw_time', 'DESC')
      .take(10)
      .getMany();

    return rounds.map((r) => {
      const result = (r.result ?? null) as KeralaRoundResult | null;
      return {
        roundNo: r.roundNo,
        gameId: r.gameId,
        drawResult: result?.drawResult ?? '',
        prizes: result?.prizes ?? {},
        drawTime: r.drawTime,
        icon: iconById.get(r.gameId) ?? '',
      };
    });
  }

  async getShareInfo(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    return {
      inviteCode: user.inviteCode ?? '',
      nickname: user.nickname ?? '',
      avatar: user.avatar,
    };
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
    gameMap: Map<number, GameList>,
    roundMap: Map<string, GameRound>,
  ): KeralaOrderGroup[] {
    const groups: Record<string, KeralaOrderGroup> = {};

    for (const order of orders) {
      const group = `${order.gameId}:${order.roundNo}`;
      const round = roundMap.get(`${order.gameId}:${order.roundNo}`);
      const game = gameMap.get(order.gameId) ?? null;
      const betContent = (order.betContent ?? null) as KeralaBetContent | null;
      const roundResult = (round?.result ?? null) as KeralaRoundResult | null;
      const hasInsurance =
        betContent?.insured === true || order.betType === 'ticket_insured';
      const numbers = betContent?.numbers ?? '';
      if (!groups[group]) {
        groups[group] = {
          orderGroup: betContent?.orderGroup ?? order.orderNo,
          roundNo: order.roundNo,
          drawNo: order.roundNo,
          keralaName: game?.gameName ?? '',
          gameName: game?.gameName ?? '',
          icon: game?.iconUrl ?? '',
          gameId: order.gameId,
          createTime: order.createdAt,
          drawTime: round?.drawTime ?? order.createdAt,
          status: order.status,
          drawResult: roundResult?.drawResult ?? '',
          result1st: roundResult?.drawResult ?? '',
          totalAmount: 0,
          totalPrize: 0,
          tags: '',
          codeList: [],
          tickets: [],
        };
      }
      groups[group].totalAmount += Number(order.totalAmount);
      groups[group].totalPrize += Number(order.winAmount);
      if (hasInsurance && !groups[group].tags.includes('insurance')) {
        groups[group].tags = groups[group].tags
          ? groups[group].tags + ',insurance'
          : 'insurance';
      }
      const codeEntry = {
        orderNo: order.orderNo,
        code: numbers,
        numbers,
        amount: Number(order.totalAmount),
        prize: Number(order.winAmount),
        status: order.status,
        insured: hasInsurance,
      };
      groups[group].codeList.push(codeEntry);
      groups[group].tickets.push(codeEntry);
    }

    const result = Object.values(groups);
    for (const group of result) {
      const statuses = group.codeList.map((c: { status: number }) => c.status);
      group.status = statuses.some((s: number) => s === 0)
        ? 0
        : statuses.some((s: number) => s === 1)
          ? 1
          : 2;
    }
    return result;
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    return this.gameEngine.createRound(game);
  }
}
