import { MigrationInterface, QueryRunner } from 'typeorm';

/* A three_digit game's draw width (digit_count) must be >= the widest slat product
   configured on it, otherwise slat ladder tiers that reference the highest position
   (e.g. C[3], BC[2,3], ABC[1,2,3]) can never match a shorter draw and become
   unwinnable. Games like Goa King / Dear 3D shipped with digit_count=3 but carry
   4-digit slat products (the 3-digit slat is played on a 4-digit draw, index 0 = the
   series prefix), making every slat bet a guaranteed loss. Align digit_count up. */
export class FixThreeDigitSlatDigitCount1740920000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE game_list g
      JOIN (
        SELECT game_id, MAX(digit_count) AS need
        FROM game_slat_product
        GROUP BY game_id
      ) p ON p.game_id = g.id
      SET g.digit_count = GREATEST(g.digit_count, p.need)
      WHERE g.game_type = 'three_digit' AND g.digit_count < p.need
    `);
  }

  public async down(): Promise<void> {
    /* No-op: reverting would re-introduce the unwinnable-slat money-path bug. */
  }
}
