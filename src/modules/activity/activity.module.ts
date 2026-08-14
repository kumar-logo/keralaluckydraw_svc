import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CheckinRecord } from '../../entities/checkin-record.entity';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { CheckinConfig } from '../../entities/checkin-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CheckinRecord,
      User,
      Transaction,
      SystemConfig,
      CheckinConfig,
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
