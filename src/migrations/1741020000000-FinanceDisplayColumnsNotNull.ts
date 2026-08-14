import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceDisplayColumnsNotNull1741020000000 implements MigrationInterface {
  private async hasColumn(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows: Array<{ c: number }> = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    if (rows.length === 0) {
      return false;
    }
    return Number(rows[0].c) > 0;
  }

  public async up(q: QueryRunner): Promise<void> {
    if (await this.hasColumn(q, 'vip_levels', 'icon_url')) {
      await q.query(
        `UPDATE vip_levels SET icon_url = '' WHERE icon_url IS NULL`,
      );
      await q.query(
        `ALTER TABLE vip_levels MODIFY COLUMN icon_url VARCHAR(500) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'vip_levels', 'level_color')) {
      await q.query(
        `UPDATE vip_levels SET level_color = '' WHERE level_color IS NULL`,
      );
      await q.query(
        `ALTER TABLE vip_levels MODIFY COLUMN level_color VARCHAR(20) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'payment_gateways', 'icon_url')) {
      await q.query(
        `UPDATE payment_gateways SET icon_url = '' WHERE icon_url IS NULL`,
      );
      await q.query(
        `ALTER TABLE payment_gateways MODIFY COLUMN icon_url VARCHAR(500) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'payment_gateways', 'qr_image_url')) {
      await q.query(
        `UPDATE payment_gateways SET qr_image_url = '' WHERE qr_image_url IS NULL`,
      );
      await q.query(
        `ALTER TABLE payment_gateways MODIFY COLUMN qr_image_url VARCHAR(500) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'recharge_records', 'remark')) {
      await q.query(
        `UPDATE recharge_records SET remark = '' WHERE remark IS NULL`,
      );
      await q.query(
        `ALTER TABLE recharge_records MODIFY COLUMN remark VARCHAR(255) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'withdrawal_records', 'remark')) {
      await q.query(
        `UPDATE withdrawal_records SET remark = '' WHERE remark IS NULL`,
      );
      await q.query(
        `ALTER TABLE withdrawal_records MODIFY COLUMN remark VARCHAR(500) NOT NULL DEFAULT ''`,
      );
    }
    if (await this.hasColumn(q, 'transfer_records', 'order_no')) {
      await q.query(
        `UPDATE transfer_records SET order_no = '' WHERE order_no IS NULL`,
      );
      await q.query(
        `ALTER TABLE transfer_records MODIFY COLUMN order_no VARCHAR(64) NOT NULL DEFAULT ''`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    if (await this.hasColumn(q, 'transfer_records', 'order_no')) {
      await q.query(
        `ALTER TABLE transfer_records MODIFY COLUMN order_no VARCHAR(64) NULL`,
      );
    }
    if (await this.hasColumn(q, 'withdrawal_records', 'remark')) {
      await q.query(
        `ALTER TABLE withdrawal_records MODIFY COLUMN remark VARCHAR(500) NULL`,
      );
    }
    if (await this.hasColumn(q, 'recharge_records', 'remark')) {
      await q.query(
        `ALTER TABLE recharge_records MODIFY COLUMN remark VARCHAR(255) NULL`,
      );
    }
    if (await this.hasColumn(q, 'payment_gateways', 'qr_image_url')) {
      await q.query(
        `ALTER TABLE payment_gateways MODIFY COLUMN qr_image_url VARCHAR(500) NULL`,
      );
    }
    if (await this.hasColumn(q, 'payment_gateways', 'icon_url')) {
      await q.query(
        `ALTER TABLE payment_gateways MODIFY COLUMN icon_url VARCHAR(500) NULL`,
      );
    }
    if (await this.hasColumn(q, 'vip_levels', 'level_color')) {
      await q.query(
        `ALTER TABLE vip_levels MODIFY COLUMN level_color VARCHAR(20) NULL`,
      );
    }
    if (await this.hasColumn(q, 'vip_levels', 'icon_url')) {
      await q.query(
        `ALTER TABLE vip_levels MODIFY COLUMN icon_url VARCHAR(500) NULL`,
      );
    }
  }
}
