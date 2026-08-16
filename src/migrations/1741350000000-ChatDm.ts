import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatDm1741350000000 implements MigrationInterface {
  name = 'ChatDm1741350000000';

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

  private async hasIndex(
    q: QueryRunner,
    table: string,
    index: string,
  ): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, index],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: [string, string][] = [
      ['is_dm', `TINYINT NOT NULL DEFAULT 0`],
      ['dm_key', `VARCHAR(80) NULL`],
      ['dm_admin_id', `VARCHAR(32) NULL`],
      ['dm_user_id', `VARCHAR(32) NULL`],
    ];
    for (const [name, def] of cols) {
      if (!(await this.hasColumn(queryRunner, 'chat_group', name))) {
        await queryRunner.query(
          `ALTER TABLE \`chat_group\` ADD COLUMN \`${name}\` ${def}`,
        );
      }
    }

    if (!(await this.hasIndex(queryRunner, 'chat_group', 'uk_chat_group_dm'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` ADD UNIQUE INDEX \`uk_chat_group_dm\` (\`dm_key\`)`,
      );
    }

    if (!(await this.hasIndex(queryRunner, 'chat_group', 'idx_dm_admin'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` ADD INDEX \`idx_dm_admin\` (\`dm_admin_id\`, \`last_message_id\`)`,
      );
    }

    if (!(await this.hasIndex(queryRunner, 'chat_group', 'idx_dm_user'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` ADD INDEX \`idx_dm_user\` (\`dm_user_id\`, \`last_message_id\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const idx of ['idx_dm_user', 'idx_dm_admin', 'uk_chat_group_dm']) {
      if (await this.hasIndex(queryRunner, 'chat_group', idx)) {
        await queryRunner.query(
          `ALTER TABLE \`chat_group\` DROP INDEX \`${idx}\``,
        );
      }
    }
    for (const c of ['dm_user_id', 'dm_admin_id', 'dm_key', 'is_dm']) {
      if (await this.hasColumn(queryRunner, 'chat_group', c)) {
        await queryRunner.query(
          `ALTER TABLE \`chat_group\` DROP COLUMN \`${c}\``,
        );
      }
    }
  }
}
