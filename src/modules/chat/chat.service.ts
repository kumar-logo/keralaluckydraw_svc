import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In } from 'typeorm';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ChatGroup } from '../../entities/chat-group.entity';
import { ChatGroupMember } from '../../entities/chat-group-member.entity';
import { ChatMute } from '../../entities/chat-mute.entity';
import { ChatRead } from '../../entities/chat-read.entity';
import { User } from '../../entities/user.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { WsGateway } from '../websocket/ws.gateway';
import { ConfigLoaderService } from '../config/config-loader.service';
import { filterChatContent, parseBadWords } from './chat-content.util';

const GROUP_TYPE_PRIVATE = 'private';
const GROUP_TYPE_PUBLIC = 'public';
const ADMIN_LIST_MAX = 200;
const UNREAD_CAP = 100;
const MENTION_CAP = 10;
const READER_LIST_CAP = 20;
const MENTION_PREVIEW_LEN = 80;

interface Sender {
  userId: string;
  role: 'user' | 'admin';
  name: string;
  avatar: string;
}

interface MessagePayload {
  content: string;
  imageUrl?: string;
  replyToId?: number;
  mentions?: string[];
}

export interface ReplySnippet {
  id: number;
  senderName: string;
  content: string;
  imageUrl: string | null;
}

