import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralPrefix1741250000000 implements MigrationInterface {
  name = 'AddReferralPrefix1741250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`app_config\`
         ADD COLUMN IF NOT EXISTS \`referral_prefix\` varchar(16) NOT NULL DEFAULT 'ARA' AFTER \`currency\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `app_config` DROP COLUMN IF EXISTS `referral_prefix`',
    );
  }
}
