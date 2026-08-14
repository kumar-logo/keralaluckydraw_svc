import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrizeTierMatchRule1740100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_prize_tier');
    if (!table?.findColumnByName('tier_name')) {
      await queryRunner.query(
        'ALTER TABLE `game_prize_tier` ADD COLUMN `tier_name` VARCHAR(30) NULL',
      );
    }
    if (!table?.findColumnByName('match_rule')) {
      await queryRunner.query(
        'ALTER TABLE `game_prize_tier` ADD COLUMN `match_rule` VARCHAR(30) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_prize_tier');
    if (table?.findColumnByName('tier_name')) {
      await queryRunner.query(
        'ALTER TABLE `game_prize_tier` DROP COLUMN `tier_name`',
      );
    }
    if (table?.findColumnByName('match_rule')) {
      await queryRunner.query(
        'ALTER TABLE `game_prize_tier` DROP COLUMN `match_rule`',
      );
    }
  }
}
