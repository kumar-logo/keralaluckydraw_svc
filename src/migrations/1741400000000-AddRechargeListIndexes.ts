import { MigrationInterface, QueryRunner } from 'typeorm';

interface RechargeListIndex {
  name: string;
  columns: string;
}

interface IndexNameRow {
  INDEX_NAME: string;
}

const RECHARGE_LIST_INDEXES: RechargeListIndex[] = [
  { name: 'IDX_recharge_records_created_at', columns: '`created_at`' },
  {
    name: 'IDX_recharge_records_status_created_at',
    columns: '`status`, `created_at`',
  },
  {
    name: 'IDX_recharge_records_user_created_at',
    columns: '`user_id`, `created_at`',
  },
];

export class AddRechargeListIndexes1741400000000 implements MigrationInterface {
  name = 'AddRechargeListIndexes1741400000000';

  private async indexExists(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<boolean> {
    const existing: IndexNameRow[] = await queryRunner.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recharge_records' AND INDEX_NAME = ?`,
      [name],
    );
    return existing.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const index of RECHARGE_LIST_INDEXES) {
      if (!(await this.indexExists(queryRunner, index.name))) {
        await queryRunner.query(
          `ALTER TABLE \`recharge_records\` ADD INDEX \`${index.name}\` (${index.columns})`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of RECHARGE_LIST_INDEXES) {
      if (await this.indexExists(queryRunner, index.name)) {
        await queryRunner.query(
          `ALTER TABLE \`recharge_records\` DROP INDEX \`${index.name}\``,
        );
      }
    }
  }
}
