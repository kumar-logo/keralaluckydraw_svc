import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameStartDate1741270000000 implements MigrationInterface {
  name = 'AddGameStartDate1741270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`game_list\`
         ADD COLUMN IF NOT EXISTS \`start_date\` timestamp NULL DEFAULT NULL AFTER \`scheduled_draw_time\``,
    );
    await queryRunner.query(
      `UPDATE \`game_list\`
         SET \`start_date\` = '2000-01-01 00:00:00'
       WHERE \`is_lottery\` = 1
         AND \`auto_generate\` = 0
         AND \`start_date\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `game_list` DROP COLUMN IF EXISTS `start_date`',
    );
  }
}
