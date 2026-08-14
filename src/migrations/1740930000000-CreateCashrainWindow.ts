import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCashrainWindow1740930000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cashrain_window (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        start_minute SMALLINT NOT NULL,
        end_minute SMALLINT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        status TINYINT NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        INDEX IDX_cashrain_window_game_id (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cashrain_window`);
  }
}
