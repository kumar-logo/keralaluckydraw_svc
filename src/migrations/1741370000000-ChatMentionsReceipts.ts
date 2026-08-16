import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatMentionsReceipts1741370000000 implements MigrationInterface {
  name = 'ChatMentionsReceipts1741370000000';

  private async hasTable(q: QueryRunner, table: string): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return Number(rows[0].c) > 0;
  }

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'chat_mention'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_mention\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`group_id\` INT UNSIGNED NOT NULL,
          \`user_id\` VARCHAR(32) NOT NULL,
          \`message_id\` BIGINT UNSIGNED NOT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_mention_msg_user\` (\`message_id\`, \`user_id\`),
          KEY \`idx_mention_unread\` (\`user_id\`, \`group_id\`, \`message_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const readCols: [string, string][] = [
      ['last_delivered_id', `BIGINT UNSIGNED NOT NULL DEFAULT 0`],
      ['last_read_mention_id', `BIGINT UNSIGNED NOT NULL DEFAULT 0`],
      ['unread_mentions', `INT UNSIGNED NOT NULL DEFAULT 0`],
    ];
    for (const [name, def] of readCols) {
      if (!(await this.hasColumn(queryRunner, 'chat_read', name))) {
        await queryRunner.query(
          `ALTER TABLE \`chat_read\` ADD COLUMN \`${name}\` ${def}`,
        );
      }
    }

    const appCols: [string, string][] = [
      ['group_chat_voice_enabled', `TINYINT NOT NULL DEFAULT 1`],
      ['group_chat_dm_enabled', `TINYINT NOT NULL DEFAULT 1`],
    ];
    for (const [name, def] of appCols) {
      if (!(await this.hasColumn(queryRunner, 'app_config', name))) {
        await queryRunner.query(
          `ALTER TABLE \`app_config\` ADD COLUMN \`${name}\` ${def}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of ['group_chat_dm_enabled', 'group_chat_voice_enabled']) {
      if (await this.hasColumn(queryRunner, 'app_config', c)) {
        await queryRunner.query(
          `ALTER TABLE \`app_config\` DROP COLUMN \`${c}\``,
        );
      }
    }
    for (const c of [
      'unread_mentions',
      'last_read_mention_id',
      'last_delivered_id',
    ]) {
      if (await this.hasColumn(queryRunner, 'chat_read', c)) {
        await queryRunner.query(
          `ALTER TABLE \`chat_read\` DROP COLUMN \`${c}\``,
        );
      }
    }
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_mention\``);
  }
}
