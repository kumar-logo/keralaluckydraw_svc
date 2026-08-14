import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeManualLotteryType1739800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `game_list` SET `lottery_type` = 'manual' WHERE `is_lottery` = 1 AND `auto_generate` = 0 AND `lottery_type` <> 'manual'",
    );
    await queryRunner.query(
      "UPDATE `game_list` SET `lottery_type` = 'auto' WHERE `is_lottery` = 1 AND `auto_generate` = 1 AND `lottery_type` <> 'auto'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `game_list` SET `lottery_type` = 'auto' WHERE `is_lottery` = 1 AND `auto_generate` = 0",
    );
  }
}
