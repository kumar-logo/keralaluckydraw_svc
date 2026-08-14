import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGamePayoutLedger1740800000000 implements MigrationInterface {
  name = 'CreateGamePayoutLedger1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_payout_ledger\` (
        \`game_id\` int(10) unsigned NOT NULL,
        \`cumulative_stake\` decimal(18,2) NOT NULL DEFAULT 0.00,
        \`cumulative_payout\` decimal(18,2) NOT NULL DEFAULT 0.00,
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `game_payout_ledger`');
  }
}
