import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentGatewayMode1739400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_gateways');
    if (!table?.findColumnByName('mode')) {
      await queryRunner.query(
        "ALTER TABLE `payment_gateways` ADD COLUMN `mode` VARCHAR(10) NOT NULL DEFAULT 'auto'",
      );
    }
    await queryRunner.query(
      "UPDATE `payment_gateways` SET `mode` = 'manual' WHERE `provider_code` IN ('manual', 'manual_upi', 'bank_transfer') OR `api_url` IS NULL OR `api_url` = ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_gateways');
    if (table?.findColumnByName('mode')) {
      await queryRunner.query(
        'ALTER TABLE `payment_gateways` DROP COLUMN `mode`',
      );
    }
  }
}
