import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargePaymentRefUnique1741010000000 implements MigrationInterface {
  name = 'AddRechargePaymentRefUnique1741010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing: { INDEX_NAME: string }[] = await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records' AND INDEX_NAME = 'UQ_recharge_records_payment_ref'`,
    );
    if (existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`recharge_records\` ADD UNIQUE INDEX \`UQ_recharge_records_payment_ref\` (\`payment_ref\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existing: { INDEX_NAME: string }[] = await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records' AND INDEX_NAME = 'UQ_recharge_records_payment_ref'`,
    );
    if (existing.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`recharge_records\` DROP INDEX \`UQ_recharge_records_payment_ref\``,
      );
    }
  }
}
