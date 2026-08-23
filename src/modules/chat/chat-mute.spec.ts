import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ChatService, CHAT_MUTED_MESSAGE } from './chat.service';
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
import { ChatEvent } from './chat.events';
import {
  GroupType,
  JoinPolicy,
  MessageKind,
  PostPolicy,
  SenderRole,
  Visibility,
} from './chat.enums';

const NOW = new Date('2026-06-01T12:00:00.000Z').getTime();
const MINUTE_MS = 60000;

const group = {
  id: 7,
  name: 'General',
  type: GroupType.Public,
  avatar: '',
  description: '',
  sortOrder: 0,
  joinPolicy: JoinPolicy.Auto,
  postPolicy: PostPolicy.All,
  visibility: Visibility.Listed,
  isDm: 0,
  dmKey: null,
  dmUserId: null,
  dmAdminId: null,
  memberCount: 1,
  lastMessageId: 0,
  lastMessageAt: null,
  status: 1,
} as unknown as ChatGroup;

interface Harness {
  service: ChatService;
  muteFindOne: jest.Mock;
  muteDelete: jest.Mock;
  save: jest.Mock;
  sendToUser: jest.Mock;
}

const buildHarness = (muteRow: Partial<ChatMute> | null): Harness => {
  const muteFindOne = jest.fn().mockResolvedValue(muteRow);
  const muteDelete = jest.fn().mockResolvedValue({ affected: 1 });
  const muteUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const muteSave = jest.fn().mockResolvedValue(undefined);
  const save = jest.fn().mockImplementation((entity: Partial<ChatMessage>) =>
    Promise.resolve({
      ...entity,
      id: 101,
      createdAt: new Date(NOW),
    }),
  );
  const sendToUser = jest.fn();
  const messageRepo = {
    create: jest.fn().mockImplementation((entity: Partial<ChatMessage>) => entity),
    save,
  };
  const groupRepo = {
    findOne: jest.fn().mockResolvedValue(group),
    query: jest.fn().mockResolvedValue(undefined),
  };
  const readRepo = { query: jest.fn().mockResolvedValue(undefined) };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ nickname: 'Player', avatar: '' }),
  };
  const adminRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ username: 'root', displayName: 'Admin', avatar: '' }),
  };
  const muteRepo = {
    findOne: muteFindOne,
    delete: muteDelete,
    update: muteUpdate,
    save: muteSave,
    create: jest.fn().mockImplementation((row: Partial<ChatMute>) => row),
  };
  const wsGateway = { emitToRoom: jest.fn(), sendToUser };
  const configLoader = {
    getGroupChatSettings: jest.fn().mockResolvedValue({
      enabled: true,
      blockLinks: false,
      imageEnabled: true,
      voiceEnabled: true,
      dmEnabled: true,
      badWords: '',
    }),
  };
  const service = new ChatService(
    messageRepo as unknown as Repository<ChatMessage>,
    groupRepo as unknown as Repository<ChatGroup>,
    {} as Repository<ChatGroupMember>,
    {} as Repository<ChatMention>,
    muteRepo as unknown as Repository<ChatMute>,
    readRepo as unknown as Repository<ChatRead>,
    userRepo as unknown as Repository<User>,
    {} as Repository<AppConfig>,
    adminRepo as unknown as Repository<AdminUser>,
    wsGateway as unknown as WsGateway,
    configLoader as unknown as ConfigLoaderService,
  );
  return { service, muteFindOne, muteDelete, save, sendToUser };
};

const textInput = { content: 'hello everyone', kind: MessageKind.Text };

