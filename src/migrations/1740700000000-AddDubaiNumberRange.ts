import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDubaiNumberRange1740700000000 implements MigrationInterface {
  name = 'AddDubaiNumberRange1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const minExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'number_min'`,
    );
    if (Number(minExists?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE game_list ADD COLUMN number_min INT NULL AFTER digit_count`,
      );
    }

    const maxExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'number_max'`,
    );
    if (Number(maxExists?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE game_list ADD COLUMN number_max INT NULL AFTER number_min`,
      );
    }

    await queryRunner.query(
      `UPDATE game_list
         SET number_min = 1, number_max = 36
       WHERE game_type = 'dubai'
         AND (number_min IS NULL OR number_max IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const maxExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'number_max'`,
    );
    if (Number(maxExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(`ALTER TABLE game_list DROP COLUMN number_max`);
    }

    const minExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'number_min'`,
    );
    if (Number(minExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(`ALTER TABLE game_list DROP COLUMN number_min`);
    }
  }
}
