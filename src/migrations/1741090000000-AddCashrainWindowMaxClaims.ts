import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashrainWindowMaxClaims1741090000000
  implements MigrationInterface
{
  private async hasColumn(
    queryRunner: QueryRunner,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'cashrain_window'
         AND column_name = ?`,
      [column],
    );
    return Number(rows?.[0]?.c ?? 0) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(queryRunner, 'max_claims_per_user'))) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window
           ADD COLUMN max_claims_per_user SMALLINT NOT NULL DEFAULT 1 AFTER end_minute`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'max_claims_per_user')) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window DROP COLUMN max_claims_per_user`,
      );
    }
  }
}
