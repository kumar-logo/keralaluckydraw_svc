import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTxnTypeFilterGroup1740890000000 implements MigrationInterface {
  name = 'AddTxnTypeFilterGroup1740890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction_types' AND COLUMN_NAME = 'filter_group'`,
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`transaction_types\` ADD COLUMN \`filter_group\` VARCHAR(20) NOT NULL DEFAULT '' AFTER \`category\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction_types' AND COLUMN_NAME = 'filter_group'`,
    );
    if (cols.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`transaction_types\` DROP COLUMN \`filter_group\``,
      );
    }
  }
}
