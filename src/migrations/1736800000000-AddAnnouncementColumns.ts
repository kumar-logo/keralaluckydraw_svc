import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncementColumns1736800000000 implements MigrationInterface {
  name = 'AddAnnouncementColumns1736800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SHOW COLUMNS FROM \`announcements\``,
    );
    const has = (field: string): boolean =>
      columns.some((column: { Field: string }) => column.Field === field);

    if (!has('title')) {
      await queryRunner.query(
        'ALTER TABLE `announcements` ADD COLUMN `title` varchar(200) DEFAULT NULL AFTER `id`',
      );
    }
    if (!has('announcement_type')) {
      await queryRunner.query(
        "ALTER TABLE `announcements` ADD COLUMN `announcement_type` varchar(30) NOT NULL DEFAULT 'notice' AFTER `content`",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `announcements` DROP COLUMN `announcement_type`',
    );
    await queryRunner.query('ALTER TABLE `announcements` DROP COLUMN `title`');
  }
}
