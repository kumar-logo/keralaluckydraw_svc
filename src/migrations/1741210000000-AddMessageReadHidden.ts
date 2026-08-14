import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReadHidden1741210000000 implements MigrationInterface {
  name = 'AddMessageReadHidden1741210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`message_read\`
         ADD COLUMN IF NOT EXISTS \`hidden\` tinyint NOT NULL DEFAULT 0 AFTER \`user_id\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `message_read` DROP COLUMN IF EXISTS `hidden`',
    );
  }
}
