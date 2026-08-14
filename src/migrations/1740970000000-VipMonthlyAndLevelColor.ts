import { MigrationInterface, QueryRunner } from 'typeorm';

export class VipMonthlyAndLevelColor1740970000000 implements MigrationInterface {
  private async hasColumn(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(rows?.[0]?.c ?? 0) > 0;
  }

  private async hasIndex(
    q: QueryRunner,
    table: string,
    index: string,
  ): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, index],
    );
    return Number(rows?.[0]?.c ?? 0) > 0;
  }

  public async up(q: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(q, 'vip_awards', 'award_type'))) {
      await q.query(
        `ALTER TABLE vip_awards
           ADD COLUMN award_type VARCHAR(10) NOT NULL DEFAULT 'daily' AFTER award_date`,
      );
    }
    if (await this.hasIndex(q, 'vip_awards', 'uk_user_level_date')) {
      await q.query(`ALTER TABLE vip_awards DROP INDEX uk_user_level_date`);
    }
    if (!(await this.hasIndex(q, 'vip_awards', 'uk_user_level_date_type'))) {
      await q.query(
        `ALTER TABLE vip_awards
           ADD UNIQUE INDEX uk_user_level_date_type (user_id, vip_level, award_date, award_type)`,
      );
    }
    if (!(await this.hasColumn(q, 'vip_levels', 'level_color'))) {
      await q.query(
        `ALTER TABLE vip_levels
           ADD COLUMN level_color VARCHAR(20) NULL AFTER icon_url`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    if (await this.hasColumn(q, 'vip_levels', 'level_color')) {
      await q.query(`ALTER TABLE vip_levels DROP COLUMN level_color`);
    }
    if (await this.hasIndex(q, 'vip_awards', 'uk_user_level_date_type')) {
      await q.query(
        `ALTER TABLE vip_awards DROP INDEX uk_user_level_date_type`,
      );
    }
    if (await this.hasColumn(q, 'vip_awards', 'award_type')) {
      await q.query(`ALTER TABLE vip_awards DROP COLUMN award_type`);
    }
  }
}
