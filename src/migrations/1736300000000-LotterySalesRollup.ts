import { MigrationInterface, QueryRunner } from 'typeorm';

export class LotterySalesRollup1736300000000 implements MigrationInterface {
  name = 'LotterySalesRollup1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('lottery_sales_rollup');
    if (exists) return;
    await queryRunner.query(`
      CREATE TABLE \`lottery_sales_rollup\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`game_id\` int UNSIGNED NOT NULL,
        \`draw_date\` date NOT NULL,
        \`slot\` int NOT NULL,
        \`position\` varchar(8) NOT NULL,
        \`pos_len\` int NOT NULL,
        \`number\` varchar(12) NOT NULL,
        \`price\` decimal(16,2) NOT NULL,
        \`win_price\` decimal(16,2) NOT NULL,
        \`sales_qty\` int NOT NULL DEFAULT 0,
        \`draw_qty\` int NOT NULL DEFAULT 0,
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_rollup_slice\` (\`game_id\`, \`draw_date\`, \`slot\`, \`position\`, \`number\`),
        KEY \`idx_rollup_game_date\` (\`game_id\`, \`draw_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`lottery_sales_rollup\``);
  }
}
