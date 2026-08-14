import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThirdPartyHomeUrl1740860000000 implements MigrationInterface {
  name = 'AddThirdPartyHomeUrl1740860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'third_party_config' AND COLUMN_NAME = 'home_url'`,
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`third_party_config\` ADD COLUMN \`home_url\` VARCHAR(255) NOT NULL DEFAULT '' AFTER \`launch_url\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols: { COLUMN_NAME: string }[] = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'third_party_config' AND COLUMN_NAME = 'home_url'`,
    );
    if (cols.length > 0) {
      await queryRunner.query(
        `ALTER TABLE \`third_party_config\` DROP COLUMN \`home_url\``,
      );
    }
  }
}
