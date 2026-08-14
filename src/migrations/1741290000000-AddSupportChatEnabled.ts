import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupportChatEnabled1741290000000 implements MigrationInterface {
  name = 'AddSupportChatEnabled1741290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`app_config\`
         ADD COLUMN IF NOT EXISTS \`support_chat_enabled\` tinyint NOT NULL DEFAULT 1 AFTER \`instagram_link\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN IF EXISTS `support_chat_enabled`',
    );
  }
}
