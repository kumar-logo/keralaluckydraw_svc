import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentGatewayUpiId1741390000000 implements MigrationInterface {
  name = 'AddPaymentGatewayUpiId1741390000000';

  private async hasColumn(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(queryRunner, 'payment_gateways', 'upi_id'))) {
      await queryRunner.query(
        `ALTER TABLE \`payment_gateways\` ADD COLUMN \`upi_id\` VARCHAR(100) NOT NULL DEFAULT '' AFTER \`qr_image_url\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'payment_gateways', 'upi_id')) {
      await queryRunner.query(
        `ALTER TABLE \`payment_gateways\` DROP COLUMN \`upi_id\``,
      );
    }
  }
}
