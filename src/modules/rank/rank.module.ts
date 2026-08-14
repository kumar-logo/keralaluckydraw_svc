import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankController } from './rank.controller';
import { RankService } from './rank.service';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { RankConfig } from '../../entities/rank-config.entity';
import { RankConfigPrize } from '../../entities/rank-config-prize.entity';
import { RankRecord } from '../../entities/rank-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Transaction,
      RankConfig,
      RankConfigPrize,
      RankRecord,
    ]),
  ],
  controllers: [RankController],
  providers: [RankService],
  exports: [RankService],
})
export class RankModule {}
