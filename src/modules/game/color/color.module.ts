import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorController } from './color.controller';
import { ColorService } from './color.service';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
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
      User,
      Transaction,
      GameOddsConfig,
    ]),
    SharedGameModule,
  ],
  controllers: [ColorController],
  providers: [ColorService],
  exports: [ColorService],
})
export class ColorModule {}
