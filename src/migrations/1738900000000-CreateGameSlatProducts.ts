import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGameSlatProducts1738900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_slat_product (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        digit_count TINYINT NOT NULL,
        price DECIMAL(16,2) NOT NULL DEFAULT 0,
        match_mode VARCHAR(10) NOT NULL,
        title VARCHAR(50) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        status TINYINT NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        INDEX idx_game_slat_product_game_id (game_id),
        INDEX idx_slat_game_mode (game_id, match_mode),
        INDEX idx_slat_game_sort (game_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS game_slat_tier (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        product_id INT UNSIGNED NOT NULL,
        label VARCHAR(16) NOT NULL,
        member_positions VARCHAR(32) NOT NULL,
        win_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
        tier_rank INT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_game_slat_tier_product_id (product_id),
        CONSTRAINT fk_slat_tier_product FOREIGN KEY (product_id)
          REFERENCES game_slat_product (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_slat_tier`);
    await queryRunner.query(`DROP TABLE IF EXISTS game_slat_product`);
  }
}
