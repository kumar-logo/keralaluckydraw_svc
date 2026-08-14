import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentGatewayRequireProof1741060000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'payment_gateways'
         AND column_name = 'require_proof'`,
    );
    if (Number(existing?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE payment_gateways
           ADD COLUMN require_proof TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payment_gateways DROP COLUMN require_proof`,
    );
  }
}
