import { MigrationInterface, QueryRunner } from 'typeorm';

const APP_CONFIG_COLUMNS: Array<[string, string]> = [
  ['login_bg_light_url', "varchar(255) NOT NULL DEFAULT ''"],
  ['login_bg_dark_url', "varchar(255) NOT NULL DEFAULT ''"],
];

export class AddAppConfigLoginBg1739100000000 implements MigrationInterface {
  name = 'AddAppConfigLoginBg1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, def] of APP_CONFIG_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ${name} ${def}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of APP_CONFIG_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE app_config DROP COLUMN IF EXISTS ${name}`,
      );
    }
  }
}
