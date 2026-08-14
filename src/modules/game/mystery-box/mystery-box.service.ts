import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { GameEngineService } from '../shared/game-engine.service';
import { GameConfigService, BoxItemView } from '../shared/game-config.service';
import { ProfitGuardService } from '../shared/profit-guard.service';
import { MAX_INSTANT_DRAWS } from '../shared/profit-guard.constants';
import { TinyFlag } from '../../../common/enums/tiny-flag.enum';
import { OrderStatus } from '../../../common/enums/order-status.enum';
import {
  MysteryBoxBarrageDto,
  MysteryBoxDrawDto,
  MysteryBoxDrawHistoryDto,
} from './dto/mystery-box-draw.dto';
import { buildOrderNo } from '../../../common/order-no.generator';

const BOX_DRAW_BET_TYPE = 'draw';
const BOX_DRAW_SOURCE_TYPE = 'box_draw';
const BOX_PRIZE_DESCRIPTION = 'Box prize';
const DEFAULT_BOX_COIN_TYPE = 1;
const DEFAULT_BOX_FREE_COUNT = 0;

export interface BoxListItem {
  coinType: number;
  cover: string;
  coverImgID: string;
  freeCount: number;
  gameID: number;
  gameName: string;
  icon: string;
  iconImgID: string;
  items: BoxItemView[];
  price: number;
  emergencyStop: number;
}

interface BoxOrderContent {
  item?: { name?: string };
}

