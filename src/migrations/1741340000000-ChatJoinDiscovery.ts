import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatJoinDiscovery1741340000000 implements MigrationInterface {
  name = 'ChatJoinDiscovery1741340000000';

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
    const groupCols: [string, string][] = [
      ['join_policy', `VARCHAR(16) NOT NULL DEFAULT 'auto'`],
      ['visibility', `VARCHAR(16) NOT NULL DEFAULT 'listed'`],
      ['description', `VARCHAR(255) NOT NULL DEFAULT ''`],
      ['member_count', `INT UNSIGNED NOT NULL DEFAULT 0`],
      ['last_message_id', `BIGINT UNSIGNED NOT NULL DEFAULT 0`],
      ['last_message_at', `DATETIME(6) NULL`],
    ];
    for (const [name, def] of groupCols) {
      if (!(await this.hasColumn(queryRunner, 'chat_group', name))) {
        await queryRunner.query(
          `ALTER TABLE \`chat_group\` ADD COLUMN \`${name}\` ${def}`,
        );
      }
    }

    if (!(await this.hasColumn(queryRunner, 'chat_group_member', 'role'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group_member\` ADD COLUMN \`role\` VARCHAR(16) NOT NULL DEFAULT 'member'`,
      );
    }

    if (!(await this.hasIndex(queryRunner, 'chat_group', 'idx_group_disc'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` ADD INDEX \`idx_group_disc\` (\`status\`, \`visibility\`, \`join_policy\`, \`sort_order\`, \`id\`)`,
      );
    }

    await queryRunner.query(
      `UPDATE \`chat_group\` SET \`join_policy\` = 'auto' WHERE \`type\` = 'public'`,
    );

    await queryRunner.query(
      `UPDATE \`chat_group\` g
       LEFT JOIN (
         SELECT \`group_id\`, MAX(\`id\`) AS max_id
         FROM \`chat_message\` WHERE \`status\` = 1
         GROUP BY \`group_id\`
       ) m ON m.group_id = g.id
       SET g.last_message_id = COALESCE(m.max_id, 0)
       WHERE g.last_message_id = 0`,
    );

    await queryRunner.query(
      `UPDATE \`chat_group\` g
       JOIN \`chat_message\` cm ON cm.id = g.last_message_id
       SET g.last_message_at = cm.created_at
       WHERE g.last_message_id > 0 AND g.last_message_at IS NULL`,
    );

    await queryRunner.query(
      `UPDATE \`chat_group\` g
       SET g.member_count = (
         SELECT COUNT(*) FROM \`chat_group_member\` gm WHERE gm.group_id = g.id
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasIndex(queryRunner, 'chat_group', 'idx_group_disc')) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group\` DROP INDEX \`idx_group_disc\``,
      );
    }
    if (await this.hasColumn(queryRunner, 'chat_group_member', 'role')) {
      await queryRunner.query(
        `ALTER TABLE \`chat_group_member\` DROP COLUMN \`role\``,
      );
    }
    for (const c of [
      'last_message_at',
      'last_message_id',
      'member_count',
      'description',
      'visibility',
      'join_policy',
    ]) {
      if (await this.hasColumn(queryRunner, 'chat_group', c)) {
        await queryRunner.query(
          `ALTER TABLE \`chat_group\` DROP COLUMN \`${c}\``,
        );
      }
    }
  }
}
