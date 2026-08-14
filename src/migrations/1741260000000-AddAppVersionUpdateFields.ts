import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppVersionUpdateFields1741260000000
  implements MigrationInterface
{
  name = 'AddAppVersionUpdateFields1741260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`app_versions\`
         ADD COLUMN IF NOT EXISTS \`force_update\` tinyint NOT NULL DEFAULT 0 AFTER \`version\`,
         ADD COLUMN IF NOT EXISTS \`min_supported_version\` varchar(200) NOT NULL DEFAULT '' AFTER \`force_update\`,
         ADD COLUMN IF NOT EXISTS \`store_url\` varchar(500) NOT NULL DEFAULT '' AFTER \`min_supported_version\`,
         ADD COLUMN IF NOT EXISTS \`android_package_name\` varchar(200) NOT NULL DEFAULT '' AFTER \`store_url\`,
         ADD COLUMN IF NOT EXISTS \`update_message\` varchar(500) NOT NULL DEFAULT '' AFTER \`android_package_name\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`app_versions\`
         DROP COLUMN IF EXISTS \`force_update\`,
         DROP COLUMN IF EXISTS \`min_supported_version\`,
         DROP COLUMN IF EXISTS \`store_url\`,
         DROP COLUMN IF EXISTS \`android_package_name\`,
         DROP COLUMN IF EXISTS \`update_message\``,
    );
  }
}
