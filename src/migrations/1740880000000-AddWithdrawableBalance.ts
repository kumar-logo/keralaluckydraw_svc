import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWithdrawableBalance1740880000000 implements MigrationInterface {
  name = 'AddWithdrawableBalance1740880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'withdrawable_balance'`,
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD COLUMN \`withdrawable_balance\` DECIMAL(16,2) NOT NULL DEFAULT 0 AFTER \`balance\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'withdrawable_balance'`,
    );
    if (cols.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` DROP COLUMN \`withdrawable_balance\``,
      );
    }
  }
}
