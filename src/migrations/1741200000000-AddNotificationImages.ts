import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationImages1741200000000 implements MigrationInterface {
  name = 'AddNotificationImages1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`messages\`
         ADD COLUMN IF NOT EXISTS \`image_url\` varchar(500) NULL AFTER \`content\``,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`message_images\` (
         \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
         \`message_id\` bigint unsigned NOT NULL,
         \`image_url\` varchar(500) NOT NULL,
         \`sort_order\` int NOT NULL DEFAULT 0,
         PRIMARY KEY (\`id\`),
         INDEX \`idx_message_images_message\` (\`message_id\`)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `message_images`');
    await queryRunner.query(
      'ALTER TABLE `messages` DROP COLUMN IF EXISTS `image_url`',
    );
  }
}
