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
import { ChatMention } from '../../entities/chat-mention.entity';
import { ChatMute } from '../../entities/chat-mute.entity';
import { ChatRead } from '../../entities/chat-read.entity';
import { User } from '../../entities/user.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { WsGateway } from '../websocket/ws.gateway';
import { ConfigLoaderService } from '../config/config-loader.service';
import { filterChatContent, parseBadWords } from './chat-content.util';
import {
  GroupType,
  JoinPolicy,
  Visibility,
  PostPolicy,
  MessageKind,
  SenderRole,
  MemberRole,
  DmScope,
} from './chat.enums';
import {
  ChatDeliveredPayload,
  ChatGroupUpdatePayload,
  ChatJoinedPayload,
  ChatLeftPayload,
  ChatDmCreatedPayload,
  ChatDmClaimedPayload,
  ChatMentionBadgePayload,
} from './chat.events';

const ADMIN_LIST_MAX = 200;
const UNREAD_CAP = 100;
const MENTION_CAP = 10;
const READER_LIST_CAP = 20;
const MENTION_PREVIEW_LEN = 80;
const RECEIPTS_MEMBER_CAP = 50;
const DISCOVER_MAX = 30;
const DM_LIST_MAX = 30;
const MENTIONS_LIST_CAP = 50;
const SUPPORT_PEER_NAME = 'Support';

interface Sender {
  userId: string;
  role: SenderRole;
  name: string;
  avatar: string;
}

interface MessageInput {
  content: string;
  imageUrl?: string;
  replyToId?: number;
  mentions?: string[];
  kind?: MessageKind;
  audioUrl?: string;
  durationMs?: number;
  audioWaveform?: string;
}

interface MessagePayload {
  content: string;
  kind: MessageKind;
  imageUrl?: string;
  audioUrl?: string;
  durationMs?: number;
  audioWaveform?: string;
  replyToId?: number;
  mentions?: string[];
}

interface WriteResult {
  affectedRows: number;
}

interface MentionRow {
  mentionId: number | string;
  groupId: number | string;
  messageId: number | string;
  groupName: string;
  senderName: string;
  content: string;
  kind: string;
  createdAt: Date;
  lastReadMentionId: number | string | null;
}

export interface DmPeer {
  kind: string;
  id: string | null;
  name: string;
  avatar: string;
}

export interface LastMessagePreview {
  content: string;
  imageUrl: string | null;
  senderName: string;
  createdAt: Date;
  kind: string;
}

export interface DmItem {
  id: number;
  dmKey: string | null;
  isDm: true;
  claimed: boolean;
  peer: DmPeer;
  unread: number;
  lastMessage: LastMessagePreview | null;
}

export interface ReplySnippet {
  id: number;
  senderName: string;
  content: string;
  imageUrl: string | null;
  kind: string;
  audioUrl: string | null;
  durationMs: number | null;
  audioWaveform: string | null;
}

