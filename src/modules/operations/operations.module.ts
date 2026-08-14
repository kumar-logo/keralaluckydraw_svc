import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { Banner } from '../../entities/banner.entity';
import { SharePoster } from '../../entities/share-poster.entity';
import { Announcement } from '../../entities/announcement.entity';
import { Popup } from '../../entities/popup.entity';
import { GameList } from '../../entities/game-list.entity';
import { GameRound } from '../../entities/game-round.entity';
import { UserFavorite } from '../../entities/user-favorite.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CdkeyCode } from '../../entities/cdkey-code.entity';
import { CdkeyUsage } from '../../entities/cdkey-usage.entity';
import { ThirdPartyModule } from '../third-party/third-party.module';
import { FcmModule } from '../fcm/fcm.module';
import { AppVersionModule } from '../app-version/app-version.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Banner,
      SharePoster,
      Announcement,
      Popup,
      GameList,
      GameRound,
      UserFavorite,
      SystemConfig,
      User,
      Transaction,
      CdkeyCode,
      CdkeyUsage,
    ]),
    ThirdPartyModule,
    FcmModule,
    AppVersionModule,
  ],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
