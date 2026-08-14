import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinanceConfig1736900000000 implements MigrationInterface {
  name = 'CreateFinanceConfig1736900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`finance_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`withdraw_fee_rate\` decimal(6,4) NOT NULL DEFAULT 0.0200,
        \`withdraw_min_amount\` decimal(16,2) NOT NULL DEFAULT 100.00,
        \`withdraw_max_amount\` decimal(16,2) NOT NULL DEFAULT 50000.00,
        \`withdraw_daily_count\` int(11) NOT NULL DEFAULT 3,
        \`withdraw_min_bet_multiplier\` decimal(10,2) NOT NULL DEFAULT 1.00,
        \`withdraw_explain\` varchar(500) NOT NULL DEFAULT '',
        \`recharge_min_amount\` decimal(16,2) NOT NULL DEFAULT 100.00,
        \`recharge_max_amount\` decimal(16,2) NOT NULL DEFAULT 100000.00,
        \`wage_rate\` decimal(6,4) NOT NULL DEFAULT 0.0010,
        \`wage_min_bet\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`transfer_min_amount\` decimal(16,2) NOT NULL DEFAULT 10.00,
        \`transfer_max_amount\` decimal(16,2) NOT NULL DEFAULT 100000.00,
        \`new_user_bonus\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`first_recharge_bonus\` decimal(6,4) NOT NULL DEFAULT 0.0000,
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`recharge_preset\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`amount\` decimal(16,2) NOT NULL,
        \`mark\` varchar(50) NOT NULL DEFAULT '',
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `recharge_preset`');
    await queryRunner.query('DROP TABLE IF EXISTS `finance_config`');
  }
}
