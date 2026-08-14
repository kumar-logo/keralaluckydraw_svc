import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargeApprovedAt1741310000000 implements MigrationInterface {
  name = 'AddRechargeApprovedAt1741310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records'
         AND COLUMN_NAME = 'approved_at'`,
    );
    if (Number(col[0].c) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`recharge_records\`
         ADD COLUMN \`approved_at\` DATETIME(6) NULL AFTER \`bonus_amount\``,
      );
      // Backfill already-approved rows so a recharge approved earlier TODAY
      // still counts before the app starts stamping approved_at. updated_at
      // carries ON UPDATE current_timestamp(6), so for a settled recharge it
      // reflects the status->1 flip (its approval time).
      await queryRunner.query(
        `UPDATE \`recharge_records\`
         SET \`approved_at\` = \`updated_at\`
         WHERE \`status\` = 1 AND \`approved_at\` IS NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`recharge_records\` DROP COLUMN \`approved_at\``,
    );
  }
}
