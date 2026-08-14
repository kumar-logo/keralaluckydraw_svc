import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreeDigitController } from './three-digit.controller';
import { ThreeDigitService } from './three-digit.service';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { SharedGameModule } from '../shared/shared-game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameList, GameRound, Order, User, Transaction]),
    SharedGameModule,
  ],
  controllers: [ThreeDigitController],
  providers: [ThreeDigitService],
  exports: [ThreeDigitService],
})
export class ThreeDigitModule {}