export interface ChatMessageView {
  id: number;
  groupId: number;
  userId: string;
  senderRole: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  imageUrl: string | null;
  replyToId: number | null;
  replyTo: ReplySnippet | null;
  mentions: string[];
  createdAt: Date;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(ChatGroup)
    private readonly groupRepo: Repository<ChatGroup>,
    @InjectRepository(ChatGroupMember)
    private readonly memberRepo: Repository<ChatGroupMember>,
    @InjectRepository(ChatMute)
    private readonly muteRepo: Repository<ChatMute>,
    @InjectRepository(ChatRead)
    private readonly readRepo: Repository<ChatRead>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AppConfig)
    private readonly appConfigRepo: Repository<AppConfig>,
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    private readonly wsGateway: WsGateway,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async getChatSettings() {
    return this.configLoader.getGroupChatSettings();
  }

  async updateChatSettings(data: {
    enabled?: boolean;
    blockLinks?: boolean;
    imageEnabled?: boolean;
    badWords?: string;
  }) {
    const patch: Partial<AppConfig> = {};
    if (data.enabled !== undefined) patch.groupChatEnabled = data.enabled ? 1 : 0;
    if (data.blockLinks !== undefined)
      patch.groupChatBlockLinks = data.blockLinks ? 1 : 0;
    if (data.imageEnabled !== undefined)
      patch.groupChatImageEnabled = data.imageEnabled ? 1 : 0;
    if (data.badWords !== undefined) patch.groupChatBadWords = data.badWords;
    await this.appConfigRepo.update({ id: 1 }, patch);
    await this.configLoader.refresh();
    return this.configLoader.getGroupChatSettings();
  }

  private roomName(groupId: number): string {
    return `chat_${groupId}`;
  }

  private async loadGroup(groupId: number): Promise<ChatGroup> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId, status: 1 },
    });
    if (!group) throw new NotFoundException('Chat group not found');
    return group;
  }

  private async isMember(groupId: number, userId: string): Promise<boolean> {
    const row = await this.memberRepo.findOne({
      where: { groupId, userId },
      select: { id: true },
    });
    return !!row;
  }

  private async assertUserAccess(
    group: ChatGroup,
    userId: string,
  ): Promise<void> {
    if (
      group.type === GROUP_TYPE_PRIVATE &&
      !(await this.isMember(group.id, userId))
    ) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  private async visibleGroups(userId: string): Promise<ChatGroup[]> {
    const groups = await this.groupRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const memberships = await this.memberRepo.find({
      where: { userId },
      select: { groupId: true },
    });
    const memberOf = new Set(memberships.map((m) => m.groupId));
    return groups.filter(
      (g) => g.type !== GROUP_TYPE_PRIVATE || memberOf.has(g.id),
    );
  }

  async isMuted(userId: string): Promise<boolean> {
    const row = await this.muteRepo.findOne({ where: { userId } });
    if (!row) return false;
    if (row.mutedUntil === null) return true;
    return new Date(row.mutedUntil).getTime() > Date.now();
  }

  private emit(
    group: ChatGroup,
    event: string,
    payload:
      | ChatMessageView
      | { id: number; groupId: number }
      | { groupId: number; userId: string; lastReadId: number; name: string; avatar: string },
  ): void {
    this.wsGateway.emitToRoom(this.roomName(group.id), event, payload);
  }

  private parseMentions(raw: string | null): string[] {
    return raw ? raw.split(',').filter((x) => x.length > 0) : [];
  }

  private view(
    m: ChatMessage,
    replyMap?: Map<number, ReplySnippet>,
  ): ChatMessageView {
    const replyToId = m.replyToId === null ? null : Number(m.replyToId);
    return {
      id: Number(m.id),
      groupId: m.groupId,
      userId: m.userId,
      senderRole: m.senderRole,
      senderName: m.senderName,
      senderAvatar: m.senderAvatar,
      content: m.content,
      imageUrl: m.imageUrl,
      replyToId,
      replyTo:
        replyToId !== null && replyMap ? replyMap.get(replyToId) ?? null : null,
      mentions: this.parseMentions(m.mentions),
      createdAt: m.createdAt,
    };
  }

  private async resolveReplies(
    messages: ChatMessage[],
  ): Promise<Map<number, ReplySnippet>> {
    const ids = Array.from(
      new Set(
        messages
          .map((m) => m.replyToId)
          .filter((x): x is number => x !== null)
          .map((x) => Number(x)),
      ),
    );
    if (ids.length === 0) return new Map();
    const rows = await this.messageRepo.find({
      where: { id: In(ids), status: 1 },
      select: { id: true, senderName: true, content: true, imageUrl: true },
    });
    return new Map(
      rows.map((r) => [
        Number(r.id),
        {
          id: Number(r.id),
          senderName: r.senderName,
          content: r.content,
          imageUrl: r.imageUrl,
        },
      ]),
    );
  }

  private async viewMany(rows: ChatMessage[]): Promise<ChatMessageView[]> {
    const replyMap = await this.resolveReplies(rows);
    return rows.map((m) => this.view(m, replyMap));
  }

  async listGroupsForUser(userId: string) {
    const groups = await this.visibleGroups(userId);
    const reads = await this.readRepo.find({ where: { userId } });
    const readMap = new Map(reads.map((r) => [r.groupId, Number(r.lastReadId)]));
    return Promise.all(
      groups.map(async (g) => {
        const lastRead = readMap.get(g.id) ?? 0;
        const last = await this.messageRepo.findOne({
          where: { groupId: g.id, status: 1 },
          order: { id: 'DESC' },
        });
        const unread = await this.countUnread(g.id, lastRead);
        return {
          id: g.id,
          name: g.name,
          type: g.type,
          avatar: g.avatar,
          unread,
          lastMessage: last
            ? {
                content: last.content,
                imageUrl: last.imageUrl,
                senderName: last.senderName,
                createdAt: last.createdAt,
              }
            : null,
        };
      }),
    );
  }

  private async countUnread(groupId: number, afterId: number): Promise<number> {
    const rows = await this.messageRepo.query(
      `SELECT COUNT(*) AS c FROM (
         SELECT id FROM chat_message
         WHERE group_id = ? AND status = 1 AND id > ?
         LIMIT ?
       ) t`,
      [groupId, afterId, UNREAD_CAP],
    );
    return Number(rows[0].c);
  }

  async getUnread(userId: string) {
    const groups = await this.visibleGroups(userId);
    const reads = await this.readRepo.find({ where: { userId } });
    const readMap = new Map(reads.map((r) => [r.groupId, Number(r.lastReadId)]));
    return Promise.all(
      groups.map(async (g) => ({
        groupId: g.id,
        unread: await this.countUnread(g.id, readMap.get(g.id) ?? 0),
      })),
    );
  }

  async getMessagesAsAdmin(
    groupId: number,
    beforeId: number | undefined,
    limit: number,
  ) {
    await this.loadGroup(groupId);
    return this.fetchMessages(groupId, beforeId, limit);
  }

  async getMessages(
    userId: string,
    groupId: number,
    beforeId: number | undefined,
    limit: number,
  ) {
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    return this.fetchMessages(groupId, beforeId, limit);
  }

  async getMessagesAfter(userId: string, groupId: number, afterId: number) {
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    const rows = await this.messageRepo.find({
      where: { groupId, status: 1, id: MoreThan(afterId) },
      order: { id: 'ASC' },
      take: 50,
    });
    return this.viewMany(rows);
  }

  private async fetchMessages(
    groupId: number,
    beforeId: number | undefined,
    limit: number,
  ) {
    const take = Math.min(Math.max(1, limit), 50);
    const where =
      beforeId && beforeId > 0
        ? { groupId, status: 1, id: LessThan(beforeId) }
        : { groupId, status: 1 };
    const rows = await this.messageRepo.find({
      where,
      order: { id: 'DESC' },
      take,
    });
    return this.viewMany(rows.reverse());
  }

  private async replyTargetValid(
    replyToId: number,
    groupId: number,
  ): Promise<boolean> {
    const row = await this.messageRepo.findOne({
      where: { id: replyToId, groupId, status: 1 },
      select: { id: true },
    });
    return !!row;
  }

  private async advanceRead(
    groupId: number,
    userId: string,
    messageId: number,
  ): Promise<void> {
    await this.readRepo.query(
      `INSERT INTO chat_read (group_id, user_id, last_read_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
      [groupId, userId, messageId],
    );
  }

  private async validateMentions(
    group: ChatGroup,
    mentions: string[] | undefined,
  ): Promise<string[]> {
    if (!mentions || mentions.length === 0) return [];
    const capped = Array.from(new Set(mentions)).slice(0, MENTION_CAP);
    if (group.type === GROUP_TYPE_PRIVATE) {
      const rows = await this.memberRepo
        .createQueryBuilder('gm')
        .select('gm.user_id', 'userId')
        .where('gm.group_id = :groupId AND gm.user_id IN (:...uids)', {
          groupId: group.id,
          uids: capped,
        })
        .getRawMany<{ userId: string }>();
      const allowed = new Set(rows.map((r) => r.userId));
      return capped.filter((uid) => allowed.has(uid));
    }
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .select('DISTINCT m.user_id', 'userId')
      .where(
        'm.group_id = :groupId AND m.status = 1 AND m.sender_role = :role AND m.user_id IN (:...uids)',
        { groupId: group.id, role: 'user', uids: capped },
      )
      .getRawMany<{ userId: string }>();
    const allowed = new Set(rows.map((r) => r.userId));
    return capped.filter((uid) => allowed.has(uid));
  }

  private notifyMentions(
    group: ChatGroup,
    view: ChatMessageView,
    mentions: string[],
  ): void {
    for (const uid of mentions) {
      if (uid === view.userId) continue;
      this.wsGateway.sendToUser(uid, 'chat:mention', {
        groupId: group.id,
        groupName: group.name,
        messageId: view.id,
        senderName: view.senderName,
        preview: view.content.slice(0, MENTION_PREVIEW_LEN),
      });
    }
  }

  private async persistAndEmit(
    group: ChatGroup,
    sender: Sender,
    payload: MessagePayload,
  ): Promise<ChatMessageView> {
    const mentions =
      payload.mentions && payload.mentions.length > 0
        ? payload.mentions.slice(0, MENTION_CAP)
        : [];
    const entity = this.messageRepo.create({
      groupId: group.id,
      userId: sender.userId,
      senderRole: sender.role,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      content: payload.content,
      imageUrl: payload.imageUrl ?? null,
      replyToId: payload.replyToId ?? null,
      mentions: mentions.length > 0 ? mentions.join(',') : null,
      status: 1,
    });
    const saved = await this.messageRepo.save(entity);
    const replyMap = payload.replyToId
      ? await this.resolveReplies([saved])
      : undefined;
    const view = this.view(saved, replyMap);
    this.emit(group, 'chat:new', view);
    if (sender.role === 'user') {
      await this.advanceRead(group.id, sender.userId, view.id);
    }
    if (mentions.length > 0) this.notifyMentions(group, view, mentions);
    return view;
  }

  private async buildOutgoing(
    group: ChatGroup,
    content: string,
    payload: {
      imageUrl?: string;
      replyToId?: number;
      mentions?: string[];
    },
    imageEnabled: boolean,
  ): Promise<MessagePayload> {
    const hasImage = typeof payload.imageUrl === 'string' && payload.imageUrl !== '';
    if (hasImage && !imageEnabled) {
      throw new BadRequestException('Image sharing is disabled');
    }
    if (!content && !hasImage) {
      throw new BadRequestException('Message is empty');
    }
    const replyToId =
      payload.replyToId && (await this.replyTargetValid(payload.replyToId, group.id))
        ? payload.replyToId
        : undefined;
    const mentions = await this.validateMentions(group, payload.mentions);
    return {
      content,
      imageUrl: hasImage ? payload.imageUrl : undefined,
      replyToId,
      mentions,
    };
  }

  async sendUserMessage(
    userId: string,
    groupId: number,
    input: {
      content: string;
      imageUrl?: string;
      replyToId?: number;
      mentions?: string[];
    },
  ) {
    const settings = await this.configLoader.getGroupChatSettings();
    if (!settings.enabled) {
      throw new BadRequestException('Group chat is currently disabled');
    }
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    if (await this.isMuted(userId)) {
      throw new ForbiddenException('You are muted in the chat');
    }
    const content = filterChatContent(input.content, {
      blockLinks: settings.blockLinks,
      badWords: parseBadWords(settings.badWords),
    });
    const outgoing = await this.buildOutgoing(
      group,
      content,
      input,
      settings.imageEnabled,
    );
    const user = await this.userRepo.findOne({
      where: { userId },
      select: { nickname: true, avatar: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.persistAndEmit(
      group,
      { userId, role: 'user', name: user.nickname ?? '', avatar: user.avatar },
      outgoing,
    );
  }

  async sendAdminMessage(
    adminId: string,
    groupId: number,
    input: {
      content: string;
      imageUrl?: string;
      replyToId?: number;
      mentions?: string[];
    },
  ) {
    const settings = await this.configLoader.getGroupChatSettings();
    if (!settings.enabled) {
      throw new BadRequestException('Group chat is currently disabled');
    }
    const admin = await this.adminRepo.findOne({
      where: { id: Number(adminId) },
      select: { username: true, displayName: true, avatar: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    const group = await this.loadGroup(groupId);
    const content = input.content.replace(/\s+/g, ' ').trim();
    const outgoing = await this.buildOutgoing(
      group,
      content,
      input,
      settings.imageEnabled,
    );
    const name = admin.displayName ? admin.displayName : admin.username;
    const avatar = admin.avatar ? admin.avatar : '';
    return this.persistAndEmit(
      group,
      { userId: `admin_${adminId}`, role: 'admin', name, avatar },
      outgoing,
    );
  }

  private async groupMaxMessageId(groupId: number): Promise<number> {
    const top = await this.messageRepo.findOne({
      where: { groupId, status: 1 },
      order: { id: 'DESC' },
      select: { id: true },
    });
    return top ? Number(top.id) : 0;
  }

  async markRead(userId: string, groupId: number, messageId: number) {
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    const clamped = Math.min(messageId, await this.groupMaxMessageId(groupId));
    if (clamped <= 0) return { success: true };
    await this.advanceRead(groupId, userId, clamped);
    if (group.type === GROUP_TYPE_PRIVATE) {
      const user = await this.userRepo.findOne({
        where: { userId },
        select: { nickname: true, avatar: true },
      });
      this.emit(group, 'chat:read', {
        groupId,
        userId,
        lastReadId: clamped,
        name: user?.nickname ?? '',
        avatar: user?.avatar ?? '',
      });
    }
    return { success: true };
  }

  async getMessageReaders(userId: string, groupId: number, messageId: number) {
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    if (group.type !== GROUP_TYPE_PRIVATE) {
      return { count: 0, total: 0, readers: [] };
    }
    const total = await this.memberRepo.count({ where: { groupId } });
    const count = await this.readRepo
      .createQueryBuilder('r')
      .where(
        'r.group_id = :groupId AND r.last_read_id >= :messageId AND r.user_id <> :userId',
        { groupId, messageId, userId },
      )
      .getCount();
    const readerRows = await this.readRepo
      .createQueryBuilder('r')
      .select('r.user_id', 'userId')
      .where(
        'r.group_id = :groupId AND r.last_read_id >= :messageId AND r.user_id <> :userId',
        { groupId, messageId, userId },
      )
      .orderBy('r.updated_at', 'DESC')
      .limit(READER_LIST_CAP)
      .getRawMany<{ userId: string }>();
    const readerIds = readerRows.map((r) => r.userId);
    const users = readerIds.length
      ? await this.userRepo.find({
          where: readerIds.map((uid) => ({ userId: uid })),
          select: { userId: true, nickname: true, avatar: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.userId, u]));
    return {
      count,
      total,
      readers: readerIds.map((uid) => ({
        userId: uid,
        nickname: byId.get(uid)?.nickname ?? '',
        avatar: byId.get(uid)?.avatar ?? '',
      })),
    };
  }

  async deleteMessage(messageId: number, adminId: string) {
    const msg = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.messageRepo.update(messageId, { status: 0 });
    const group = await this.groupRepo.findOne({ where: { id: msg.groupId } });
    if (group) {
      this.emit(group, 'chat:delete', {
        id: Number(messageId),
        groupId: msg.groupId,
      });
    }
    return { success: true };
  }

  async clearGroupMessages(groupId: number, adminId: string) {
    void adminId;
    const group = await this.loadGroup(groupId);
    await this.messageRepo.update({ groupId, status: 1 }, { status: 0 });
    this.wsGateway.emitToRoom(this.roomName(group.id), 'chat:cleared', {
      groupId,
    });
    return { success: true };
  }

  async muteUser(
    userId: string,
    minutes: number | undefined,
    reason: string,
    adminId: string,
  ) {
    const mutedUntil =
      minutes && minutes > 0 ? new Date(Date.now() + minutes * 60000) : null;
    const existing = await this.muteRepo.findOne({ where: { userId } });
    if (existing) {
      await this.muteRepo.update(existing.id, {
        mutedUntil,
        reason,
        createdBy: adminId,
      });
    } else {
      await this.muteRepo.save(
        this.muteRepo.create({
          userId,
          mutedUntil,
          reason,
          createdBy: adminId,
        }),
      );
    }
    return { success: true };
  }

  async unmuteUser(userId: string) {
    await this.muteRepo.delete({ userId });
    return { success: true };
  }

  async listMuted(skip: number, take: number) {
    const rows = await this.muteRepo.find({
      order: { id: 'DESC' },
      skip,
      take: Math.min(Math.max(1, take), ADMIN_LIST_MAX),
    });
    return rows.map((r) => ({
      userId: r.userId,
      mutedUntil: r.mutedUntil,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  async listGroupsAdmin() {
    const groups = await this.groupRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return Promise.all(
      groups.map(async (g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        avatar: g.avatar,
        sortOrder: g.sortOrder,
        memberCount:
          g.type === GROUP_TYPE_PRIVATE
            ? await this.memberRepo.count({ where: { groupId: g.id } })
            : null,
      })),
    );
  }

  async createGroup(
    name: string,
    type: string,
    avatar: string,
    adminId: string,
  ) {
    const group = await this.groupRepo.save(
      this.groupRepo.create({
        name,
        type:
          type === GROUP_TYPE_PRIVATE ? GROUP_TYPE_PRIVATE : GROUP_TYPE_PUBLIC,
        avatar,
        status: 1,
        createdBy: adminId,
      }),
    );
    return { id: group.id };
  }

  async updateGroup(
    groupId: number,
    data: { name?: string; type?: string; avatar?: string; sortOrder?: number },
  ) {
    await this.loadGroup(groupId);
    const patch: Partial<ChatGroup> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined)
      patch.type =
        data.type === GROUP_TYPE_PRIVATE
          ? GROUP_TYPE_PRIVATE
          : GROUP_TYPE_PUBLIC;
    if (data.avatar !== undefined) patch.avatar = data.avatar;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
    await this.groupRepo.update(groupId, patch);
    return { success: true };
  }

  async deleteGroup(groupId: number) {
    await this.groupRepo.update(groupId, { status: 0 });
    return { success: true };
  }

  async listMembers(groupId: number, skip: number, take: number) {
    const members = await this.memberRepo.find({
      where: { groupId },
      order: { id: 'DESC' },
      skip,
      take: Math.min(Math.max(1, take), ADMIN_LIST_MAX),
    });
    const ids = members.map((m) => m.userId);
    const users = ids.length
      ? await this.userRepo.find({ where: ids.map((userId) => ({ userId })) })
      : [];
    const byId = new Map(users.map((u) => [u.userId, u]));
    return members.map((m) => ({
      userId: m.userId,
      nickname: byId.get(m.userId)?.nickname ?? '',
      avatar: byId.get(m.userId)?.avatar ?? '',
      addedAt: m.createdAt,
    }));
  }

  async addMember(groupId: number, userId: string) {
    await this.loadGroup(groupId);
    const exists = await this.memberRepo.findOne({
      where: { groupId, userId },
      select: { id: true },
    });
    if (!exists) {
      await this.memberRepo.save(this.memberRepo.create({ groupId, userId }));
    }
    return { success: true };
  }

  async removeMember(groupId: number, userId: string) {
    await this.memberRepo.delete({ groupId, userId });
    return { success: true };
  }
}
