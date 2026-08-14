import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargeProof1739900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('recharge_records');
    if (!table?.findColumnByName('proof_image')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` ADD COLUMN `proof_image` MEDIUMTEXT NULL',
      );
    }
    if (!table?.findColumnByName('payment_ref')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` ADD COLUMN `payment_ref` VARCHAR(100) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('recharge_records');
    if (table?.findColumnByName('proof_image')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` DROP COLUMN `proof_image`',
      );
    }
    if (table?.findColumnByName('payment_ref')) {
      await queryRunner.query(
        'ALTER TABLE `recharge_records` DROP COLUMN `payment_ref`',
      );
    }
  }
}
