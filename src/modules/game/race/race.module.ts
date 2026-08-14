import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaceController } from './race.controller';
import { RaceService } from './race.service';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { RaceRunnerFrame } from '../../../entities/race-runner-frame.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { SharedGameModule } from '../shared/shared-game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameList,
      GameRound,
      Order,
      RaceRunnerFrame,
      User,
      Transaction,
      GameOddsConfig,
    ]),
    SharedGameModule,
  ],
  controllers: [RaceController],
  providers: [RaceService],
  exports: [RaceService],
})
export class RaceModule {}
