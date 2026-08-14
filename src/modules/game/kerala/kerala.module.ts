import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeralaController } from './kerala.controller';
import { KeralaService } from './kerala.service';
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
  controllers: [KeralaController],
  providers: [KeralaService],
  exports: [KeralaService],
})
export class KeralaModule {}
