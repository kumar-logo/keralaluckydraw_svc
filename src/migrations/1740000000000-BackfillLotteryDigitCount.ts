import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillLotteryDigitCount1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE game_list gl
       JOIN game_kerala_config kc ON kc.game_id = gl.id
       SET gl.digit_count = kc.ticket_length
       WHERE gl.game_type = 'kerala'
         AND (gl.digit_count IS NULL OR gl.digit_count = 0)
         AND kc.ticket_length > 0`,
    );
    await queryRunner.query(
      `UPDATE game_list SET digit_count = 1
       WHERE game_type = 'dubai'
         AND (digit_count IS NULL OR digit_count = 0)`,
    );
  }

  public async down(): Promise<void> {
    // digit_count backfill is non-destructive; nothing to revert.
  }
}
