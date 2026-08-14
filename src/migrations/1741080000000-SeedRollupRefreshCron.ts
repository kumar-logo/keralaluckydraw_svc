import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRollupRefreshCron1741080000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO cron_jobs (name, cron_expression, enabled) VALUES
         ('rollup-refresh', '0 */5 * * * *', 1)
       ON DUPLICATE KEY UPDATE name = name`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM cron_jobs WHERE name = 'rollup-refresh'`,
    );
  }
}
