import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnpadSlatOrderNumbers1740990000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: number; bet_content: unknown }> =
      await queryRunner.query(
        `SELECT id, bet_content FROM orders
         WHERE JSON_EXTRACT(bet_content, '$.slatProductId') IS NOT NULL`,
      );
    for (const row of rows) {
      const content =
        typeof row.bet_content === 'string'
          ? JSON.parse(row.bet_content)
          : (row.bet_content as Record<string, unknown>);
      const positions = content.positions as number[] | undefined;
      const numbers = String(content.numbers ?? '');
      if (
        !Array.isArray(positions) ||
        positions.length === 0 ||
        numbers.length === positions.length
      ) {
        continue;
      }
      const stripped = positions
        .map((p) => (p >= 0 && p < numbers.length ? numbers[p] : ''))
        .join('');
      if (stripped.length !== positions.length) continue;
      content.numbers = stripped;
      await queryRunner.query(
        'UPDATE orders SET bet_content = ? WHERE id = ?',
        [JSON.stringify(content), row.id],
      );
    }
  }

  public async down(): Promise<void> {
    // One-way: the padded form is reconstructable from positions + the game's
    // digit_count at settlement time; re-padding stored orders is unnecessary.
  }
}
