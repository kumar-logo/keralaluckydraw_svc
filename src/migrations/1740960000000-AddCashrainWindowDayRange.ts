import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashrainWindowDayRange1740960000000 implements MigrationInterface {
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
    if (!(await this.hasColumn(queryRunner, 'day_start'))) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window
           ADD COLUMN day_start SMALLINT NOT NULL DEFAULT 1 AFTER game_id`,
      );
    }
    if (!(await this.hasColumn(queryRunner, 'day_end'))) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window
           ADD COLUMN day_end SMALLINT NOT NULL DEFAULT 31 AFTER day_start`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'day_end')) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window DROP COLUMN day_end`,
      );
    }
    if (await this.hasColumn(queryRunner, 'day_start')) {
      await queryRunner.query(
        `ALTER TABLE cashrain_window DROP COLUMN day_start`,
      );
    }
  }
}
