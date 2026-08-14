import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../../../entities/order.entity';
import { Message } from '../../../entities/message.entity';
import { MessageImage } from '../../../entities/message-image.entity';
import { MessageRead } from '../../../entities/message-read.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../../entities/withdrawal-record.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { User } from '../../../entities/user.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { PaymentGatewayMode, MessageType } from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';
import { WsGateway } from '../../websocket/ws.gateway';
import { FcmService } from '../../fcm/fcm.service';
import { CreateMessageDto } from '../dto/admin.dto';
import { OrdersListQuery, trimDate } from './admin-filter.types';

interface UsernameInfo {
  nickname: string;
  phone: string;
  avatar: string;
}

@Injectable()
export class AdminOperationsService {
  private readonly logger = new Logger(AdminOperationsService.name);

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(MessageImage)
    private messageImageRepo: Repository<MessageImage>,
    @InjectRepository(MessageRead)
    private messageReadRepo: Repository<MessageRead>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private audit: AdminAuditService,
    private wsGateway: WsGateway,
    private fcm: FcmService,
  ) {}

  async getOrders(dto: OrdersListQuery) {
    const startDate = trimDate(dto.startDate);
    const endDate = trimDate(dto.endDate);
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .orderBy('o.created_at', 'DESC');
    if (dto.userId) qb.andWhere('o.user_id = :uid', { uid: dto.userId });
    if (dto.gameType) qb.andWhere('o.game_type = :gt', { gt: dto.gameType });
    if (dto.gameIds && dto.gameIds.length > 0)
      qb.andWhere('o.game_id IN (:...gids)', { gids: dto.gameIds });
    if (dto.status !== undefined)
      qb.andWhere('o.status = :s', { s: dto.status });
    if (startDate)
      qb.andWhere('o.created_at >= :odStart', {
        odStart: `${startDate} 00:00:00`,
      });
    if (endDate)
      qb.andWhere('o.created_at <= :odEnd', { odEnd: `${endDate} 23:59:59` });
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    const roundMap = await this.loadOrderRoundMap(list);
    const userMap = await this.loadUsernameMap(
      list.map((order) => order.userId),
    );
    const orderGameIds = [...new Set(list.map((order) => order.gameId))];
    const orderGames = orderGameIds.length
      ? await this.gameRepo.find({ where: { id: In(orderGameIds) } })
      : [];
    const gameNameMap = new Map(
      orderGames.map((game) => [game.id, game.gameName]),
    );
    const withResult = list.map((order) => {
      const userInfo = userMap.get(order.userId);
      const gameName = gameNameMap.get(order.gameId);
      const round = roundMap.get(this.roundKey(order.gameId, order.roundNo));
      return {
        ...order,
        gameName: gameName !== undefined ? gameName : null,
        result: round ? round.result : null,
        username: this.resolveUsername(userInfo),
        userNickname: this.resolveUsername(userInfo),
        userAvatar: this.resolveAvatar(userInfo),
      };
    });
    return new PaginatedResponse(withResult, total, dto.pageNo, dto.pageSize);
  }

  private roundKey(gameId: number, roundNo: string): string {
    return `${gameId}:${roundNo}`;
  }

  private async loadOrderRoundMap(
    orders: Order[],
  ): Promise<Map<string, GameRound>> {
    const map = new Map<string, GameRound>();
    if (orders.length === 0) return map;
    const gameIds = [...new Set(orders.map((o) => o.gameId))];
    const roundNos = [...new Set(orders.map((o) => o.roundNo).filter(Boolean))];
    if (gameIds.length === 0 || roundNos.length === 0) return map;
    const rounds = await this.roundRepo
      .createQueryBuilder('r')
      .where('r.game_id IN (:...gameIds)', { gameIds })
      .andWhere('r.round_no IN (:...roundNos)', { roundNos })
      .getMany();
    for (const round of rounds) {
      map.set(this.roundKey(round.gameId, round.roundNo), round);
    }
    return map;
  }

  private async loadUsernameMap(
    userIds: string[],
  ): Promise<Map<string, UsernameInfo>> {
    const map = new Map<string, UsernameInfo>();
    const distinctIds = [...new Set(userIds.filter(Boolean))];
    if (distinctIds.length === 0) return map;
    const users = await this.userRepo.find({
      where: { userId: In(distinctIds) },
      select: ['userId', 'nickname', 'phone', 'avatar'],
    });
    for (const user of users) {
      map.set(user.userId, {
        nickname: user.nickname,
        phone: user.phone,
        avatar: user.avatar,
      });
    }
    return map;
  }

  private resolveUsername(info: UsernameInfo | undefined): string {
    if (!info) return '';
    if (info.nickname) return info.nickname;
    if (info.phone) return info.phone;
    return '';
  }

  private resolveAvatar(info: UsernameInfo | undefined): string {
    if (!info) return '';
    return info.avatar;
  }

  async getMessages(dto: {
    pageNo: number;
    pageSize: number;
    search?: string;
    type?: string;
  }) {
    const qb = this.messageRepo.createQueryBuilder('m');
    if (dto.search) {
      qb.andWhere('(m.title LIKE :q OR m.content LIKE :q)', {
        q: `%${dto.search}%`,
      });
    }
    if (dto.type) {
      qb.andWhere('m.msgType = :type', { type: dto.type });
    }
    qb.orderBy('m.createdAt', 'DESC')
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize);
    const [list, total] = await qb.getManyAndCount();
    const mapped = list.map((m) => ({
      id: m.id,
      title: m.title,
      content: m.content,
      imageUrl: m.imageUrl,
      type: m.msgType,
      targetUserId: m.userId,
      status: m.isRead,
      createdAt: m.createdAt,
    }));
    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async createMessage(data: CreateMessageDto, adminId: number) {
    const trimmedTarget =
      data.targetUserId !== undefined ? data.targetUserId.trim() : '';
    const userId = trimmedTarget.length > 0 ? trimmedTarget : null;
    const trimmedType = data.type.trim();
    const msgType = trimmedType.length > 0 ? trimmedType : MessageType.System;
    const images = this.collectImageUrls(data);
    const coverImage = images.length > 0 ? images[0] : null;
    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        title: data.title.trim(),
        content: data.content.trim(),
        imageUrl: coverImage,
        msgType,
        userId,
      }),
    );
    if (images.length > 0) {
      await this.messageImageRepo.save(
        images.map((url, index) =>
          this.messageImageRepo.create({
            messageId: Number(saved.id),
            imageUrl: url,
            sortOrder: index,
          }),
        ),
      );
    }
    const payload = {
      id: Number(saved.id),
      title: saved.title,
      content: saved.content,
      imageUrl: saved.imageUrl,
      images,
      type: saved.msgType,
      createdAt: saved.createdAt,
    };
    if (userId) {
      this.wsGateway.sendToUser(userId, 'notification', payload);
    } else {
      this.wsGateway.broadcastToAll('notification', payload);
    }
    await this.pushFcmNotification(
      userId,
      saved.title,
      saved.content,
      saved.id,
      coverImage,
    );
    await this.audit.createAuditLog(
      adminId,
      'create_message',
      'message',
      String(saved.id),
    );
    return saved;
  }

  private collectImageUrls(data: CreateMessageDto): string[] {
    const urls: string[] = [];
    const add = (candidate?: string): void => {
      if (typeof candidate !== 'string') return;
      const trimmed = candidate.trim();
      if (trimmed.length > 0 && !urls.includes(trimmed)) urls.push(trimmed);
    };
    add(data.imageUrl);
    if (Array.isArray(data.imageUrls)) {
      for (const url of data.imageUrls) add(url);
    }
    return urls;
  }

  private toAbsoluteUrl(path: string | null): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
    if (base.length === 0) return undefined;
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  private async pushFcmNotification(
    userId: string | null,
    title: string,
    content: string,
    messageId: number,
    imageUrl: string | null,
  ): Promise<void> {
    const absoluteImage = this.toAbsoluteUrl(imageUrl);
    const push = {
      title,
      body: content,
      data: {
        type: 'notification',
        messageId: String(messageId),
        title,
        body: content,
        url: '/notifications',
        ...(absoluteImage ? { image: absoluteImage } : {}),
      },
      ...(absoluteImage ? { image: absoluteImage } : {}),
    };
    try {
      if (userId) {
        await this.fcm.sendToUser(userId, push);
      } else {
        await this.fcm.sendBroadcast(push);
      }
    } catch (error) {
      this.logger.warn(
        `FCM push skipped for message ${messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteMessage(id: number, adminId: number) {
    await this.messageImageRepo.delete({ messageId: id });
    await this.messageReadRepo.delete({ messageId: id });
    await this.messageRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_message',
      'message',
      String(id),
    );
  }

  async bulkDeleteMessages(ids: number[], adminId: number) {
    const uniqueIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
    if (uniqueIds.length === 0) {
      return { deleted: 0 };
    }
    await this.messageImageRepo.delete({ messageId: In(uniqueIds) });
    await this.messageReadRepo.delete({ messageId: In(uniqueIds) });
    const result = await this.messageRepo.delete({ id: In(uniqueIds) });
    await this.audit.createAuditLog(
      adminId,
      'bulk_delete_message',
      'message',
      uniqueIds.join(','),
    );
    return { deleted: result.affected ?? uniqueIds.length };
  }

  async getBadgeCounts() {
    try {
      const [
        pendingRecharge,
        pendingWithdraw,
        unsettledOrders,
        unreadMessages,
        pendingLotteryDraws,
      ] = await Promise.all([
        this.rcRepo
          .createQueryBuilder('r')
          .where('r.status = 0')
          .andWhere(
            'r.channel_id IN (SELECT id FROM payment_gateways WHERE mode = :manualMode)',
            { manualMode: PaymentGatewayMode.Manual },
          )
          .getCount(),
        this.wdRepo.count({ where: { status: 0 } }),
        this.orderRepo.createQueryBuilder('o').where('o.status = 0').getCount(),
        this.messageRepo
          .createQueryBuilder('m')
          .where('m.isRead = 0')
          .getCount()
          .catch(() => 0),
        this.roundRepo
          .createQueryBuilder('r')
          .where(
            'r.game_id IN (SELECT id FROM game_list WHERE is_lottery = 1 AND auto_generate = 0)',
          )
          .andWhere('r.status = 1')
          .getCount()
          .catch(() => 0),
      ]);
      return {
        pendingRecharge,
        pendingWithdraw,
        unsettledOrders,
        unreadMessages,
        pendingLotteryDraws,
      };
    } catch {
      return {
        pendingRecharge: 0,
        pendingWithdraw: 0,
        unsettledOrders: 0,
        unreadMessages: 0,
        pendingLotteryDraws: 0,
      };
    }
  }
}
