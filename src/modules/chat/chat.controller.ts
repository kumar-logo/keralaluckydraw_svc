import {
  Controller,
  Post,
  Body,
  HttpCode,
  Param,
  Delete,
  Get,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ThrottleProfile,
  CHAT_SEND_LIMIT,
  CHAT_UPLOAD_LIMIT,
} from '../../common/throttle/throttle.config';
import { ChatService } from './chat.service';
import { chatUploadOptions, chatImageUrl, removeChatUpload } from './chat-upload';
import {
  SendMessageDto,
  HistoryDto,
  AfterDto,
  ReadDto,
  MessageReadersDto,
  AdminSendMessageDto,
  CreateGroupDto,
  UpdateGroupDto,
  MuteUserDto,
  UserIdDto,
  MemberDto,
  PageQueryDto,
  ChatSettingsDto,
} from './chat.dto';

@Controller('hall/api/chat/v1')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('groups')
  listGroups(@CurrentUser('userId') userId: string) {
    return this.chatService.listGroupsForUser(userId);
  }

  @Get('unread')
  unread(@CurrentUser('userId') userId: string) {
    return this.chatService.getUnread(userId);
  }

  @HttpCode(200)
  @Post('history')
  history(@CurrentUser('userId') userId: string, @Body() dto: HistoryDto) {
    return this.chatService.getMessages(userId, dto.groupId, dto.beforeId, dto.limit);
  }

  @HttpCode(200)
  @Post('after')
  after(@CurrentUser('userId') userId: string, @Body() dto: AfterDto) {
    return this.chatService.getMessagesAfter(userId, dto.groupId, dto.afterId);
  }

  @HttpCode(200)
  @Post('read')
  read(@CurrentUser('userId') userId: string, @Body() dto: ReadDto) {
    return this.chatService.markRead(userId, dto.groupId, dto.messageId);
  }

  @HttpCode(200)
  @Post('readers')
  readers(@CurrentUser('userId') userId: string, @Body() dto: MessageReadersDto) {
    return this.chatService.getMessageReaders(userId, dto.groupId, dto.messageId);
  }

  @Throttle({ [ThrottleProfile.Default]: CHAT_UPLOAD_LIMIT })
  @HttpCode(200)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', chatUploadOptions))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const settings = await this.chatService.getChatSettings();
    if (!settings.enabled || !settings.imageEnabled) {
      await removeChatUpload(file.path);
      throw new BadRequestException('Image sharing is disabled');
    }
    return { url: chatImageUrl(file) };
  }

  @Throttle({ [ThrottleProfile.Default]: CHAT_SEND_LIMIT })
  @HttpCode(200)
  @Post('send')
  send(@CurrentUser('userId') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendUserMessage(userId, dto.groupId, {
      content: dto.content,
      imageUrl: dto.imageUrl,
      replyToId: dto.replyToId,
      mentions: dto.mentions,
    });
  }
}

@Controller('admin/api/v1/chat')
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('settings')
  getSettings() {
    return this.chatService.getChatSettings();
  }

  @Post('settings')
  updateSettings(@Body() dto: ChatSettingsDto) {
    return this.chatService.updateChatSettings(dto);
  }

  @Get('groups')
  listGroups() {
    return this.chatService.listGroupsAdmin();
  }

  @Post('groups')
  createGroup(@CurrentUser('sub') adminId: number, @Body() dto: CreateGroupDto) {
    return this.chatService.createGroup(dto.name, dto.type, dto.avatar, String(adminId));
  }

  @Post('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.chatService.updateGroup(Number(id), dto);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.chatService.deleteGroup(Number(id));
  }

  @Get('groups/:id/members')
  listMembers(@Param('id') id: string, @Query() page: PageQueryDto) {
    return this.chatService.listMembers(Number(id), page.skip, page.take);
  }

  @Post('members/add')
  addMember(@Body() dto: MemberDto) {
    return this.chatService.addMember(dto.groupId, dto.userId);
  }

  @Post('members/remove')
  removeMember(@Body() dto: MemberDto) {
    return this.chatService.removeMember(dto.groupId, dto.userId);
  }

  @HttpCode(200)
  @Post('history')
  history(@Body() dto: HistoryDto) {
    return this.chatService.getMessagesAsAdmin(dto.groupId, dto.beforeId, dto.limit);
  }

  @Throttle({ [ThrottleProfile.Default]: CHAT_UPLOAD_LIMIT })
  @HttpCode(200)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', chatUploadOptions))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const settings = await this.chatService.getChatSettings();
    if (!settings.enabled || !settings.imageEnabled) {
      await removeChatUpload(file.path);
      throw new BadRequestException('Image sharing is disabled');
    }
    return { url: chatImageUrl(file) };
  }

  @HttpCode(200)
  @Post('send')
  send(@CurrentUser('sub') adminId: number, @Body() dto: AdminSendMessageDto) {
    return this.chatService.sendAdminMessage(String(adminId), dto.groupId, {
      content: dto.content,
      imageUrl: dto.imageUrl,
      replyToId: dto.replyToId,
      mentions: dto.mentions,
    });
  }

  @Delete('message/:id')
  deleteMessage(@CurrentUser('sub') adminId: number, @Param('id') id: string) {
    return this.chatService.deleteMessage(Number(id), String(adminId));
  }

  @Delete('group/:id/messages')
  clearGroupMessages(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: string,
  ) {
    return this.chatService.clearGroupMessages(Number(id), String(adminId));
  }

  @Post('mute')
  mute(@CurrentUser('sub') adminId: number, @Body() dto: MuteUserDto) {
    return this.chatService.muteUser(dto.userId, dto.minutes, dto.reason, String(adminId));
  }

  @Post('unmute')
  unmute(@Body() dto: UserIdDto) {
    return this.chatService.unmuteUser(dto.userId);
  }

  @Get('muted')
  listMuted(@Query() page: PageQueryDto) {
    return this.chatService.listMuted(page.skip, page.take);
  }
}
