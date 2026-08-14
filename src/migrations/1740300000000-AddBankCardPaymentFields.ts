import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankCardPaymentFields1740300000000 implements MigrationInterface {
  name = 'AddBankCardPaymentFields1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bank_cards');
    if (!table) {
      return;
    }
    if (!table.findColumnByName('gpay_id')) {
      await queryRunner.query(
        'ALTER TABLE `bank_cards` ADD COLUMN `gpay_id` varchar(100) DEFAULT NULL AFTER `upi_address`',
      );
    }
    if (!table.findColumnByName('phonepe_id')) {
      await queryRunner.query(
        'ALTER TABLE `bank_cards` ADD COLUMN `phonepe_id` varchar(100) DEFAULT NULL AFTER `gpay_id`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bank_cards');
    if (!table) {
      return;
    }
    if (table.findColumnByName('phonepe_id')) {
      await queryRunner.query(
        'ALTER TABLE `bank_cards` DROP COLUMN `phonepe_id`',
      );
    }
    if (table.findColumnByName('gpay_id')) {
      await queryRunner.query('ALTER TABLE `bank_cards` DROP COLUMN `gpay_id`');
    }
  }
}
