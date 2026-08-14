import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppConfigPayment1737500000000 implements MigrationInterface {
  name = 'AddAppConfigPayment1737500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `app_config` ADD COLUMN `active_payment_gateway` varchar(50) NOT NULL DEFAULT 'manual'",
    );
    await queryRunner.query(
      "ALTER TABLE `app_config` ADD COLUMN `manual_pay_url` varchar(255) NOT NULL DEFAULT '/pay'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN `manual_pay_url`',
    );
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN `active_payment_gateway`',
    );
  }
}
