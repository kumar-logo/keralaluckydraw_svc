import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCronLastRun1741240000000 implements MigrationInterface {
  name = 'AddCronLastRun1741240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`cron_jobs\`
         ADD COLUMN IF NOT EXISTS \`last_run\` datetime NULL AFTER \`enabled\`,
         ADD COLUMN IF NOT EXISTS \`last_status\` varchar(16) NULL AFTER \`last_run\`,
         ADD COLUMN IF NOT EXISTS \`last_error\` varchar(255) NULL AFTER \`last_status\`,
         ADD COLUMN IF NOT EXISTS \`last_duration_ms\` int NULL AFTER \`last_error\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`cron_jobs\`
         DROP COLUMN IF EXISTS \`last_run\`,
         DROP COLUMN IF EXISTS \`last_status\`,
         DROP COLUMN IF EXISTS \`last_error\`,
         DROP COLUMN IF EXISTS \`last_duration_ms\``,
    );
  }
}
