import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGroup } from '../../entities/chat-group.entity';
import { ChatGroupMember } from '../../entities/chat-group-member.entity';
import { GameEventsService, GameEventKind } from './game-events.service';

interface BroadcastPayload {
  serverTime: number;
  [key: string]: unknown;
}

type AuthedSocket = Socket & {
  userId?: string;
  adminId?: string;
  lastTypingAt?: number;
};

const TYPING_THROTTLE_MS = 900;

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/ws/internal',
  transports: ['polling', 'websocket'],
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('WebSocket');
  private clients = new Map<string, Socket>();

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly gameEvents: GameEventsService,
    @InjectRepository(ChatGroup)
    private readonly chatGroupRepo: Repository<ChatGroup>,
    @InjectRepository(ChatGroupMember)
    private readonly chatMemberRepo: Repository<ChatGroupMember>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clients.set(client.id, client);

    const token = this.extractToken(client);
    if (token !== null) {
      this.authenticateClient(client, token);
    }
  }

  private extractToken(client: Socket): string | null {
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken !== '') {
      return queryToken;
    }
    const authToken = (client.handshake.auth as { token?: string }).token;
    if (typeof authToken === 'string' && authToken !== '') {
      return authToken;
    }
    return null;
  }

  handleDisconnect(client: Socket) {
    const userId = (client as AuthedSocket).userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string },
  ) {
    const token = typeof data.token === 'string' ? data.token : '';
    const success = this.authenticateClient(client, token);
    return { event: 'auth_result', data: { success } };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number; type?: string },
  ) {
    const room = `game_${data.gameId}`;
    client.join(room);
    return { event: 'subscribed', data: { room } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    client.leave(`game_${data.gameId}`);
  }

  @SubscribeMessage('chat:subscribe')
  async handleChatSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number },
  ) {
    const socket = client as AuthedSocket;
    const groupId = data?.groupId;
    if (!groupId || (!socket.userId && !socket.adminId)) {
      return { event: 'chat:subscribed', data: { groupId, ok: false } };
    }
    const group = await this.chatGroupRepo.findOne({
      where: { id: groupId, status: 1 },
      select: { id: true, type: true },
    });
    if (!group) return { event: 'chat:subscribed', data: { groupId, ok: false } };
    let allowed = group.type !== 'private' || !!socket.adminId;
    if (!allowed && socket.userId) {
      const member = await this.chatMemberRepo.findOne({
        where: { groupId, userId: socket.userId },
        select: { id: true },
      });
      allowed = !!member;
    }
    if (allowed) client.join(`chat_${groupId}`);
    return { event: 'chat:subscribed', data: { groupId, ok: allowed } };
  }

  @SubscribeMessage('chat:unsubscribe')
  handleChatUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number },
  ) {
    if (data && data.groupId) client.leave(`chat_${data.groupId}`);
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number },
  ) {
    if (!data || !data.groupId) return;
    const room = `chat_${data.groupId}`;
    if (!client.rooms.has(room)) return;
    const socket = client as AuthedSocket;
    const now = Date.now();
    if (socket.lastTypingAt && now - socket.lastTypingAt < TYPING_THROTTLE_MS) {
      return;
    }
    socket.lastTypingAt = now;
    const isAdmin = typeof socket.adminId === 'string';
    client.to(room).emit('chat:typing', {
      groupId: data.groupId,
      userId: isAdmin ? `admin_${socket.adminId}` : socket.userId ?? '',
      isAdmin,
    });
  }

  emitToRoom<T>(room: string, event: string, data: T) {
    this.server.to(room).emit(event, data);
  }

  broadcastGameUpdate(gameId: number, data: BroadcastPayload) {
    this.server.to(`game_${gameId}`).emit('game_update', data);
    this.gameEvents.emit({
      ...data,
      kind: GameEventKind.GameUpdate,
      gameId,
      serverTime: data.serverTime,
    });
  }

  broadcastDrawResult(gameId: number, result: BroadcastPayload) {
    this.server.to(`game_${gameId}`).emit('draw_result', result);
    this.gameEvents.emit({
      ...result,
      kind: GameEventKind.DrawResult,
      gameId,
      serverTime: result.serverTime,
    });
  }

  broadcastBalanceUpdate(
    userId: string,
    balance: number,
    bonusBalance: number,
  ) {
    this.sendToUser(userId, 'balance_change', { balance, bonusBalance });
  }

  broadcastToAll<T>(event: string, data: T) {
    this.server.emit(event, data);
  }

  broadcastRoundStatus(
    gameId: number,
    roundNo: string,
    status: number,
    countdown?: number,
  ) {
    this.server
      .to(`game_${gameId}`)
      .emit('round_status', { gameId, roundNo, status, countdown });
  }

  broadcastOrderSettled(
    userId: string,
    orderNo: string,
    status: number,
    winAmount: number,
  ) {
    this.sendToUser(userId, 'order_settled', { orderNo, status, winAmount });
  }

  broadcastAnnouncement(data: { id: number; title: string; content: string }) {
    this.server.emit('announcement', data);
  }

  broadcastCountdown(gameId: number, roundNo: string, secondsLeft: number) {
    this.server
      .to(`game_${gameId}`)
      .emit('countdown', { gameId, roundNo, secondsLeft });
  }

  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  getGameSubscriberCount(gameId: number): number {
    const room = this.server.sockets.adapter.rooms.get(`game_${gameId}`);
    return room ? room.size : 0;
  }

  sendToUser<T>(userId: string, event: string, data: T) {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return;

    for (const socketId of socketIds) {
      const client = this.clients.get(socketId);
      if (client) client.emit(event, data);
    }
  }

  private authenticateClient(client: Socket, token: string): boolean {
    if (!token) return false;

    try {
      const payload = this.jwtService.verify<{
        userId?: string;
        sub?: number | string;
      }>(token);
      const socket = client as AuthedSocket;

      if (payload.userId) {
        socket.userId = payload.userId;
        client.join(`user_${payload.userId}`);
        let sockets = this.userSockets.get(payload.userId);
        if (!sockets) {
          sockets = new Set();
          this.userSockets.set(payload.userId, sockets);
        }
        sockets.add(client.id);
        return true;
      }

      if (payload.sub !== undefined && payload.sub !== null) {
        socket.adminId = String(payload.sub);
        return true;
      }

      return false;
    } catch {
      this.logger.warn(`Auth failed for client ${client.id}: invalid token`);
      return false;
    }
  }
}
