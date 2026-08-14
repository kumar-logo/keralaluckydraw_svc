import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentGatewayType1740940000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'payment_gateways'
         AND column_name = 'gateway_type'`,
    );
    if (Number(existing?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE payment_gateways
           ADD COLUMN gateway_type VARCHAR(50) NULL AFTER provider_code`,
      );
    }
    await queryRunner.query(
      `UPDATE payment_gateways
         SET gateway_type = provider_code
       WHERE gateway_type IS NULL OR gateway_type = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payment_gateways DROP COLUMN gateway_type`,
    );
  }
}
