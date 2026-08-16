import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import {
  GameConfigService,
  WheelSegmentView,
} from '../shared/game-config.service';
import { ProfitGuardService } from '../shared/profit-guard.service';
import { MAX_INSTANT_DRAWS } from '../shared/profit-guard.constants';
import { OrderStatus } from '../../../common/enums/order-status.enum';
import { FindOptionsWhere } from 'typeorm';
import {
  LuckySpinDrawDto,
  LuckySpinDrawHistoryDto,
  LuckySpinFreeHistoryDto,
} from './dto/lucky-spin.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

const WHEEL_FREE_BET_TYPE = 'free';
const WHEEL_PAID_BET_TYPE = 'paid';
const WHEEL_DRAW_SOURCE_TYPE = 'wheel_draw';
const WHEEL_PRIZE_DESCRIPTION = 'Wheel prize';
const DEFAULT_WHEEL_FREE_SPINS = 1;
const DEFAULT_WHEEL_ITEM_COUNT = 12;
const DEFAULT_WHEEL_MULTIPLE_COUNT = 30;
const DEFAULT_BARRAGE_COUNT = 20;

interface WheelBetContent {
  segment?: WheelSegmentView;
}

function segmentWeight(weight: number): number {
  const value = Number(weight);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

@Injectable()
export class LuckySpinService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
    private profitGuard: ProfitGuardService,
  ) {}

  async info(userId: string) {
    const game = await this.gameListRepo.findOne({
      where: { gameType: 'lucky_spin', status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    let freeSpinsUsed = 0;
    if (userId) {
      freeSpinsUsed = await this.orderRepo.count({
        where: { userId, gameId: game.id, betType: 'free' },
      });
    }

    const wheelConfig = await this.gameConfig.getWheelConfig(game.id);
    const maxFreeSpins = wheelConfig
      ? wheelConfig.freeSpins
      : DEFAULT_WHEEL_FREE_SPINS;

    return {
      coinType: 1,
      freeCount: Math.max(0, maxFreeSpins - freeSpinsUsed),
      gameID: game.id,
      image: game.iconUrl ?? '',
      banner: game.bannerUrl ?? '',
      isClose: false,
      itemCount: wheelConfig ? wheelConfig.itemCount : DEFAULT_WHEEL_ITEM_COUNT,
      multipleCount: wheelConfig
        ? wheelConfig.multipleCount
        : DEFAULT_WHEEL_MULTIPLE_COUNT,
      price: Number(game.sellingPrice),
    };
  }

  async draw(userId: string, dto: LuckySpinDrawDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const requested = Math.floor(dto.count);
    if (!Number.isInteger(requested) || requested < 1) {
      throw new BadRequestException('Invalid spin count');
    }
    const count = Math.min(requested, MAX_INSTANT_DRAWS);

    const segments = await this.gameConfig.getWheelSegments(dto.gameID);
    const cost = Number(game.sellingPrice);
    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    const houseEdge = await this.profitGuard.resolveHouseEdge(game);

    const wheelConfig = await this.gameConfig.getWheelConfig(dto.gameID);
    const maxFreeSpins = wheelConfig
      ? wheelConfig.freeSpins
      : DEFAULT_WHEEL_FREE_SPINS;
    const freeSpinsUsed = await this.orderRepo.count({
      where: { userId, gameId: dto.gameID, betType: WHEEL_FREE_BET_TYPE },
    });
    const freeAvailable = Math.max(0, maxFreeSpins - freeSpinsUsed);
    const freeCount = Math.min(freeAvailable, count);
    const paidCount = count - freeCount;
    const totalCost = cost * paidCount;

    if (totalCost > 0 && Number(user[balanceField]) < totalCost) {
      throw new BadRequestException('Insufficient balance');
    }

    const spins = Array.from({ length: count }, (_, i) => {
      const { segment, index } = this.pickSegment(segments);
      return {
        segment,
        index,
        betType: i < freeCount ? WHEEL_FREE_BET_TYPE : WHEEL_PAID_BET_TYPE,
      };
    });

    const dataSource = this.gameEngine.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (totalCost > 0) {
        await this.gameEngine.deductBalance(
          userId,
          totalCost,
          !!isBonus,
          queryRunner,
        );
      }

      const orderRepo = queryRunner.manager.getRepository(Order);
      const txnRepo = queryRunner.manager.getRepository(Transaction);
      const stamp = Date.now();
      const roundNo = String(stamp);

      const grantedBySpin: number[] = [];
      let totalGranted = 0;

      for (let i = 0; i < spins.length; i++) {
        const spin = spins[i];
        const spinCost = spin.betType === WHEEL_FREE_BET_TYPE ? 0 : cost;
        const intendedPrize = Number(spin.segment.prize);

        const granted = await this.profitGuard.applyHouseEdge(
          dto.gameID,
          spinCost,
          intendedPrize,
          houseEdge,
          queryRunner,
        );
        grantedBySpin.push(granted);
        totalGranted += granted;

        const orderNo = buildOrderNo('LW');
        await orderRepo.save(
          orderRepo.create({
            orderNo,
            userId,
            gameId: dto.gameID,
            gameType: game.gameType,
            roundNo,
            betType: spin.betType,
            betContent: { segment: spin.segment, granted },
            amount: spinCost,
            quantity: 1,
            totalAmount: spinCost,
            odds: spin.segment.odds > 0 ? spin.segment.odds : 1,
            winAmount: granted,
            isBonus,
            status: granted > 0 ? OrderStatus.Won : OrderStatus.Lost,
          }),
        );
      }

      const headlineIndex = grantedBySpin.reduce(
        (best, granted, i) => (granted > grantedBySpin[best] ? i : best),
        0,
      );

      const batchOrderNo = buildOrderNo('LW');

      if (totalGranted > 0) {
        await this.gameEngine.creditBalance(
          userId,
          totalGranted,
          batchOrderNo,
          WHEEL_PRIZE_DESCRIPTION,
          queryRunner,
          !!isBonus,
          { withdrawable: true },
        );
      }

      const afterUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });
      if (!afterUser) {
        throw new BadRequestException('User not found after balance update');
      }
      await txnRepo.save(
        txnRepo.create({
          userId,
          sourceType: WHEEL_DRAW_SOURCE_TYPE,
          amount: -totalCost,
          balance: Number(afterUser.balance),
          refId: batchOrderNo,
          description: `Lucky Wheel spin x${count}`,
        }),
      );

      await queryRunner.commitTransaction();

      return {
        prizeIndex: spins[headlineIndex].index,
        prizeAmount: totalGranted,
        prizeSpin: 0,
        count,
        spins: spins.map((s, i) => ({
          prizeIndex: s.index,
          prizeAmount: grantedBySpin[i],
        })),
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async drawHistory(userId: string, dto: LuckySpinDrawHistoryDto) {
    const orders = await this.orderRepo.find({
      where: { userId, gameId: dto.gameID },
      order: { createdAt: 'DESC' },
    });

    const batchMap = new Map<
      string,
      {
        roundNo: string;
        orderNo: string;
        segment: WheelSegmentView;
        betAmount: number;
        prizeAmount: number;
        prizeSpin: number;
        betType: string;
        count: number;
        winningSegment?: WheelSegmentView;
        status: OrderStatus;
        createTime: Date;
      }
    >();
    const batchOrder: string[] = [];

    for (const o of orders) {
      const key = o.roundNo ? o.roundNo : o.orderNo;
      const win = Number(o.winAmount);
      const bet = Number(o.totalAmount);
      const betContent = (o.betContent ?? null) as WheelBetContent | null;
      const segment = betContent?.segment ?? this.emptySegment();
      let batch = batchMap.get(key);
      if (!batch) {
        batch = {
          roundNo: key,
          orderNo: o.orderNo,
          segment,
          betAmount: 0,
          prizeAmount: 0,
          prizeSpin: 0,
          betType: o.betType,
          count: 0,
          winningSegment: undefined,
          status: OrderStatus.Lost,
          createTime: o.createdAt,
        };
        batchMap.set(key, batch);
        batchOrder.push(key);
      }
      batch.betAmount += bet;
      batch.prizeAmount += win;
      batch.count += 1;
      if (win > 0) {
        batch.status = OrderStatus.Won;
        if (!batch.winningSegment) batch.winningSegment = segment;
      }
    }

    const batches = batchOrder.map((key) => {
      const b = batchMap.get(key)!;
      return {
        orderNo: b.orderNo,
        roundNo: b.roundNo,
        segment: b.winningSegment ?? b.segment,
        betAmount: b.betAmount,
        prizeAmount: b.prizeAmount,
        prizeSpin: b.prizeSpin,
        betType: b.betType,
        count: b.count,
        status: b.status,
        createTime: b.createTime,
      };
    });

    const total = batches.length;
    const start = (dto.pageNo - 1) * dto.pageSize;
    const paged = batches.slice(start, start + dto.pageSize);

    return new PaginatedResponse(paged, total, dto.pageNo, dto.pageSize);
  }

  async freeHistory(userId: string, dto: LuckySpinFreeHistoryDto) {
    const take = dto.pageSize;
    const skip = (dto.pageNo - 1) * take;

    const where: FindOptionsWhere<Order> = {
      userId,
      betType: 'free',
      gameType: 'lucky_spin',
    };
    if (dto.gameID) where.gameId = dto.gameID;

    const records = await this.orderRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const userIds = [...new Set(records.map((o) => o.userId))];
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.userId IN (:...userIds)', {
        userIds: userIds.length ? userIds : [''],
      })
      .getMany();
    const userMap = new Map(users.map((u) => [u.userId, u]));

    const list = records.map((o) => {
      const u = userMap.get(o.userId);
      return {
        avatar: u?.avatar ?? '',
        nickName: u?.nickname ?? '',
        count: 1,
        time: o.createdAt,
      };
    });

    return { list };
  }

  async barrage(count: number = DEFAULT_BARRAGE_COUNT) {
    const recentWins = await this.orderRepo.find({
      where: { gameType: 'lucky_spin', winAmount: MoreThan(0) },
      order: { createdAt: 'DESC' },
      take: count * 5,
    });

    const bestByUser = new Map<string, Order>();
    for (const o of recentWins) {
      const prev = bestByUser.get(o.userId);
      if (!prev || Number(o.winAmount) > Number(prev.winAmount)) {
        bestByUser.set(o.userId, o);
      }
    }
    const recent = [...bestByUser.values()]
      .sort((a, b) => Number(b.winAmount) - Number(a.winAmount))
      .slice(0, count);

    const userIds = [...new Set(recent.map((o) => o.userId))];
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.userId IN (:...userIds)', {
        userIds: userIds.length ? userIds : [''],
      })
      .getMany();
    const userMap = new Map(users.map((u) => [u.userId, u]));

    return recent.map((o) => {
      const u = userMap.get(o.userId);
      const phone = u?.phone ?? '';
      const maskedPhone =
        phone.length >= 6
          ? phone.slice(0, 3) + '****' + phone.slice(-3)
          : phone;
      const betContent = (o.betContent ?? null) as WheelBetContent | null;
      return {
        userPhone: maskedPhone,
        avatar: u?.avatar ?? '',
        segment: betContent?.segment?.name ?? '',
        prizeAmount: Number(o.winAmount),
        createTime: o.createdAt,
      };
    });
  }

  private emptySegment(): WheelSegmentView {
    return { name: 'Empty', prize: 0, weight: 1, odds: 1 };
  }

  private pickSegment(segments: WheelSegmentView[]): {
    segment: WheelSegmentView;
    index: number;
  } {
    if (!segments.length) return { segment: this.emptySegment(), index: 0 };

    const totalWeight = segments.reduce(
      (sum, s) => sum + segmentWeight(s.weight),
      0,
    );
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < segments.length; i++) {
      const w = segmentWeight(segments[i].weight);
      if (w <= 0) continue;
      rand -= w;
      if (rand <= 0) return { segment: { ...segments[i] }, index: i };
    }

    for (let i = segments.length - 1; i >= 0; i--) {
      if (segmentWeight(segments[i].weight) > 0)
        return { segment: { ...segments[i] }, index: i };
    }
    return { segment: { ...segments[0] }, index: 0 };
  }
}
