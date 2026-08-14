import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_RUNNERS: Array<[string, string, string, string]> = [
  ['Kerala', 'KL', '#00B92B', 'kerala'],
  ['Tamil Nadu', 'TN', '#D80000', 'tamil'],
  ['Madhya Pradesh', 'MP', '#F5D000', 'mp'],
  ['Maharashtra', 'MH', '#DB7500', 'mh'],
  ['Karnataka', 'KA', '#B800D0', 'ka'],
  ['Nagaland', 'NL', '#0012D4', 'nl'],
];

interface IdRow {
  id: number;
}

export class CreateGameRaceRunner1738500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_race_runner (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        name VARCHAR(64) NOT NULL,
        name_short VARCHAR(16) NOT NULL,
        color_hex VARCHAR(32) NOT NULL,
        sprite_key VARCHAR(48) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_game_race_runner_game_id (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const raceGames: IdRow[] = await queryRunner.query(
      `SELECT id FROM game_list WHERE game_type = 'race'`,
    );
    for (const game of raceGames) {
      const existing = await queryRunner.query(
        `SELECT id FROM game_race_runner WHERE game_id = ? LIMIT 1`,
        [game.id],
      );
      if (existing.length > 0) continue;
      for (let i = 0; i < DEFAULT_RUNNERS.length; i++) {
        const [name, nameShort, colorHex, spriteKey] = DEFAULT_RUNNERS[i];
        await queryRunner.query(
          `INSERT INTO game_race_runner (game_id, name, name_short, color_hex, sprite_key, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [game.id, name, nameShort, colorHex, spriteKey, i],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_race_runner`);
  }
}
