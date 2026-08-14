import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysteryBoxController } from './mystery-box.controller';
import { MysteryBoxService } from './mystery-box.service';
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
  controllers: [MysteryBoxController],
  providers: [MysteryBoxService],
  exports: [MysteryBoxService],
})
export class MysteryBoxModule {}
