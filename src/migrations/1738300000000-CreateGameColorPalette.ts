import { MigrationInterface, QueryRunner } from 'typeorm';

const COLOR_PALETTE: Array<[string, string]> = [
  ['red', '#be0000'],
  ['green', '#109216'],
  ['violet', '#670fbf'],
];

interface IdRow {
  id: number;
}

export class CreateGameColorPalette1738300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_color_palette (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        color_key VARCHAR(32) NOT NULL,
        hex VARCHAR(32) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_game_color_palette_game_id (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const colorGames: IdRow[] = await queryRunner.query(
      `SELECT id FROM game_list WHERE game_type = 'color'`,
    );
    for (const game of colorGames) {
      const existing = await queryRunner.query(
        `SELECT id FROM game_color_palette WHERE game_id = ? LIMIT 1`,
        [game.id],
      );
      if (existing.length > 0) continue;
      for (let i = 0; i < COLOR_PALETTE.length; i++) {
        await queryRunner.query(
          `INSERT INTO game_color_palette (game_id, color_key, hex, sort_order) VALUES (?, ?, ?, ?)`,
          [game.id, COLOR_PALETTE[i][0], COLOR_PALETTE[i][1], i],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_color_palette`);
  }
}
