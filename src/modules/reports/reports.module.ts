import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryReportController } from './lottery-report.controller';
import { LotteryReportService } from './lottery-report.service';
import { LotterySalesRollup } from '../../entities/lottery-sales-rollup.entity';
import { GameList } from '../../entities/game-list.entity';
import { GameRound } from '../../entities/game-round.entity';
import { GameSlatTier } from '../../entities/game-slat-tier.entity';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { CronModule } from '../cron/cron.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LotterySalesRollup,
      GameList,
      GameRound,
      GameSlatTier,
      Order,
      User,
    ]),
    CronModule,
  ],
  controllers: [LotteryReportController],
  providers: [LotteryReportService],
  exports: [LotteryReportService],
})
export class ReportsModule {}
