import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentGatewayManualFallback1741150000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'payment_gateways'
         AND column_name = 'manual_fallback'`,
    );
    if (Number(existing?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE payment_gateways
           ADD COLUMN manual_fallback TINYINT(1) NOT NULL DEFAULT 0 AFTER additional_verification`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payment_gateways DROP COLUMN manual_fallback`,
    );
  }
}
