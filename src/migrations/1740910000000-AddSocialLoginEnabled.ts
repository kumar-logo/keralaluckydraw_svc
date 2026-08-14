import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialLoginEnabled1740910000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(
      `SHOW COLUMNS FROM \`app_config\` LIKE 'social_login_enabled'`,
    );
    if (col.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` ADD COLUMN \`social_login_enabled\` TINYINT NOT NULL DEFAULT 0 AFTER \`telegram_bot_token\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const col = await queryRunner.query(
      `SHOW COLUMNS FROM \`app_config\` LIKE 'social_login_enabled'`,
    );
    if (col.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` DROP COLUMN \`social_login_enabled\``,
      );
    }
  }
}
