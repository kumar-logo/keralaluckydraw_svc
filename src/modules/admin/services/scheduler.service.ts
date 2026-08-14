import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronJob, CronTime } from 'cron';
import { CronJobConfig } from '../../../entities/cron-job.entity';
import { TinyFlag, CronJobName } from '../../../common/enums';
import { UpdateCronJobDto } from '../dto/admin.dto';

const PROTECTED_JOBS: ReadonlySet<string> = new Set<string>([
  CronJobName.RechargeReconcile,
]);

export interface CronJobStatus {
  name: string;
  cronExpression: string;
  enabled: boolean;
  managed: boolean;
  running: boolean;
  nextRun: string | null;
  lastRun: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
}

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(CronJobConfig)
    private cronRepo: Repository<CronJobConfig>,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const configs = await this.cronRepo.find();
    for (const config of configs) {
      const job = this.findJob(config.name);
      if (!job) {
        this.logger.warn(
          `Cron config "${config.name}" has no registered job; skipping`,
        );
        continue;
      }
      try {
        job.setTime(new CronTime(config.cronExpression));
      } catch (error) {
        this.logger.error(
          `Invalid stored cron expression for "${config.name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }
      if (PROTECTED_JOBS.has(config.name)) {
        if (config.enabled !== TinyFlag.Yes) {
          config.enabled = TinyFlag.Yes;
          await this.cronRepo.save(config);
        }
        job.start();
        continue;
      }
      if (config.enabled === TinyFlag.Yes) {
        job.start();
      } else {
        job.stop();
      }
    }
  }

  async getStatus(): Promise<CronJobStatus[]> {
    const configs = await this.cronRepo.find();
    const configByName = new Map(configs.map((c) => [c.name, c]));
    const jobs = this.schedulerRegistry.getCronJobs();
    const statuses: CronJobStatus[] = [];
    jobs.forEach((job, name) => {
      const config = configByName.get(name);
      statuses.push(this.toStatus(name, job, config));
    });
    return statuses.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateJob(
    name: string,
    dto: UpdateCronJobDto,
  ): Promise<CronJobStatus> {
    const config = await this.cronRepo.findOne({ where: { name } });
    if (!config) {
      throw new NotFoundException(`Cron job "${name}" is not managed`);
    }
    const job = this.findJob(name);
    if (!job) {
      throw new NotFoundException(`Cron job "${name}" is not registered`);
    }

    if (dto.cronExpression !== undefined) {
      const expression = dto.cronExpression.trim();
      this.assertValidExpression(expression);
      config.cronExpression = expression;
    }
    if (dto.enabled !== undefined) {
      if (PROTECTED_JOBS.has(name) && !dto.enabled) {
        throw new BadRequestException(
          `Cron job "${name}" is protected and cannot be disabled`,
        );
      }
      config.enabled = dto.enabled ? TinyFlag.Yes : TinyFlag.No;
    }

    await this.cronRepo.save(config);

    job.setTime(new CronTime(config.cronExpression));
    if (config.enabled === TinyFlag.Yes) {
      job.start();
    } else {
      job.stop();
    }

    return this.toStatus(name, job, config);
  }

  private assertValidExpression(expression: string): void {
    try {
      new CronTime(expression);
    } catch (error) {
      throw new BadRequestException(
        `Invalid cron expression: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private findJob(name: string): CronJob<null, null> | null {
    if (!this.schedulerRegistry.doesExist('cron', name)) {
      return null;
    }
    return this.schedulerRegistry.getCronJob(name);
  }

  private toStatus(
    name: string,
    job: CronJob<null, null>,
    config: CronJobConfig | undefined,
  ): CronJobStatus {
    const nextDate = job.nextDate();
    const lastDate = job.lastDate();
    const persistedLastRun = config && config.lastRun ? config.lastRun : null;
    return {
      name,
      cronExpression: config ? config.cronExpression : job.cronTime.toString(),
      enabled: config ? config.enabled === TinyFlag.Yes : job.running,
      managed: config !== undefined,
      running: job.running,
      nextRun: nextDate.isValid ? nextDate.toISO() : null,
      lastRun: persistedLastRun
        ? new Date(persistedLastRun).toISOString()
        : lastDate
          ? lastDate.toISOString()
          : null,
      lastStatus: config ? config.lastStatus : null,
      lastError: config ? config.lastError : null,
      lastDurationMs: config ? config.lastDurationMs : null,
    };
  }
}
