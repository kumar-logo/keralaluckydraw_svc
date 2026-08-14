import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenRollupUniqueKey1741070000000 implements MigrationInterface {
  name = 'WidenRollupUniqueKey1741070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('lottery_sales_rollup');
    if (!tableExists) return;

    const idxExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lottery_sales_rollup'
         AND INDEX_NAME = 'uk_rollup_slice'`,
    );
    if (Number(idxExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(
        `ALTER TABLE lottery_sales_rollup DROP INDEX uk_rollup_slice`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE lottery_sales_rollup
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot_time, slot, position, number, price, win_price)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('lottery_sales_rollup');
    if (!tableExists) return;

    const idxExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lottery_sales_rollup'
         AND INDEX_NAME = 'uk_rollup_slice'`,
    );
    if (Number(idxExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(
        `ALTER TABLE lottery_sales_rollup DROP INDEX uk_rollup_slice`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE lottery_sales_rollup
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot_time, slot, position, number)`,
    );
  }
}
