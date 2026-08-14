import { MigrationInterface, QueryRunner } from 'typeorm';
import { rulesForType } from '../seeds/game-list.seed';

interface GameRow {
  id: number;
  game_type: string;
}

interface CountRow {
  game_id: number;
}

export class BackfillGameRules1738100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const games: GameRow[] = await queryRunner.query(
      'SELECT id, game_type FROM game_list',
    );
    const withRules: CountRow[] = await queryRunner.query(
      'SELECT DISTINCT game_id FROM game_rule_section',
    );
    const seeded = new Set(withRules.map((r) => Number(r.game_id)));

    for (const game of games) {
      if (seeded.has(Number(game.id))) continue;
      const sections = rulesForType(game.game_type);
      if (!sections || sections.length === 0) continue;
      for (let i = 0; i < sections.length; i++) {
        await queryRunner.query(
          'INSERT INTO game_rule_section (game_id, title, content, sort_order) VALUES (?, ?, ?, ?)',
          [game.id, sections[i].title, sections[i].content, i],
        );
      }
    }
  }

  public async down(): Promise<void> {
    return;
  }
}
