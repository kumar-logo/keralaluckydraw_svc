import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCronJobs1741040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        name VARCHAR(64) NOT NULL,
        cron_expression VARCHAR(120) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(
      `INSERT INTO cron_jobs (name, cron_expression, enabled) VALUES
         ('round-cleanup', '0 03 * * *', 1),
         ('recharge-reconcile', '30 */5 * * * *', 1),
         ('daily-rebate', '0 5 0 * * *', 1),
         ('vip-level-update', '0 10 0 * * *', 1),
         ('daily-commission', '0 15 0 * * *', 1)
       ON DUPLICATE KEY UPDATE name = name`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cron_jobs`);
  }
}
