import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGamePositionColor1740400000000 implements MigrationInterface {
  name = 'AddGamePositionColor1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_position_color (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        position INT NOT NULL,
        color VARCHAR(20) NOT NULL,
        gradient VARCHAR(60) DEFAULT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_game_position_color_game_id (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_position_color`);
  }
}
