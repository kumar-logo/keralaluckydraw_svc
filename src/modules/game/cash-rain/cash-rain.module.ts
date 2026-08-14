import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRainController } from './cash-rain.controller';
import { CashRainService } from './cash-rain.service';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { CashrainWindow } from '../../../entities/cashrain-window.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameList,
      GameRound,
      Order,
      User,
      CashrainWindow,
    ]),
  ],
  controllers: [CashRainController],
  providers: [CashRainService],
  exports: [CashRainService],
})
export class CashRainModule {}
