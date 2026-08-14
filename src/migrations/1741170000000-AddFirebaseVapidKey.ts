import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirebaseVapidKey1741170000000 implements MigrationInterface {
  name = 'AddFirebaseVapidKey1741170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`firebase_config\`
         ADD COLUMN IF NOT EXISTS \`vapid_key\` varchar(255) NOT NULL DEFAULT ''
         AFTER \`measurement_id\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `firebase_config` DROP COLUMN IF EXISTS `vapid_key`',
    );
  }
}