@Injectable()
export class MysteryBoxService {
  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    private gameEngine: GameEngineService,
    private gameConfig: GameConfigService,
    private profitGuard: ProfitGuardService,
  ) {}

  async getGameList() {
    const games = await this.gameListRepo.find({
      where: {
        gameType: 'mystery_box',
        status: 1,
        isHidden: TinyFlag.No,
        emergencyStop: TinyFlag.No,
      },
      order: { sortOrder: 'ASC' },
    });

    const result: BoxListItem[] = [];
    for (const g of games) {
      const boxConfig = await this.gameConfig.getBoxConfig(g.id);
      const items = await this.gameConfig.getBoxItems(g.id);
      result.push({
        coinType: boxConfig ? boxConfig.coinType : DEFAULT_BOX_COIN_TYPE,
        cover: g.bannerUrl ?? '',
        coverImgID: boxConfig?.coverImgId ?? '',
        freeCount: boxConfig ? boxConfig.freeCount : DEFAULT_BOX_FREE_COUNT,
        gameID: g.id,
        gameName: g.gameName,
        icon: boxConfig?.iconUrl ?? g.iconUrl,
        iconImgID: boxConfig?.iconImgId ?? '',
        items,
        price: Number(g.sellingPrice),
        emergencyStop: g.emergencyStop,
      });
    }
    return result;
  }

  async draw(userId: string, dto: MysteryBoxDrawDto) {
    const game = await this.gameListRepo.findOne({
      where: { id: dto.gameID, status: 1 },
    });
    if (!game) throw new BadRequestException('Game not found');
    this.gameEngine.assertPlayable(game);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const requested = Math.floor(dto.count);
    if (!Number.isInteger(requested) || requested < 1) {
      throw new BadRequestException('Invalid draw count');
    }
    const drawCount = Math.min(requested, MAX_INSTANT_DRAWS);

    const isBonus = dto.isBonus ? 1 : 0;
    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    const cost = Number(game.sellingPrice);
    const totalCost = cost * drawCount;

    if (Number(user[balanceField]) < totalCost) {
      throw new BadRequestException('Insufficient balance');
    }

    const items = await this.gameConfig.getBoxItems(dto.gameID);
    const houseEdge = await this.profitGuard.resolveHouseEdge(game);

    const dataSource = this.gameEngine.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderRepo = queryRunner.manager.getRepository(Order);
      const txnRepo = queryRunner.manager.getRepository(Transaction);
      const userRepo = queryRunner.manager.getRepository(User);
      const results: { winItem: string; winAmount: number }[] = [];

      for (let i = 0; i < drawCount; i++) {
        const result = this.pickRandomItem(items);
        const intendedPrize = Number(result.prize);

        const granted = await this.profitGuard.applyHouseEdge(
          dto.gameID,
          cost,
          intendedPrize,
          houseEdge,
          queryRunner,
        );

        const orderNo = buildOrderNo('BX');
        await orderRepo.save(
          orderRepo.create({
            orderNo,
            userId,
            gameId: dto.gameID,
            gameType: game.gameType,
            roundNo: String(Date.now()),
            betType: BOX_DRAW_BET_TYPE,
            betContent: { item: result, granted },
            amount: cost,
            quantity: 1,
            totalAmount: cost,
            odds: 1,
            winAmount: granted,
            isBonus,
            status: granted > 0 ? OrderStatus.Won : OrderStatus.Lost,
          }),
        );

        await this.gameEngine.deductBalance(
          userId,
          cost,
          !!isBonus,
          queryRunner,
        );

        if (granted > 0) {
          await this.gameEngine.creditBalance(
            userId,
            granted,
            orderNo,
            BOX_PRIZE_DESCRIPTION,
            queryRunner,
            !!isBonus,
            { withdrawable: true },
          );
        }

        const updatedUser = await userRepo.findOne({ where: { userId } });
        if (!updatedUser) {
          throw new BadRequestException(
            'User not found after balance deduction',
          );
        }
        await txnRepo.save(
          txnRepo.create({
            userId,
            sourceType: BOX_DRAW_SOURCE_TYPE,
            amount: -cost,
            balance: Number(updatedUser.balance),
            refId: orderNo,
            description: `Mystery Box draw ${game.gameName}`,
          }),
        );

        results.push({ winItem: String(result.itemID), winAmount: granted });
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async drawHistory(userId: string, dto: MysteryBoxDrawHistoryDto) {
    const [list, total] = await this.orderRepo.findAndCount({
      where: { userId, gameId: dto.gameID, gameType: 'mystery_box' },
      order: { createdAt: 'DESC' },
      skip: (dto.pageNo - 1) * dto.pageSize,
      take: dto.pageSize,
    });

    const mapped = list.map((o) => {
      const betContent = (o.betContent ?? null) as BoxOrderContent | null;
      return {
        orderNo: o.orderNo,
        item: betContent?.item ?? {},
        cost: Number(o.totalAmount),
        prize: Number(o.winAmount),
        status: o.status,
        createTime: o.createdAt,
      };
    });

    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async barrage(dto: MysteryBoxBarrageDto) {
    const recent = await this.orderRepo.find({
      where: { gameType: 'mystery_box' },
      order: { createdAt: 'DESC' },
      take: dto.count,
    });

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
      const betContent = (o.betContent ?? null) as BoxOrderContent | null;
      return {
        userPhone: maskedPhone,
        avatar: u?.avatar ?? '',
        item: betContent?.item?.name ?? '',
        prizeAmount: Number(o.winAmount),
        createTime: o.createdAt,
      };
    });
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

  private emptyBoxItem(): BoxItemView {
    return {
      itemID: 0,
      name: 'Empty',
      prize: 0,
      rate: '0',
      icon: '',
      imgID: '',
      link: '',
    };
  }

  private pickRandomItem(items: BoxItemView[]): BoxItemView {
    if (!items.length) return this.emptyBoxItem();

    const weights = items.map((i) => {
      const w = Number(i.rate);
      return Number.isFinite(w) && w > 0 ? w : 0;
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) return this.emptyBoxItem();

    let rand = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      if (weights[i] <= 0) continue;
      rand -= weights[i];
      if (rand <= 0) return { ...items[i] };
    }

    for (let i = items.length - 1; i >= 0; i--) {
      if (weights[i] > 0) return { ...items[i] };
    }
    return this.emptyBoxItem();
  }
}
