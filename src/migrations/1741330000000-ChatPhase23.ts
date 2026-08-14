import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatPhase231741330000000 implements MigrationInterface {
  name = 'ChatPhase231741330000000';

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
    if (!(await this.hasColumn(queryRunner, 'chat_message', 'mentions'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_message\` ADD COLUMN \`mentions\` VARCHAR(500) NULL AFTER \`reply_to_id\``,
      );
    }

    if (!(await this.hasColumn(queryRunner, 'app_config', 'group_chat_image_enabled'))) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` ADD COLUMN \`group_chat_image_enabled\` TINYINT NOT NULL DEFAULT 1`,
      );
    }

    if (!(await this.hasTable(queryRunner, 'chat_read'))) {
      await queryRunner.query(`
        CREATE TABLE \`chat_read\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`group_id\` INT UNSIGNED NOT NULL,
          \`user_id\` VARCHAR(32) NOT NULL,
          \`last_read_id\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_chat_read\` (\`group_id\`, \`user_id\`),
          KEY \`idx_chat_read_user\` (\`user_id\`, \`group_id\`, \`last_read_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } else if (!(await this.hasIndex(queryRunner, 'chat_read', 'idx_chat_read_user'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_read\` ADD INDEX \`idx_chat_read_user\` (\`user_id\`, \`group_id\`, \`last_read_id\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`chat_read\``);
    if (await this.hasColumn(queryRunner, 'app_config', 'group_chat_image_enabled')) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` DROP COLUMN \`group_chat_image_enabled\``,
      );
    }
    if (await this.hasColumn(queryRunner, 'chat_message', 'mentions')) {
      await queryRunner.query(`ALTER TABLE \`chat_message\` DROP COLUMN \`mentions\``);
    }
  }
}
