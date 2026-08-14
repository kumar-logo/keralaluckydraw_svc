import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThirdPartyController } from './third-party.controller';
import { ThirdPartyService } from './third-party.service';
import { ThirdPartyConfig } from '../../entities/third-party-config.entity';
import { ThirdPartyTransaction } from '../../entities/third-party-transaction.entity';
import { User } from '../../entities/user.entity';
import { GameList } from '../../entities/game-list.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThirdPartyConfig,
      ThirdPartyTransaction,
      User,
      GameList,
    ]),
  ],
  controllers: [ThirdPartyController],
  providers: [ThirdPartyService],
  exports: [ThirdPartyService],
})
export class ThirdPartyModule {}
