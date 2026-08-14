import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronJobConfig } from '../../entities/cron-job.entity';
import { CronRunRecorderService } from './cron-run-recorder.service';

@Module({
  imports: [TypeOrmModule.forFeature([CronJobConfig])],
  providers: [CronRunRecorderService],
  exports: [CronRunRecorderService],
})
export class CronModule {}
