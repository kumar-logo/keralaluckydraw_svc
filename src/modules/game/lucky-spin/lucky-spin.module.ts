import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LuckySpinController } from './lucky-spin.controller';
import { LuckySpinService } from './lucky-spin.service';
import { GameList } from '../../../entities/game-list.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { SharedGameModule } from '../shared/shared-game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameList, Order, User, Transaction]),
    SharedGameModule,
  ],
  controllers: [LuckySpinController],
  providers: [LuckySpinService],
  exports: [LuckySpinService],
})
export class LuckySpinModule {}
