import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatPostPolicy1741380000000 implements MigrationInterface {
  name = 'AddChatPostPolicy1741380000000';

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
    if (!(await this.hasColumn(queryRunner, 'chat_group', 'post_policy'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` ADD COLUMN \`post_policy\` VARCHAR(16) NOT NULL DEFAULT 'all' AFTER \`join_policy\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'chat_group', 'post_policy')) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` DROP COLUMN \`post_policy\``,
      );
    }
  }
}
