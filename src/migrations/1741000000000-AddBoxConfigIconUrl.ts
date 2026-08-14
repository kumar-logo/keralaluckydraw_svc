import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBoxConfigIconUrl1741000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'game_box_config'
         AND column_name = 'icon_url'`,
    );
    if (Number(existing?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE game_box_config
           ADD COLUMN icon_url VARCHAR(500) NULL
           AFTER cover_img_id`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE game_box_config DROP COLUMN icon_url`);
  }
}
