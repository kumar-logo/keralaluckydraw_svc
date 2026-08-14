import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppConfig1737000000000 implements MigrationInterface {
  name = 'CreateAppConfig1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`app_name\` varchar(100) NOT NULL DEFAULT '',
        \`site_url\` varchar(255) NOT NULL DEFAULT '',
        \`currency\` varchar(10) NOT NULL DEFAULT '₹',
        \`marquee_text\` varchar(1000) NOT NULL DEFAULT '',
        \`tg_link\` varchar(255) NOT NULL DEFAULT '',
        \`wa_link\` varchar(255) NOT NULL DEFAULT '',
        \`x_link\` varchar(255) NOT NULL DEFAULT '',
        \`facebook_link\` varchar(255) NOT NULL DEFAULT '',
        \`instagram_link\` varchar(255) NOT NULL DEFAULT '',
        \`support_chat_provider\` varchar(50) NOT NULL DEFAULT '',
        \`support_chat_license\` varchar(100) NOT NULL DEFAULT '',
        \`support_telegram_url\` varchar(255) NOT NULL DEFAULT '',
        \`scheduler_tick_ms\` int(11) NOT NULL DEFAULT 1000,
        \`gameinfo_cache_ttl_ms\` int(11) NOT NULL DEFAULT 1000,
        \`round_cooldown_ms\` int(11) NOT NULL DEFAULT 3000,
        \`result_mode_default\` varchar(20) NOT NULL DEFAULT 'random',
        \`result_house_edge_default\` decimal(5,4) NOT NULL DEFAULT 0.1500,
        \`result_sample_size\` int(11) NOT NULL DEFAULT 2000,
        \`result_decision_budget_ms\` int(11) NOT NULL DEFAULT 250,
        \`odds_missing_policy\` varchar(20) NOT NULL DEFAULT 'use_stored',
        \`bigwin_min_amount\` decimal(16,2) NOT NULL DEFAULT 1000.00,
        \`bigwin_template\` varchar(255) NOT NULL DEFAULT '',
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_config`');
  }
}
