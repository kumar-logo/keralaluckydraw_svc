import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRollupDrawAmount1741220000000 implements MigrationInterface {
  name = 'AddRollupDrawAmount1741220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lottery_sales_rollup\`
         ADD COLUMN IF NOT EXISTS \`draw_amount\` decimal(16,2) NOT NULL DEFAULT 0 AFTER \`draw_qty\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `lottery_sales_rollup` DROP COLUMN IF EXISTS `draw_amount`',
    );
  }
}
