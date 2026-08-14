import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameScheduledDrawTime1739700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_list');
    if (!table?.findColumnByName('scheduled_draw_time')) {
      await queryRunner.query(
        'ALTER TABLE `game_list` ADD COLUMN `scheduled_draw_time` TIMESTAMP NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_list');
    if (table?.findColumnByName('scheduled_draw_time')) {
      await queryRunner.query(
        'ALTER TABLE `game_list` DROP COLUMN `scheduled_draw_time`',
      );
    }
  }
}
