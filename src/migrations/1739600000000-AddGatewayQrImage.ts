import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGatewayQrImage1739600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_gateways');
    if (!table?.findColumnByName('qr_image_url')) {
      await queryRunner.query(
        'ALTER TABLE `payment_gateways` ADD COLUMN `qr_image_url` VARCHAR(500) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_gateways');
    if (table?.findColumnByName('qr_image_url')) {
      await queryRunner.query(
        'ALTER TABLE `payment_gateways` DROP COLUMN `qr_image_url`',
      );
    }
  }
}