describe('chat mute enforcement', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a user with a PERMANENT mute row (mutedUntil null)', async () => {
    const h = buildHarness({ userId: 'u1', mutedUntil: null, reason: 'spam' });
    await expect(
      h.service.sendUserMessage('u1', group.id, textInput),
    ).rejects.toThrow(ForbiddenException);
    expect(h.save).not.toHaveBeenCalled();
  });

  it('rejects a user whose mutedUntil is in the FUTURE', async () => {
    const h = buildHarness({
      userId: 'u1',
      mutedUntil: new Date(NOW + 10 * MINUTE_MS),
      reason: '',
    });
    await expect(
      h.service.sendUserMessage('u1', group.id, textInput),
    ).rejects.toThrow(CHAT_MUTED_MESSAGE);
    expect(h.save).not.toHaveBeenCalled();
  });

  it('allows a user whose mutedUntil is in the PAST', async () => {
    const h = buildHarness({
      userId: 'u1',
      mutedUntil: new Date(NOW - MINUTE_MS),
      reason: '',
    });
    const view = await h.service.sendUserMessage('u1', group.id, textInput);
    expect(view.content).toBe('hello everyone');
    expect(view.senderRole).toBe(SenderRole.User);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it('allows a user with no mute row at all', async () => {
    const h = buildHarness(null);
    const view = await h.service.sendUserMessage('u1', group.id, textInput);
    expect(view.id).toBe(101);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it('does NOT block an admin send while that user id is muted', async () => {
    const h = buildHarness({ userId: '1', mutedUntil: null, reason: 'spam' });
    const view = await h.service.sendAdminMessage('1', group.id, textInput);
    expect(view.senderRole).toBe(SenderRole.Admin);
    expect(h.muteFindOne).not.toHaveBeenCalled();
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it('getMuteState reports permanent, timed, expired and absent mutes', async () => {
    const permanent = buildHarness({
      userId: 'u1',
      mutedUntil: null,
      reason: 'spam',
    });
    await expect(permanent.service.getMuteState('u1')).resolves.toEqual({
      muted: true,
      mutedUntil: null,
      reason: 'spam',
    });

    const until = new Date(NOW + 30 * MINUTE_MS);
    const timed = buildHarness({ userId: 'u1', mutedUntil: until, reason: 'ads' });
    await expect(timed.service.getMuteState('u1')).resolves.toEqual({
      muted: true,
      mutedUntil: until.toISOString(),
      reason: 'ads',
    });

    const expired = buildHarness({
      userId: 'u1',
      mutedUntil: new Date(NOW - 1),
      reason: 'ads',
    });
    await expect(expired.service.getMuteState('u1')).resolves.toEqual({
      muted: false,
      mutedUntil: null,
      reason: '',
    });

    const none = buildHarness(null);
    await expect(none.service.getMuteState('u1')).resolves.toEqual({
      muted: false,
      mutedUntil: null,
      reason: '',
    });
  });

  it('mutedUntil exactly at now counts as expired (boundary)', async () => {
    const h = buildHarness({
      userId: 'u1',
      mutedUntil: new Date(NOW),
      reason: '',
    });
    await expect(h.service.isMuted('u1')).resolves.toBe(false);
  });

  it('muteUser pushes the live mute state to that user only', async () => {
    const h = buildHarness(null);
    await h.service.muteUser('u1', 15, 'spam', '1');
    expect(h.sendToUser).toHaveBeenCalledTimes(1);
    expect(h.sendToUser).toHaveBeenCalledWith('u1', ChatEvent.MuteState, {
      muted: true,
      mutedUntil: new Date(NOW + 15 * MINUTE_MS).toISOString(),
      reason: 'spam',
    });
  });

  it('unmuteUser pushes a cleared mute state to that user only', async () => {
    const h = buildHarness(null);
    await h.service.unmuteUser('u1');
    expect(h.muteDelete).toHaveBeenCalledWith({ userId: 'u1' });
    expect(h.sendToUser).toHaveBeenCalledTimes(1);
    expect(h.sendToUser).toHaveBeenCalledWith('u1', ChatEvent.MuteState, {
      muted: false,
      mutedUntil: null,
      reason: '',
    });
  });
});
