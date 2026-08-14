import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('cron_jobs')
export class CronJobConfig {
  @PrimaryColumn({ name: 'name', type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'cron_expression', type: 'varchar', length: 120 })
  cronExpression: string;

  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled: number;

  @Column({ name: 'last_run', type: 'datetime', nullable: true })
  lastRun: Date | null;

  @Column({ name: 'last_status', type: 'varchar', length: 16, nullable: true })
  lastStatus: string | null;

  @Column({ name: 'last_error', type: 'varchar', length: 255, nullable: true })
  lastError: string | null;

  @Column({ name: 'last_duration_ms', type: 'int', nullable: true })
  lastDurationMs: number | null;
}
