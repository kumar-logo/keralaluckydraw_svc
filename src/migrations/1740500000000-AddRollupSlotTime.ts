import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRollupSlotTime1740500000000 implements MigrationInterface {
  name = 'AddRollupSlotTime1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const colExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lottery_sales_rollup'
         AND COLUMN_NAME = 'slot_time'`,
    );
    if (Number(colExists?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE lottery_sales_rollup
           ADD COLUMN slot_time VARCHAR(5) NOT NULL DEFAULT '' AFTER draw_date`,
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
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot_time, slot, position, number)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`TRUNCATE TABLE lottery_sales_rollup`);
    await queryRunner.query(
      `ALTER TABLE lottery_sales_rollup
         ADD UNIQUE INDEX uk_rollup_slice (game_id, draw_date, slot, position, number)`,
    );
    await queryRunner.query(
      `ALTER TABLE lottery_sales_rollup DROP COLUMN slot_time`,
    );
  }
}
