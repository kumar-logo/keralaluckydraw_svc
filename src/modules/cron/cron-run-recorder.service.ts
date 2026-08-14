import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronJobConfig } from '../../entities/cron-job.entity';

@Injectable()
export class CronRunRecorderService {
  constructor(
    @InjectRepository(CronJobConfig)
    private readonly repo: Repository<CronJobConfig>,
  ) {}

  async run(name: string, work: () => Promise<void>): Promise<void> {
    const startedAt = new Date();
    try {
      await work();
      await this.persist(name, startedAt, 'ok', null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.persist(name, startedAt, 'error', message);
      throw error;
    }
  }

  private async persist(
    name: string,
    startedAt: Date,
    status: string,
    error: string | null,
  ): Promise<void> {
    await this.repo.update(
      { name },
      {
        lastRun: startedAt,
        lastStatus: status,
        lastError: error ? error.slice(0, 255) : null,
        lastDurationMs: Date.now() - startedAt.getTime(),
      },
    );
  }
}
