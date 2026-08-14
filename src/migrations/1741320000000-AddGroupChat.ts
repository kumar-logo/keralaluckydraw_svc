import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupChat1741320000000 implements MigrationInterface {
  name = 'AddGroupChat1741320000000';

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
    if (!(await this.hasTable(queryRunner, 'chat_group'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_group\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`name\` VARCHAR(100) NOT NULL DEFAULT 'Community Chat',
          \`type\` VARCHAR(16) NOT NULL DEFAULT 'public',
          \`avatar\` VARCHAR(255) NOT NULL DEFAULT '',
          \`status\` TINYINT NOT NULL DEFAULT 1,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`created_by\` VARCHAR(32) NOT NULL DEFAULT '',
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await queryRunner.query(
        `INSERT INTO \`chat_group\` (\`name\`, \`type\`, \`status\`, \`sort_order\`)
         VALUES ('Community Chat', 'public', 1, 0)`,
      );
    }

    if (!(await this.hasTable(queryRunner, 'chat_group_member'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_group_member\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`group_id\` INT UNSIGNED NOT NULL,
          \`user_id\` VARCHAR(32) NOT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_group_member\` (\`group_id\`, \`user_id\`),
          KEY \`idx_member_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    if (!(await this.hasTable(queryRunner, 'chat_message'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_message\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`group_id\` INT UNSIGNED NOT NULL DEFAULT 1,
          \`user_id\` VARCHAR(32) NOT NULL,
          \`sender_role\` VARCHAR(16) NOT NULL DEFAULT 'user',
          \`sender_name\` VARCHAR(64) NOT NULL DEFAULT '',
          \`sender_avatar\` VARCHAR(255) NOT NULL DEFAULT '',
          \`content\` VARCHAR(1000) NOT NULL DEFAULT '',
          \`image_url\` VARCHAR(500) NULL,
          \`reply_to_id\` BIGINT UNSIGNED NULL,
          \`status\` TINYINT NOT NULL DEFAULT 1,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          KEY \`idx_chat_group\` (\`group_id\`, \`status\`, \`id\`),
          KEY \`idx_chat_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    if (!(await this.hasTable(queryRunner, 'chat_mute'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_mute\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`user_id\` VARCHAR(32) NOT NULL,
          \`muted_until\` DATETIME NULL,
          \`reason\` VARCHAR(255) NOT NULL DEFAULT '',
          \`created_by\` VARCHAR(32) NOT NULL DEFAULT '',
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_chat_mute_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const cols: [string, string][] = [
      ['group_chat_enabled', `TINYINT NOT NULL DEFAULT 0`],
      ['group_chat_block_links', `TINYINT NOT NULL DEFAULT 1`],
      ['group_chat_bad_words', `TEXT NULL`],
    ];
    for (const [name, def] of cols) {
      if (!(await this.hasColumn(queryRunner, 'app_config', name))) {
        await queryRunner.query(
          `ALTER TABLE \`app_config\` ADD COLUMN \`${name}\` ${def}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_mute\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_message\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_group_member\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_group\``);
    for (const c of [
      'group_chat_enabled',
      'group_chat_block_links',
      'group_chat_bad_words',
    ]) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` DROP COLUMN \`${c}\``,
      );
    }
  }
}
