import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargeRemark1739500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('recharge_records');
    if (!table?.findColumnByName('remark')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` ADD COLUMN `remark` VARCHAR(255) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('recharge_records');
    if (table?.findColumnByName('remark')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` DROP COLUMN `remark`',
      );
    }
  }
}
