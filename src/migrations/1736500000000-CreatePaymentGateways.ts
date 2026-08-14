import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentGateways1736500000000 implements MigrationInterface {
  name = 'CreatePaymentGateways1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payment_gateways\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`gateway_name\` varchar(100) NOT NULL,
        \`provider_code\` varchar(50) NOT NULL,
        \`api_url\` varchar(500) DEFAULT NULL,
        \`api_key\` varchar(500) DEFAULT NULL,
        \`api_secret\` varchar(500) DEFAULT NULL,
        \`callback_url\` varchar(500) DEFAULT NULL,
        \`webhook_secret\` varchar(500) DEFAULT NULL,
        \`min_amount\` decimal(16,2) DEFAULT 100.00,
        \`max_amount\` decimal(16,2) DEFAULT 50000.00,
        \`fee_rate\` decimal(5,4) DEFAULT 0.0000,
        \`fee_fixed\` decimal(16,2) DEFAULT 0.00,
        \`supported_methods\` json DEFAULT NULL,
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_provider_code\` (\`provider_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`payment_gateways\``);
  }
}
