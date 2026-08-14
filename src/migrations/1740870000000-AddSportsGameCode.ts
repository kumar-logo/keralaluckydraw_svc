import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSportsGameCode1740870000000 implements MigrationInterface {
  name = 'AddSportsGameCode1740870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config' AND COLUMN_NAME = 'sports_game_code'`,
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` ADD COLUMN \`sports_game_code\` VARCHAR(50) NOT NULL DEFAULT '' AFTER \`support_telegram_url\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config' AND COLUMN_NAME = 'sports_game_code'`,
    );
    if (cols.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`app_config\` DROP COLUMN \`sports_game_code\``,
      );
    }
  }
}
