import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_NUMBER_COLORS: Array<[number, string[]]> = [
  [0, ['red', 'violet']],
  [1, ['green']],
  [2, ['red']],
  [3, ['green']],
  [4, ['red']],
  [5, ['green', 'violet']],
  [6, ['red']],
  [7, ['green']],
  [8, ['red']],
  [9, ['green']],
];

interface IdRow {
  id: number;
}

export class CreateGameNumberColor1738400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_number_color (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        number INT NOT NULL,
        color_key VARCHAR(32) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_game_number_color_game_id (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const colorGames: IdRow[] = await queryRunner.query(
      `SELECT id FROM game_list WHERE game_type = 'color'`,
    );
    for (const game of colorGames) {
      const existing = await queryRunner.query(
        `SELECT id FROM game_number_color WHERE game_id = ? LIMIT 1`,
        [game.id],
      );
      if (existing.length > 0) continue;
      let order = 0;
      for (const [number, colors] of DEFAULT_NUMBER_COLORS) {
        for (const colorKey of colors) {
          await queryRunner.query(
            `INSERT INTO game_number_color (game_id, number, color_key, sort_order) VALUES (?, ?, ?, ?)`,
            [game.id, number, colorKey, order],
          );
          order += 1;
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_number_color`);
  }
}
