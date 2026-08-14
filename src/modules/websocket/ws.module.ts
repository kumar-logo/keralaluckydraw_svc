import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsGateway } from './ws.gateway';
import { SpaWsService } from './spa-ws.service';
import { GameEventsService } from './game-events.service';
import { GameEventsController } from './game-events.controller';
import { Announcement } from '../../entities/announcement.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { ChatGroup } from '../../entities/chat-group.entity';
import { ChatGroupMember } from '../../entities/chat-group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      SystemConfig,
      ChatGroup,
      ChatGroupMember,
    ]),
  ],
  controllers: [GameEventsController],
  providers: [WsGateway, SpaWsService, GameEventsService],
  exports: [WsGateway, SpaWsService, GameEventsService],
})
export class WsModule {}
