import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargeBonusPct1741300000000 implements MigrationInterface {
  name = 'AddRechargeBonusPct1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const presetCol = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_preset'
         AND COLUMN_NAME = 'bonus_pct'`,
    );
    if (Number(presetCol[0].c) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`recharge_preset\`
         ADD COLUMN \`bonus_pct\` DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER \`mark\``,
      );
    }

    const recordCol = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records'
         AND COLUMN_NAME = 'bonus_amount'`,
    );
    if (Number(recordCol[0].c) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`recharge_records\`
         ADD COLUMN \`bonus_amount\` DECIMAL(16,2) NOT NULL DEFAULT 0 AFTER \`actual_amount\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`recharge_preset\` DROP COLUMN \`bonus_pct\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`recharge_records\` DROP COLUMN \`bonus_amount\``,
    );
  }
}
