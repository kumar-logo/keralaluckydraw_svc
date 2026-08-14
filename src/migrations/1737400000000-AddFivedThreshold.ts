import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFivedThreshold1737400000000 implements MigrationInterface {
  name = 'AddFivedThreshold1737400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `game_list` ADD COLUMN `fived_big_small_threshold` int(11) NOT NULL DEFAULT 23',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `game_list` DROP COLUMN `fived_big_small_threshold`',
    );
  }
}
