import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ChatGroup } from '../../entities/chat-group.entity';
import { ChatGroupMember } from '../../entities/chat-group-member.entity';
import { ChatMention } from '../../entities/chat-mention.entity';
import { ChatMute } from '../../entities/chat-mute.entity';
import { ChatRead } from '../../entities/chat-read.entity';
import { User } from '../../entities/user.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { WsModule } from '../websocket/ws.module';
import { ConfigModule } from '../config/config.module';
import { ChatService } from './chat.service';
import { ChatController, AdminChatController } from './chat.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatMessage,
      ChatGroup,
      ChatGroupMember,
      ChatMention,
      ChatMute,
      ChatRead,
      User,
      AppConfig,
      AdminUser,
    ]),
    WsModule,
    ConfigModule,
  ],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
