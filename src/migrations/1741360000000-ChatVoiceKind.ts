import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatVoiceKind1741360000000 implements MigrationInterface {
  name = 'ChatVoiceKind1741360000000';

  private async hasColumn(
    q: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await q.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(queryRunner, 'chat_message', 'kind'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_message\` ADD COLUMN \`kind\` VARCHAR(16) NOT NULL DEFAULT 'text' AFTER \`sender_avatar\``,
      );
    }
    if (!(await this.hasColumn(queryRunner, 'chat_message', 'audio_url'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_message\` ADD COLUMN \`audio_url\` VARCHAR(500) NULL AFTER \`image_url\``,
      );
    }
    if (!(await this.hasColumn(queryRunner, 'chat_message', 'duration_ms'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_message\` ADD COLUMN \`duration_ms\` INT UNSIGNED NULL AFTER \`audio_url\``,
      );
    }
    if (!(await this.hasColumn(queryRunner, 'chat_message', 'audio_waveform'))) {
      await queryRunner.query(
        `ALTER TABLE \`chat_message\` ADD COLUMN \`audio_waveform\` VARCHAR(255) NULL AFTER \`duration_ms\``,
      );
    }

    await queryRunner.query(
      `UPDATE \`chat_message\` SET \`kind\` = 'image' WHERE \`image_url\` IS NOT NULL AND \`kind\` = 'text'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of ['audio_waveform', 'duration_ms', 'audio_url', 'kind']) {
      if (await this.hasColumn(queryRunner, 'chat_message', c)) {
        await queryRunner.query(
          `ALTER TABLE \`chat_message\` DROP COLUMN \`${c}\``,
        );
      }
    }
  }
}
