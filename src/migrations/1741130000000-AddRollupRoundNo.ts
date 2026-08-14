import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRollupRoundNo1741130000000 implements MigrationInterface {
  name = 'AddRollupRoundNo1741130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('lottery_sales_rollup');
    if (!tableExists) return;

    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lottery_sales_rollup'
         AND COLUMN_NAME = 'round_no'`,
    );
    if (Number(columnExists?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE lottery_sales_rollup
           ADD COLUMN round_no varchar(30) NOT NULL DEFAULT '' AFTER slot_time`,
      );
    }

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
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot_time, round_no, slot, position, number, price, win_price)`,
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
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot_time, slot, position, number, price, win_price)`,
    );

    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lottery_sales_rollup'
         AND COLUMN_NAME = 'round_no'`,
    );
    if (Number(columnExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(
        `ALTER TABLE lottery_sales_rollup DROP COLUMN round_no`,
      );
    }
  }
}
