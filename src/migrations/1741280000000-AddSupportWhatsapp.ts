import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupportWhatsapp1741280000000 implements MigrationInterface {
  name = 'AddSupportWhatsapp1741280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`app_config\`
         ADD COLUMN IF NOT EXISTS \`support_whatsapp_enabled\` tinyint NOT NULL DEFAULT 0 AFTER \`support_telegram_url\`,
         ADD COLUMN IF NOT EXISTS \`support_whatsapp_url\` varchar(500) NOT NULL DEFAULT '' AFTER \`support_whatsapp_enabled\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN IF EXISTS `support_whatsapp_url`',
    );
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN IF EXISTS `support_whatsapp_enabled`',
    );
  }
}
