import { MigrationInterface, QueryRunner } from 'typeorm';

const DICE_PALETTE: Array<[string, string]> = [
  ['small', '#0090e2'],
  ['green', '#02921b'],
  ['big', '#e20000'],
  ['odd', '#b91010'],
  ['even', '#176be3'],
];

interface IdRow {
  id: number;
}

export class BackfillDiceColorPalette1738700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const diceGames: IdRow[] = await queryRunner.query(
      `SELECT id FROM game_list WHERE game_type = 'dice'`,
    );
    for (const game of diceGames) {
      const existing = await queryRunner.query(
        `SELECT id FROM game_color_palette WHERE game_id = ? LIMIT 1`,
        [game.id],
      );
      if (existing.length > 0) continue;
      for (let i = 0; i < DICE_PALETTE.length; i++) {
        await queryRunner.query(
          `INSERT INTO game_color_palette (game_id, color_key, hex, sort_order) VALUES (?, ?, ?, ?)`,
          [game.id, DICE_PALETTE[i][0], DICE_PALETTE[i][1], i],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE p FROM game_color_palette p JOIN game_list g ON g.id = p.game_id WHERE g.game_type = 'dice'`,
    );
  }
}
