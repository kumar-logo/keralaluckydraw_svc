import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBanReason1741180000000 implements MigrationInterface {
  name = 'AddUserBanReason1741180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\`
         ADD COLUMN IF NOT EXISTS \`ban_reason\` varchar(255) NULL AFTER \`status\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN IF EXISTS `ban_reason`',
    );
  }
}
