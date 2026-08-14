import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDigitPositionColors1740600000000 implements MigrationInterface {
  name = 'SeedDigitPositionColors1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO game_position_color (game_id, position, color, gradient, sort_order)
      SELECT g.id, p.position, p.color, NULL, p.position
      FROM game_list g
      JOIN (
        SELECT 0 AS position, '#BE0000' AS color UNION ALL
        SELECT 1, '#FF8A00' UNION ALL
        SELECT 2, '#007CEF' UNION ALL
        SELECT 3, '#00B209' UNION ALL
        SELECT 4, '#00C7CE'
      ) p ON p.position < g.digit_count
      WHERE g.game_type IN ('three_digit', 'four_five_digit')
        AND g.digit_count > 0
        AND NOT EXISTS (
          SELECT 1 FROM game_position_color gpc WHERE gpc.game_id = g.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE gpc FROM game_position_color gpc
      JOIN game_list g ON g.id = gpc.game_id
      WHERE g.game_type IN ('three_digit', 'four_five_digit')
    `);
  }
}