export interface ChatMessageView {
  id: number;
  groupId: number;
  userId: string;
  senderRole: string;
  senderName: string;
  senderAvatar: string;
  kind: string;
  content: string;
  imageUrl: string | null;
  audioUrl: string | null;
  durationMs: number | null;
  audioWaveform: string | null;
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
    @InjectRepository(ChatMention)
    private readonly mentionRepo: Repository<ChatMention>,
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
    voiceEnabled?: boolean;
    dmEnabled?: boolean;
    badWords?: string;
  }) {
    const patch: Partial<AppConfig> = {};
    if (data.enabled !== undefined) patch.groupChatEnabled = data.enabled ? 1 : 0;
    if (data.blockLinks !== undefined)
      patch.groupChatBlockLinks = data.blockLinks ? 1 : 0;
    if (data.imageEnabled !== undefined)
      patch.groupChatImageEnabled = data.imageEnabled ? 1 : 0;
    if (data.voiceEnabled !== undefined)
      patch.groupChatVoiceEnabled = data.voiceEnabled ? 1 : 0;
    if (data.dmEnabled !== undefined)
      patch.groupChatDmEnabled = data.dmEnabled ? 1 : 0;
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

  private hasReceipts(group: ChatGroup): boolean {
    if (group.isDm === 1) return true;
    return (
      group.type === GroupType.Private &&
      group.memberCount <= RECEIPTS_MEMBER_CAP
    );
  }

  private async assertUserAccess(
    group: ChatGroup,
    userId: string,
  ): Promise<void> {
    if (group.joinPolicy === JoinPolicy.Auto) return;
    if (!(await this.isMember(group.id, userId))) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  private async loadVisible(
    userId: string,
  ): Promise<{ groups: ChatGroup[]; memberOf: Set<number> }> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      select: { groupId: true },
    });
    const memberOf = new Set(memberships.map((m) => m.groupId));
    const rows = await this.groupRepo.find({
      where: { status: 1, isDm: 0 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const groups = rows.filter(
      (g) => g.joinPolicy === JoinPolicy.Auto || memberOf.has(g.id),
    );
    return { groups, memberOf };
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
      | {
          groupId: number;
          userId: string;
          lastReadId: number;
          name: string;
          avatar: string;
        },
  ): void {
    this.wsGateway.emitToRoom(this.roomName(group.id), event, payload);
  }

  private parseMentions(raw: string | null): string[] {
    return raw ? raw.split(',').filter((x) => x.length > 0) : [];
  }

  private resolveReplySnippet(
    replyToId: number | null,
    replyMap?: Map<number, ReplySnippet>,
  ): ReplySnippet | null {
    if (replyToId === null || replyMap === undefined) return null;
    const snippet = replyMap.get(replyToId);
    return snippet === undefined ? null : snippet;
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
      kind: m.kind,
      content: m.content,
      imageUrl: m.imageUrl,
      audioUrl: m.audioUrl,
      durationMs: m.durationMs === null ? null : Number(m.durationMs),
      audioWaveform: m.audioWaveform,
      replyToId,
      replyTo: this.resolveReplySnippet(replyToId, replyMap),
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
      select: {
        id: true,
        senderName: true,
        content: true,
        imageUrl: true,
        kind: true,
        audioUrl: true,
        durationMs: true,
        audioWaveform: true,
      },
    });
    return new Map(
      rows.map((r) => [
        Number(r.id),
        {
          id: Number(r.id),
          senderName: r.senderName,
          content: r.content,
          imageUrl: r.imageUrl,
          kind: r.kind,
          audioUrl: r.audioUrl,
          durationMs: r.durationMs === null ? null : Number(r.durationMs),
          audioWaveform: r.audioWaveform,
        },
      ]),
    );
  }

  private async viewMany(rows: ChatMessage[]): Promise<ChatMessageView[]> {
    const replyMap = await this.resolveReplies(rows);
    return rows.map((m) => this.view(m, replyMap));
  }

  async listGroupsForUser(userId: string) {
    const { groups, memberOf } = await this.loadVisible(userId);
    const reads = await this.readRepo.find({ where: { userId } });
    const readMap = new Map(
      reads.map((r) => [
        r.groupId,
        { lastRead: Number(r.lastReadId), unreadMentions: r.unreadMentions },
      ]),
    );
    const lastMap = await this.lastMessageMap(
      groups.map((g) => Number(g.lastMessageId)),
    );
    return Promise.all(
      groups.map(async (g) => {
        const entry = readMap.get(g.id);
        const lastRead = entry === undefined ? 0 : entry.lastRead;
        const unreadMentions = entry === undefined ? 0 : entry.unreadMentions;
        const unread =
          Number(g.lastMessageId) > lastRead
            ? await this.countUnread(g.id, lastRead)
            : 0;
        const preview =
          Number(g.lastMessageId) > 0
            ? this.mapPreview(lastMap.get(Number(g.lastMessageId)))
            : null;
        return {
          id: g.id,
          name: g.name,
          type: g.type,
          avatar: g.avatar,
          description: g.description,
          joinPolicy: g.joinPolicy,
          postPolicy: g.postPolicy,
          visibility: g.visibility,
          memberCount: g.memberCount,
          isDm: g.isDm === 1,
          joined: g.joinPolicy === JoinPolicy.Auto || memberOf.has(g.id),
          unread,
          unreadMentions,
          lastMessage: preview,
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
    const { groups } = await this.loadVisible(userId);
    const reads = await this.readRepo.find({ where: { userId } });
    const readMap = new Map(reads.map((r) => [r.groupId, Number(r.lastReadId)]));
    return Promise.all(
      groups.map(async (g) => {
        const lr = readMap.get(g.id);
        const lastRead = lr === undefined ? 0 : lr;
        const unread =
          Number(g.lastMessageId) > lastRead
            ? await this.countUnread(g.id, lastRead)
            : 0;
        return { groupId: g.id, unread };
      }),
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

  private async resetMentionRead(
    groupId: number,
    userId: string,
    uptoId: number,
  ): Promise<void> {
    await this.readRepo.query(
      `UPDATE chat_read cr
       SET cr.last_read_mention_id = GREATEST(cr.last_read_mention_id, ?),
           cr.unread_mentions = (
             SELECT COUNT(*) FROM chat_mention cm
             WHERE cm.user_id = cr.user_id AND cm.group_id = cr.group_id
               AND cm.message_id > ?
           )
       WHERE cr.group_id = ? AND cr.user_id = ?`,
      [uptoId, uptoId, groupId, userId],
    );
  }

  private async validateMentions(
    group: ChatGroup,
    mentions: string[] | undefined,
  ): Promise<string[]> {
    if (!mentions || mentions.length === 0) return [];
    const capped = Array.from(new Set(mentions)).slice(0, MENTION_CAP);
    if (group.type === GroupType.Private) {
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
        { groupId: group.id, role: SenderRole.User, uids: capped },
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
      const badge: ChatMentionBadgePayload = { groupId: group.id };
      this.wsGateway.sendToUser(uid, 'chat:mention_badge', badge);
    }
  }

  private async touchGroupLastMessage(
    groupId: number,
    messageId: number,
    createdAt: Date,
  ): Promise<void> {
    await this.groupRepo.query(
      `UPDATE chat_group SET last_message_id = GREATEST(last_message_id, ?), last_message_at = ? WHERE id = ?`,
      [messageId, createdAt, groupId],
    );
  }

  private async recordMentions(
    groupId: number,
    messageId: number,
    targets: string[],
  ): Promise<void> {
    const placeholders = targets.map(() => '(?, ?, ?)').join(', ');
    const params: (number | string)[] = [];
    for (const uid of targets) {
      params.push(groupId, uid, messageId);
    }
    await this.mentionRepo.query(
      `INSERT INTO chat_mention (group_id, user_id, message_id) VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE message_id = VALUES(message_id)`,
      params,
    );
    for (const uid of targets) {
      await this.readRepo.query(
        `INSERT INTO chat_read (group_id, user_id, last_read_id, unread_mentions) VALUES (?, ?, 0, 1)
         ON DUPLICATE KEY UPDATE unread_mentions = unread_mentions + 1`,
        [groupId, uid],
      );
    }
  }

  private async persistAndEmit(
    group: ChatGroup,
    sender: Sender,
    payload: MessagePayload,
  ): Promise<ChatMessageView> {
    const mentions =
      payload.mentions !== undefined && payload.mentions.length > 0
        ? payload.mentions.slice(0, MENTION_CAP)
        : [];
    const entity = this.messageRepo.create({
      groupId: group.id,
      userId: sender.userId,
      senderRole: sender.role,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      kind: payload.kind,
      content: payload.content,
      imageUrl: payload.imageUrl === undefined ? null : payload.imageUrl,
      audioUrl: payload.audioUrl === undefined ? null : payload.audioUrl,
      durationMs: payload.durationMs === undefined ? null : payload.durationMs,
      audioWaveform:
        payload.audioWaveform === undefined ? null : payload.audioWaveform,
      replyToId: payload.replyToId === undefined ? null : payload.replyToId,
      mentions: mentions.length > 0 ? mentions.join(',') : null,
      status: 1,
    });
    const saved = await this.messageRepo.save(entity);
    await this.touchGroupLastMessage(group.id, Number(saved.id), saved.createdAt);
    const targets = mentions.filter((uid) => uid !== sender.userId);
    if (targets.length > 0) {
      await this.recordMentions(group.id, Number(saved.id), targets);
    }
    const replyMap =
      payload.replyToId !== undefined
        ? await this.resolveReplies([saved])
        : undefined;
    const view = this.view(saved, replyMap);
    this.emit(group, 'chat:new', view);
    await this.advanceRead(group.id, sender.userId, view.id);
    if (targets.length > 0) this.notifyMentions(group, view, targets);
    return view;
  }

  private resolveKind(payload: MessageInput): MessageKind {
    if (payload.kind !== undefined) return payload.kind;
    if (typeof payload.audioUrl === 'string' && payload.audioUrl !== '')
      return MessageKind.Voice;
    if (typeof payload.imageUrl === 'string' && payload.imageUrl !== '')
      return MessageKind.Image;
    return MessageKind.Text;
  }

  private async buildOutgoing(
    group: ChatGroup,
    content: string,
    payload: MessageInput,
    imageEnabled: boolean,
    voiceEnabled: boolean,
  ): Promise<MessagePayload> {
    const kind = this.resolveKind(payload);
    const hasImage =
      kind === MessageKind.Image &&
      typeof payload.imageUrl === 'string' &&
      payload.imageUrl !== '';
    const hasVoice =
      kind === MessageKind.Voice &&
      typeof payload.audioUrl === 'string' &&
      payload.audioUrl !== '';
    if (kind === MessageKind.System) {
      throw new BadRequestException('Invalid message kind');
    }
    if (kind === MessageKind.Image && !imageEnabled) {
      throw new BadRequestException('Image sharing is disabled');
    }
    if (kind === MessageKind.Voice && !voiceEnabled) {
      throw new BadRequestException('Voice messages are disabled');
    }
    if (kind === MessageKind.Image && !hasImage) {
      throw new BadRequestException('Image message requires an image');
    }
    if (kind === MessageKind.Voice && !hasVoice) {
      throw new BadRequestException('Voice message requires audio');
    }
    if (kind === MessageKind.Text && content === '') {
      throw new BadRequestException('Message is empty');
    }
    const replyToId =
      payload.replyToId !== undefined &&
      (await this.replyTargetValid(payload.replyToId, group.id))
        ? payload.replyToId
        : undefined;
    const mentions = await this.validateMentions(group, payload.mentions);
    return {
      content,
      kind,
      imageUrl: hasImage ? payload.imageUrl : undefined,
      audioUrl: hasVoice ? payload.audioUrl : undefined,
      durationMs: hasVoice ? payload.durationMs : undefined,
      audioWaveform: hasVoice ? payload.audioWaveform : undefined,
      replyToId,
      mentions,
    };
  }

  async sendUserMessage(userId: string, groupId: number, input: MessageInput) {
    const settings = await this.configLoader.getGroupChatSettings();
    if (!settings.enabled) {
      throw new BadRequestException('Group chat is currently disabled');
    }
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    if (group.postPolicy === PostPolicy.AdminOnly) {
      throw new ForbiddenException('Only admins can post in this group');
    }
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
      settings.voiceEnabled,
    );
    const user = await this.userRepo.findOne({
      where: { userId },
      select: { nickname: true, avatar: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.persistAndEmit(
      group,
      {
        userId,
        role: SenderRole.User,
        name: user.nickname === null ? '' : user.nickname,
        avatar: user.avatar,
      },
      outgoing,
    );
  }

  async sendAdminMessage(adminId: string, groupId: number, input: MessageInput) {
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
    if (group.isDm === 1 && group.dmAdminId === null) {
      await this.claimDm(adminId, group);
    }
    const content = input.content.replace(/\s+/g, ' ').trim();
    const outgoing = await this.buildOutgoing(
      group,
      content,
      input,
      settings.imageEnabled,
      settings.voiceEnabled,
    );
    const name = admin.displayName ? admin.displayName : admin.username;
    const avatar = admin.avatar ? admin.avatar : '';
    return this.persistAndEmit(
      group,
      { userId: `admin_${adminId}`, role: SenderRole.Admin, name, avatar },
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
    await this.resetMentionRead(groupId, userId, clamped);
    if (this.hasReceipts(group)) {
      const user = await this.userRepo.findOne({
        where: { userId },
        select: { nickname: true, avatar: true },
      });
      this.emit(group, 'chat:read', {
        groupId,
        userId,
        lastReadId: clamped,
        name: user === null || user.nickname === null ? '' : user.nickname,
        avatar: user === null ? '' : user.avatar,
      });
    }
    return { success: true };
  }

  async advanceDelivered(groupId: number, memberKey: string, messageId: number) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId, status: 1 },
    });
    if (group === null) return { success: false };
    if (!this.hasReceipts(group)) return { success: true };
    const max = Number(group.lastMessageId);
    const clamped = max > 0 && messageId > max ? max : messageId;
    if (clamped <= 0) return { success: true };
    await this.readRepo.query(
      `INSERT INTO chat_read (group_id, user_id, last_read_id, last_delivered_id) VALUES (?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE last_delivered_id = GREATEST(last_delivered_id, VALUES(last_delivered_id))`,
      [groupId, memberKey, clamped],
    );
    const payload: ChatDeliveredPayload = {
      groupId,
      userId: memberKey,
      lastDeliveredId: clamped,
    };
    this.wsGateway.emitToRoom(this.roomName(groupId), 'chat:delivered', payload);
    return { success: true };
  }

  async getDmReceipts(userId: string, groupId: number) {
    const group = await this.loadGroup(groupId);
    if (group.isDm !== 1) throw new BadRequestException('Not a direct message');
    await this.assertUserAccess(group, userId);
    const peerKey =
      group.dmAdminId === null ? null : `admin_${group.dmAdminId}`;
    if (peerKey === null) return { peerDeliveredId: 0, peerReadId: 0 };
    const row = await this.readRepo.findOne({
      where: { groupId, userId: peerKey },
      select: { lastDeliveredId: true, lastReadId: true },
    });
    return {
      peerDeliveredId: row === null ? 0 : Number(row.lastDeliveredId),
      peerReadId: row === null ? 0 : Number(row.lastReadId),
    };
  }

  async getMessageReaders(userId: string, groupId: number, messageId: number) {
    const group = await this.loadGroup(groupId);
    await this.assertUserAccess(group, userId);
    if (group.type !== GroupType.Private) {
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
    void adminId;
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
      where: { status: 1, isDm: 0 },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      avatar: g.avatar,
      description: g.description,
      sortOrder: g.sortOrder,
      joinPolicy: g.joinPolicy,
      postPolicy: g.postPolicy,
      visibility: g.visibility,
      isDm: g.isDm === 1,
      memberCount: g.memberCount,
    }));
  }

  async createGroup(
    input: {
      name: string;
      type: string;
      avatar: string;
      joinPolicy?: JoinPolicy;
      postPolicy?: PostPolicy;
      visibility?: Visibility;
      description?: string;
    },
    adminId: string,
  ) {
    const isPrivate = input.type === GroupType.Private;
    let joinPolicy: JoinPolicy;
    if (isPrivate) joinPolicy = JoinPolicy.Invite;
    else if (input.joinPolicy === undefined) joinPolicy = JoinPolicy.Open;
    else joinPolicy = input.joinPolicy;
    const postPolicy =
      input.postPolicy === undefined ? PostPolicy.All : input.postPolicy;
    const visibility =
      input.visibility === undefined ? Visibility.Listed : input.visibility;
    const description =
      input.description === undefined ? '' : input.description;
    const group = await this.groupRepo.save(
      this.groupRepo.create({
        name: input.name,
        type: isPrivate ? GroupType.Private : GroupType.Public,
        avatar: input.avatar,
        status: 1,
        createdBy: adminId,
        joinPolicy,
        postPolicy,
        visibility,
        description,
      }),
    );
    return { id: group.id };
  }

  async updateGroup(
    groupId: number,
    data: {
      name?: string;
      type?: string;
      avatar?: string;
      sortOrder?: number;
      joinPolicy?: JoinPolicy;
      postPolicy?: PostPolicy;
      visibility?: Visibility;
      description?: string;
    },
  ) {
    const group = await this.loadGroup(groupId);
    if (group.isDm === 1) {
      throw new BadRequestException('Direct messages cannot be edited');
    }
    const patch: Partial<ChatGroup> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined)
      patch.type =
        data.type === GroupType.Private ? GroupType.Private : GroupType.Public;
    if (data.avatar !== undefined) patch.avatar = data.avatar;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
    if (data.joinPolicy !== undefined) patch.joinPolicy = data.joinPolicy;
    if (data.postPolicy !== undefined) patch.postPolicy = data.postPolicy;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.description !== undefined) patch.description = data.description;
    await this.groupRepo.update(groupId, patch);
    const updated = await this.loadGroup(groupId);
    const payload: ChatGroupUpdatePayload = {
      groupId,
      name: updated.name,
      avatar: updated.avatar,
      description: updated.description,
      type: updated.type,
      joinPolicy: updated.joinPolicy,
      postPolicy: updated.postPolicy,
      visibility: updated.visibility,
    };
    this.wsGateway.emitToRoom(this.roomName(groupId), 'chat:group_update', payload);
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
      role: m.role,
      nickname: byId.get(m.userId)?.nickname ?? '',
      avatar: byId.get(m.userId)?.avatar ?? '',
      addedAt: m.createdAt,
    }));
  }

  async addMember(groupId: number, userId: string) {
    await this.loadGroup(groupId);
    const res = (await this.memberRepo.query(
      `INSERT IGNORE INTO chat_group_member (group_id, user_id, role) VALUES (?, ?, ?)`,
      [groupId, userId, MemberRole.Member],
    )) as WriteResult;
    if (res.affectedRows > 0) {
      await this.groupRepo.increment({ id: groupId }, 'memberCount', 1);
    }
    return { success: true };
  }

  async removeMember(groupId: number, userId: string) {
    const res = (await this.memberRepo.query(
      `DELETE FROM chat_group_member WHERE group_id = ? AND user_id = ?`,
      [groupId, userId],
    )) as WriteResult;
    if (res.affectedRows > 0) {
      await this.groupRepo.query(
        `UPDATE chat_group SET member_count = GREATEST(member_count - 1, 0) WHERE id = ?`,
        [groupId],
      );
    }
    return { success: true };
  }

  private parseDiscoverCursor(
    cursor: string | undefined,
  ): { sortOrder: number; id: number } | null {
    if (cursor === undefined || cursor === '') return null;
    const parts = cursor.split(':');
    if (parts.length !== 2) return null;
    const sortOrder = Number(parts[0]);
    const id = Number(parts[1]);
    if (!Number.isFinite(sortOrder) || !Number.isFinite(id)) return null;
    return { sortOrder, id };
  }

  private parseIdCursor(cursor: string | undefined): number | null {
    if (cursor === undefined || cursor === '') return null;
    const n = Number(cursor);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async discoverGroups(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    const take = Math.min(Math.max(1, limit), DISCOVER_MAX);
    const memberships = await this.memberRepo.find({
      where: { userId },
      select: { groupId: true },
    });
    const joined = new Set(memberships.map((m) => m.groupId));
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where(
        'g.status = 1 AND g.is_dm = 0 AND g.join_policy = :jp AND g.visibility = :vis',
        { jp: JoinPolicy.Open, vis: Visibility.Listed },
      );
    const parsed = this.parseDiscoverCursor(cursor);
    if (parsed !== null) {
      qb.andWhere(
        '(g.sort_order > :so OR (g.sort_order = :so AND g.id > :cid))',
        { so: parsed.sortOrder, cid: parsed.id },
      );
    }
    const rows = await qb
      .orderBy('g.sort_order', 'ASC')
      .addOrderBy('g.id', 'ASC')
      .take(take + 1)
      .getMany();
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last !== null ? `${last.sortOrder}:${last.id}` : null;
    const items = page.map((g) => ({
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      description: g.description,
      memberCount: g.memberCount,
      joinPolicy: g.joinPolicy,
      postPolicy: g.postPolicy,
      joined: joined.has(g.id),
    }));
    return { items, nextCursor };
  }

  async joinGroup(userId: string, groupId: number) {
    const group = await this.loadGroup(groupId);
    if (group.isDm === 1 || group.joinPolicy !== JoinPolicy.Open) {
      throw new BadRequestException('This group cannot be joined');
    }
    const res = (await this.memberRepo.query(
      `INSERT IGNORE INTO chat_group_member (group_id, user_id, role) VALUES (?, ?, ?)`,
      [groupId, userId, MemberRole.Member],
    )) as WriteResult;
    if (res.affectedRows > 0) {
      await this.groupRepo.increment({ id: groupId }, 'memberCount', 1);
      const payload: ChatJoinedPayload = { groupId, userId };
      this.wsGateway.emitToRoom(this.roomName(groupId), 'chat:joined', payload);
      this.wsGateway.sendToUser(userId, 'chat:joined', payload);
    }
    return { success: true, joined: true };
  }

  async leaveGroup(userId: string, groupId: number) {
    const group = await this.loadGroup(groupId);
    if (group.joinPolicy === JoinPolicy.Auto) {
      throw new BadRequestException('You cannot leave this group');
    }
    const res = (await this.memberRepo.query(
      `DELETE FROM chat_group_member WHERE group_id = ? AND user_id = ?`,
      [groupId, userId],
    )) as WriteResult;
    if (res.affectedRows > 0) {
      await this.groupRepo.query(
        `UPDATE chat_group SET member_count = GREATEST(member_count - 1, 0) WHERE id = ?`,
        [groupId],
      );
      const payload: ChatLeftPayload = { groupId, userId };
      this.wsGateway.emitToRoom(this.roomName(groupId), 'chat:left', payload);
      this.wsGateway.sendToUser(userId, 'chat:left', payload);
    }
    return { success: true };
  }

  private async createOrGetDmGroup(params: {
    dmKey: string;
    name: string;
    dmUserId: string;
    dmAdminId: string | null;
  }): Promise<ChatGroup> {
    await this.groupRepo.query(
      `INSERT INTO chat_group (name, type, join_policy, visibility, is_dm, dm_key, dm_admin_id, dm_user_id, status, member_count)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1, 0)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        params.name,
        GroupType.Private,
        JoinPolicy.Invite,
        Visibility.Unlisted,
        params.dmKey,
        params.dmAdminId,
        params.dmUserId,
      ],
    );
    const group = await this.groupRepo.findOne({
      where: { dmKey: params.dmKey },
    });
    if (group === null) throw new NotFoundException('DM group not found');
    return group;
  }

  private async addDmMember(
    groupId: number,
    memberKey: string,
    role: MemberRole,
  ): Promise<void> {
    await this.memberRepo.query(
      `INSERT IGNORE INTO chat_group_member (group_id, user_id, role) VALUES (?, ?, ?)`,
      [groupId, memberKey, role],
    );
    await this.groupRepo.query(
      `UPDATE chat_group SET member_count = (SELECT COUNT(*) FROM chat_group_member WHERE group_id = ?) WHERE id = ?`,
      [groupId, groupId],
    );
  }

  private async claimDm(adminId: string, group: ChatGroup): Promise<void> {
    const res = (await this.groupRepo.query(
      `UPDATE chat_group SET dm_admin_id = ? WHERE id = ? AND dm_admin_id IS NULL`,
      [adminId, group.id],
    )) as WriteResult;
    if (res.affectedRows === 0) return;
    await this.addDmMember(group.id, `admin_${adminId}`, MemberRole.Admin);
    const payload: ChatDmClaimedPayload = { groupId: group.id, adminId };
    if (group.dmUserId !== null) {
      this.wsGateway.sendToUser(group.dmUserId, 'chat:dm_claimed', payload);
    }
    this.wsGateway.sendToAdmins('chat:dm_claimed', payload);
  }

  private async lastMessageMap(
    ids: number[],
  ): Promise<Map<number, LastMessagePreview>> {
    const valid = ids.filter((id) => id > 0);
    if (valid.length === 0) return new Map();
    const rows = await this.messageRepo.find({
      where: { id: In(valid), status: 1 },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        senderName: true,
        createdAt: true,
        kind: true,
      },
    });
    return new Map(
      rows.map((m) => [
        Number(m.id),
        {
          content: m.content,
          imageUrl: m.imageUrl,
          senderName: m.senderName,
          createdAt: m.createdAt,
          kind: m.kind,
        },
      ]),
    );
  }

  private mapPreview(
    preview: LastMessagePreview | undefined,
  ): LastMessagePreview | null {
    return preview === undefined ? null : preview;
  }

  private async dmUnread(
    groupId: number,
    memberKey: string,
    lastMessageId: number,
  ): Promise<number> {
    if (lastMessageId <= 0) return 0;
    const read = await this.readRepo.findOne({
      where: { groupId, userId: memberKey },
      select: { lastReadId: true },
    });
    const lastRead = read === null ? 0 : Number(read.lastReadId);
    if (lastMessageId <= lastRead) return 0;
    return this.countUnread(groupId, lastRead);
  }

  private shapeDm(
    group: ChatGroup,
    peer: DmPeer,
    unread: number,
    preview: LastMessagePreview | null,
  ): DmItem {
    return {
      id: group.id,
      dmKey: group.dmKey,
      isDm: true,
      claimed: group.dmAdminId !== null,
      peer,
      unread,
      lastMessage: preview,
    };
  }

  private adminPeer(admin: AdminUser | null, adminId: string | null): DmPeer {
    if (admin === null || adminId === null) {
      return { kind: 'support', id: null, name: SUPPORT_PEER_NAME, avatar: '' };
    }
    const name =
      admin.displayName !== null && admin.displayName !== ''
        ? admin.displayName
        : admin.username;
    return {
      kind: 'admin',
      id: adminId,
      name,
      avatar: admin.avatar === null ? '' : admin.avatar,
    };
  }

  private userPeer(user: User | null, userId: string | null): DmPeer {
    if (user === null || userId === null) {
      return { kind: 'user', id: userId, name: '', avatar: '' };
    }
    return {
      kind: 'user',
      id: userId,
      name: user.nickname === null ? '' : user.nickname,
      avatar: user.avatar,
    };
  }

  async openSupportDm(userId: string): Promise<DmItem> {
    const settings = await this.configLoader.getGroupChatSettings();
    if (!settings.dmEnabled) {
      throw new BadRequestException('Direct messages are currently disabled');
    }
    const user = await this.userRepo.findOne({
      where: { userId },
      select: { nickname: true, avatar: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const dmKey = `dm:support:u${userId}`;
    const existing = await this.groupRepo.findOne({ where: { dmKey } });
    const group =
      existing !== null
        ? existing
        : await this.createOrGetDmGroup({
            dmKey,
            name: SUPPORT_PEER_NAME,
            dmUserId: userId,
            dmAdminId: null,
          });
    if (existing === null) {
      await this.addDmMember(group.id, userId, MemberRole.Member);
      const created: ChatDmCreatedPayload = {
        groupId: group.id,
        dmKey,
        userId,
        scope: DmScope.Queue,
      };
      this.wsGateway.sendToAdmins('chat:dm_created', created);
    }
    return this.buildUserDmItem(group, userId);
  }

  async adminOpenDm(adminId: string, userId: string): Promise<DmItem> {
    const settings = await this.configLoader.getGroupChatSettings();
    if (!settings.dmEnabled) {
      throw new BadRequestException('Direct messages are currently disabled');
    }
    const user = await this.userRepo.findOne({
      where: { userId },
      select: { nickname: true, avatar: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const dmKey = `dm:a${adminId}:u${userId}`;
    const existing = await this.groupRepo.findOne({ where: { dmKey } });
    const name = user.nickname === null || user.nickname === '' ? userId : user.nickname;
    const group =
      existing !== null
        ? existing
        : await this.createOrGetDmGroup({
            dmKey,
            name,
            dmUserId: userId,
            dmAdminId: adminId,
          });
    if (existing === null) {
      await this.addDmMember(group.id, userId, MemberRole.Member);
      await this.addDmMember(group.id, `admin_${adminId}`, MemberRole.Admin);
      const created: ChatDmCreatedPayload = {
        groupId: group.id,
        dmKey,
        userId,
        scope: DmScope.Mine,
      };
      this.wsGateway.sendToUser(userId, 'chat:dm_created', created);
      this.wsGateway.sendToAdmin(adminId, 'chat:dm_created', created);
    }
    return this.buildAdminDmItem(group, user, userId);
  }

  async adminClaimDm(adminId: string, groupId: number) {
    const group = await this.loadGroup(groupId);
    if (group.isDm !== 1) throw new BadRequestException('Not a direct message');
    if (group.dmAdminId !== null && group.dmAdminId !== adminId) {
      throw new ForbiddenException('This conversation is already claimed');
    }
    if (group.dmAdminId === null) await this.claimDm(adminId, group);
    return { success: true, groupId };
  }

  private async buildUserDmItem(
    group: ChatGroup,
    userId: string,
  ): Promise<DmItem> {
    const admin =
      group.dmAdminId === null
        ? null
        : await this.adminRepo.findOne({
            where: { id: Number(group.dmAdminId) },
            select: { id: true, username: true, displayName: true, avatar: true },
          });
    const peer = this.adminPeer(admin, group.dmAdminId);
    const unread = await this.dmUnread(
      group.id,
      userId,
      Number(group.lastMessageId),
    );
    const previewMap = await this.lastMessageMap([Number(group.lastMessageId)]);
    const preview =
      Number(group.lastMessageId) > 0
        ? this.mapPreview(previewMap.get(Number(group.lastMessageId)))
        : null;
    return this.shapeDm(group, peer, unread, preview);
  }

  private async buildAdminDmItem(
    group: ChatGroup,
    user: User | null,
    userId: string | null,
  ): Promise<DmItem> {
    const peer = this.userPeer(user, userId);
    const memberKey =
      group.dmAdminId === null ? `admin_0` : `admin_${group.dmAdminId}`;
    const unread = await this.dmUnread(
      group.id,
      memberKey,
      Number(group.lastMessageId),
    );
    const previewMap = await this.lastMessageMap([Number(group.lastMessageId)]);
    const preview =
      Number(group.lastMessageId) > 0
        ? this.mapPreview(previewMap.get(Number(group.lastMessageId)))
        : null;
    return this.shapeDm(group, peer, unread, preview);
  }

  async listUserDms(userId: string, cursor: string | undefined) {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g.is_dm = 1 AND g.status = 1 AND g.dm_user_id = :uid', {
        uid: userId,
      });
    const c = this.parseIdCursor(cursor);
    if (c !== null) qb.andWhere('g.last_message_id < :c', { c });
    const rows = await qb
      .orderBy('g.last_message_id', 'DESC')
      .take(DM_LIST_MAX + 1)
      .getMany();
    const hasMore = rows.length > DM_LIST_MAX;
    const page = hasMore ? rows.slice(0, DM_LIST_MAX) : rows;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last !== null ? String(last.lastMessageId) : null;
    const adminIds = page
      .map((g) => g.dmAdminId)
      .filter((x): x is string => x !== null);
    const admins =
      adminIds.length > 0
        ? await this.adminRepo.find({
            where: adminIds.map((id) => ({ id: Number(id) })),
            select: { id: true, username: true, displayName: true, avatar: true },
          })
        : [];
    const adminById = new Map(admins.map((a) => [String(a.id), a]));
    const lastMap = await this.lastMessageMap(
      page.map((g) => Number(g.lastMessageId)),
    );
    const items = await Promise.all(
      page.map(async (g) => {
        const admin =
          g.dmAdminId === null ? null : adminById.get(g.dmAdminId);
        const peer = this.adminPeer(admin === undefined ? null : admin, g.dmAdminId);
        const unread = await this.dmUnread(
          g.id,
          userId,
          Number(g.lastMessageId),
        );
        const preview =
          Number(g.lastMessageId) > 0
            ? this.mapPreview(lastMap.get(Number(g.lastMessageId)))
            : null;
        return this.shapeDm(g, peer, unread, preview);
      }),
    );
    return { items, nextCursor };
  }

  async listAdminDms(
    adminId: string,
    scope: DmScope,
    cursor: string | undefined,
  ) {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g.is_dm = 1 AND g.status = 1');
    if (scope === DmScope.Queue) {
      qb.andWhere('g.dm_admin_id IS NULL');
    } else {
      qb.andWhere('g.dm_admin_id = :aid', { aid: adminId });
    }
    const c = this.parseIdCursor(cursor);
    if (c !== null) qb.andWhere('g.last_message_id < :c', { c });
    const rows = await qb
      .orderBy('g.last_message_id', 'DESC')
      .take(DM_LIST_MAX + 1)
      .getMany();
    const hasMore = rows.length > DM_LIST_MAX;
    const page = hasMore ? rows.slice(0, DM_LIST_MAX) : rows;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last !== null ? String(last.lastMessageId) : null;
    const userIds = page
      .map((g) => g.dmUserId)
      .filter((x): x is string => x !== null);
    const users =
      userIds.length > 0
        ? await this.userRepo.find({
            where: userIds.map((uid) => ({ userId: uid })),
            select: { userId: true, nickname: true, avatar: true },
          })
        : [];
    const userById = new Map(users.map((u) => [u.userId, u]));
    const lastMap = await this.lastMessageMap(
      page.map((g) => Number(g.lastMessageId)),
    );
    const memberKey =
      scope === DmScope.Queue ? null : `admin_${adminId}`;
    const items = await Promise.all(
      page.map(async (g) => {
        const user = g.dmUserId === null ? undefined : userById.get(g.dmUserId);
        const peer = this.userPeer(user === undefined ? null : user, g.dmUserId);
        const unread =
          memberKey === null
            ? await this.countUnread(g.id, 0)
            : await this.dmUnread(g.id, memberKey, Number(g.lastMessageId));
        const preview =
          Number(g.lastMessageId) > 0
            ? this.mapPreview(lastMap.get(Number(g.lastMessageId)))
            : null;
        return this.shapeDm(g, peer, unread, preview);
      }),
    );
    return { items, nextCursor };
  }

  async getMentions(userId: string) {
    const rows = (await this.mentionRepo.query(
      `SELECT cm.id AS mentionId, cm.group_id AS groupId, cm.message_id AS messageId,
              g.name AS groupName, m.sender_name AS senderName, m.content AS content,
              m.kind AS kind, m.created_at AS createdAt,
              cr.last_read_mention_id AS lastReadMentionId
       FROM chat_mention cm
       JOIN chat_message m ON m.id = cm.message_id AND m.status = 1
       JOIN chat_group g ON g.id = cm.group_id AND g.status = 1
       LEFT JOIN chat_read cr ON cr.group_id = cm.group_id AND cr.user_id = cm.user_id
       WHERE cm.user_id = ?
       ORDER BY cm.message_id DESC
       LIMIT ?`,
      [userId, MENTIONS_LIST_CAP],
    )) as MentionRow[];
    return rows.map((r) => {
      const messageId = Number(r.messageId);
      const lastRead =
        r.lastReadMentionId === null ? 0 : Number(r.lastReadMentionId);
      return {
        mentionId: Number(r.mentionId),
        groupId: Number(r.groupId),
        messageId,
        groupName: r.groupName,
        senderName: r.senderName,
        kind: r.kind,
        preview: r.content.slice(0, MENTION_PREVIEW_LEN),
        createdAt: r.createdAt,
        unread: messageId > lastRead,
      };
    });
  }
}
