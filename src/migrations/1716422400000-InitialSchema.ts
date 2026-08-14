import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1716422400000 implements MigrationInterface {
  name = 'InitialSchema1716422400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`activities\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`activity_name\` varchar(100) NOT NULL,
        \`activity_type\` varchar(30) NOT NULL,
        \`description\` text DEFAULT NULL,
        \`image_url\` varchar(500) DEFAULT NULL,
        \`config_json\` longtext DEFAULT NULL,
        \`start_time\` timestamp NULL DEFAULT NULL,
        \`end_time\` timestamp NULL DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`activity_done\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`activity_id\` int(10) unsigned NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_activity\` (\`user_id\`,\`activity_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`admin_logs\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`admin_id\` int(10) unsigned NOT NULL,
        \`action\` varchar(100) NOT NULL,
        \`target\` varchar(100) DEFAULT NULL,
        \`detail\` text DEFAULT NULL,
        \`ip_address\` varchar(45) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_admin_id\` (\`admin_id\`),
        KEY \`idx_action\` (\`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`admin_users\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`username\` varchar(50) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`display_name\` varchar(100) DEFAULT NULL,
        \`role\` varchar(30) NOT NULL DEFAULT 'admin',
        \`last_login\` timestamp NULL DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`permissions\` longtext DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`agent_commissions\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`from_user\` varchar(32) NOT NULL,
        \`source_type\` varchar(30) DEFAULT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`commission\` decimal(16,2) NOT NULL,
        \`level_depth\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_from_user\` (\`from_user\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`agent_levels\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`level\` tinyint(3) unsigned NOT NULL,
        \`level_name\` varchar(50) DEFAULT NULL,
        \`commission_rate\` decimal(5,4) DEFAULT 0.0000,
        \`game_type\` varchar(30) DEFAULT NULL,
        \`min_subordinates\` int(11) DEFAULT 0,
        \`min_recharge\` decimal(16,2) DEFAULT 0.00,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`level\` (\`level\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`announcements\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`content\` text NOT NULL,
        \`link_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`start_time\` timestamp NULL DEFAULT NULL,
        \`end_time\` timestamp NULL DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`avatar_list\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`avatar_url\` varchar(500) NOT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`bank_cards\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`card_name\` varchar(100) DEFAULT NULL,
        \`card_number\` varchar(50) DEFAULT NULL,
        \`ifsc_code\` varchar(20) DEFAULT NULL,
        \`upi_address\` varchar(100) DEFAULT NULL,
        \`user_email\` varchar(100) DEFAULT NULL,
        \`is_default\` tinyint(4) NOT NULL DEFAULT 0,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`banners\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(200) DEFAULT NULL,
        \`image_url\` varchar(500) NOT NULL,
        \`link_url\` varchar(500) DEFAULT NULL,
        \`position\` varchar(30) NOT NULL DEFAULT 'home',
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`start_time\` timestamp NULL DEFAULT NULL,
        \`end_time\` timestamp NULL DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`box_draw_history\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`box_id\` int(10) unsigned NOT NULL,
        \`item_id\` int(10) unsigned NOT NULL,
        \`prize\` decimal(16,2) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`box_games\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_name\` varchar(100) DEFAULT NULL,
        \`price\` decimal(16,2) NOT NULL,
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`box_items\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`box_id\` int(10) unsigned NOT NULL,
        \`item_name\` varchar(100) NOT NULL,
        \`prize\` decimal(16,2) NOT NULL,
        \`rate\` decimal(8,6) NOT NULL,
        \`image_url\` varchar(500) DEFAULT NULL,
        \`link_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_box_id\` (\`box_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`cashrain_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_name\` varchar(100) DEFAULT NULL,
        \`start_time\` time DEFAULT NULL,
        \`end_time\` time DEFAULT NULL,
        \`min_prize\` decimal(16,2) DEFAULT 1.00,
        \`max_prize\` decimal(16,2) DEFAULT 100.00,
        \`duration\` int(11) DEFAULT 30,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`cashrain_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`game_id\` int(10) unsigned NOT NULL,
        \`round_no\` varchar(30) DEFAULT NULL,
        \`prize\` decimal(16,2) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`casino_games\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_code\` varchar(100) NOT NULL,
        \`game_name\` varchar(200) NOT NULL,
        \`provider_id\` int(10) unsigned DEFAULT NULL,
        \`category_id\` int(10) unsigned DEFAULT NULL,
        \`image_url\` varchar(500) DEFAULT NULL,
        \`is_hot\` tinyint(1) DEFAULT 0,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`game_code\` (\`game_code\`),
        KEY \`idx_provider\` (\`provider_id\`),
        KEY \`idx_category\` (\`category_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`cdkey_codes\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`cd_key\` varchar(50) NOT NULL,
        \`award_type\` varchar(30) DEFAULT 'balance',
        \`award_amount\` decimal(16,2) NOT NULL,
        \`max_uses\` int(11) DEFAULT 1,
        \`used_count\` int(11) DEFAULT 0,
        \`expired_at\` timestamp NULL DEFAULT NULL,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`cd_key\` (\`cd_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`cdkey_usage\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`cdkey_id\` bigint(20) unsigned NOT NULL,
        \`user_id\` varchar(32) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_cdkey_user\` (\`cdkey_id\`,\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`checkin_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`day_num\` tinyint(4) NOT NULL,
        \`award_type\` varchar(20) DEFAULT 'chip',
        \`award_num\` decimal(16,2) NOT NULL,
        \`status\` tinyint(4) DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_day\` (\`day_num\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`checkin_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`day_num\` tinyint(4) NOT NULL,
        \`time_key\` varchar(20) NOT NULL,
        \`act_key\` varchar(50) DEFAULT NULL,
        \`award_num\` decimal(16,2) DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_day_time\` (\`user_id\`,\`day_num\`,\`time_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_categories\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`category_name\` varchar(50) NOT NULL,
        \`category_code\` varchar(30) NOT NULL,
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`category_code\` (\`category_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_fee_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int(10) unsigned NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`fee_type\` varchar(30) NOT NULL,
        \`fee_rate\` decimal(6,4) NOT NULL DEFAULT 0.0000,
        \`fixed_fee\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_game_fee\` (\`game_id\`,\`fee_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_list\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_name\` varchar(100) NOT NULL,
        \`game_code\` varchar(50) NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`category_id\` int(10) unsigned DEFAULT NULL,
        \`provider\` varchar(50) NOT NULL DEFAULT 'TK',
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`banner_url\` varchar(500) DEFAULT NULL,
        \`draw_interval\` int(10) unsigned NOT NULL DEFAULT 60,
        \`selling_price\` decimal(16,2) NOT NULL DEFAULT 10.00,
        \`min_bet\` decimal(16,2) NOT NULL DEFAULT 10.00,
        \`max_bet\` decimal(16,2) NOT NULL DEFAULT 100000.00,
        \`is_hot\` tinyint(4) NOT NULL DEFAULT 0,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`is_hidden\` tinyint(4) NOT NULL DEFAULT 0,
        \`is_paused\` tinyint(4) NOT NULL DEFAULT 0,
        \`emergency_stop\` tinyint(4) NOT NULL DEFAULT 0,
        \`config_json\` longtext DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_game_code\` (\`game_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_odds_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int(10) unsigned NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`bet_type\` varchar(50) NOT NULL,
        \`odds\` decimal(10,4) NOT NULL DEFAULT 1.0000,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_game_bet\` (\`game_id\`,\`bet_type\`),
        KEY \`idx_game_id\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_providers\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`provider_code\` varchar(50) NOT NULL,
        \`provider_name\` varchar(100) NOT NULL,
        \`api_url\` varchar(500) DEFAULT NULL,
        \`api_key\` varchar(500) DEFAULT NULL,
        \`api_secret\` varchar(500) DEFAULT NULL,
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`provider_code\` (\`provider_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`game_rounds\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int(10) unsigned NOT NULL,
        \`round_no\` varchar(30) NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 0,
        \`draw_time\` timestamp NULL DEFAULT NULL,
        \`total_bet\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`total_payout\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`stop_bet_time\` timestamp NULL DEFAULT NULL,
        \`manual_result\` tinyint(4) NOT NULL DEFAULT 0,
        \`settled_by\` varchar(30) DEFAULT NULL,
        \`settled_at\` timestamp NULL DEFAULT NULL,
        \`result\` longtext DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_game_round\` (\`game_id\`,\`round_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`lottery_draw_details\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int(10) unsigned NOT NULL,
        \`round_no\` varchar(30) NOT NULL,
        \`prize_tier\` varchar(30) DEFAULT NULL,
        \`prize_name\` varchar(100) DEFAULT NULL,
        \`prize_amt\` decimal(16,2) DEFAULT NULL,
        \`numbers\` longtext DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_game_round\` (\`game_id\`,\`round_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`messages\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`title\` varchar(200) DEFAULT NULL,
        \`content\` text DEFAULT NULL,
        \`msg_type\` varchar(20) NOT NULL DEFAULT 'system',
        \`is_read\` tinyint(4) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(64) NOT NULL,
        \`user_id\` varchar(32) NOT NULL,
        \`game_id\` int(10) unsigned NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`round_no\` varchar(30) NOT NULL,
        \`bet_type\` varchar(30) DEFAULT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`quantity\` int(11) NOT NULL DEFAULT 1,
        \`total_amount\` decimal(16,2) NOT NULL,
        \`odds\` decimal(10,2) NOT NULL DEFAULT 1.00,
        \`win_amount\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`is_bonus\` tinyint(4) NOT NULL DEFAULT 0,
        \`status\` tinyint(4) NOT NULL DEFAULT 0,
        \`settled_at\` timestamp NULL DEFAULT NULL,
        \`bet_content\` longtext NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_order_no\` (\`order_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`pay_channels\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`channel_name\` varchar(100) NOT NULL,
        \`channel_code\` varchar(50) NOT NULL,
        \`channel_type\` varchar(20) DEFAULT NULL,
        \`min_amount\` decimal(16,2) DEFAULT 0.00,
        \`max_amount\` decimal(16,2) DEFAULT 999999.00,
        \`fee_rate\` decimal(5,4) DEFAULT 0.0000,
        \`config_json\` longtext DEFAULT NULL,
        \`gateway_url\` varchar(500) DEFAULT NULL,
        \`gateway_key\` varchar(500) DEFAULT NULL,
        \`gateway_secret\` varchar(500) DEFAULT NULL,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`popups\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(200) DEFAULT NULL,
        \`content\` text DEFAULT NULL,
        \`image_url\` varchar(500) DEFAULT NULL,
        \`link_url\` varchar(500) DEFAULT NULL,
        \`popup_type\` varchar(30) DEFAULT 'home',
        \`frequency\` varchar(20) DEFAULT 'once',
        \`sort_order\` int(11) DEFAULT 0,
        \`start_time\` timestamp NULL DEFAULT NULL,
        \`end_time\` timestamp NULL DEFAULT NULL,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`race_runner_frames\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int(10) unsigned NOT NULL,
        \`round_no\` varchar(30) NOT NULL,
        \`frames\` longtext NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_game_round\` (\`game_id\`,\`round_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rank_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`rank_id\` int(11) NOT NULL,
        \`rank_name\` varchar(100) DEFAULT NULL,
        \`rank_type\` varchar(30) DEFAULT NULL,
        \`period\` varchar(20) DEFAULT NULL,
        \`prizes\` longtext DEFAULT NULL,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`rank_id\` (\`rank_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rank_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`rank_id\` int(11) NOT NULL,
        \`round_no\` varchar(30) NOT NULL,
        \`user_id\` varchar(32) NOT NULL,
        \`score\` decimal(16,2) DEFAULT 0.00,
        \`rank_pos\` int(11) DEFAULT NULL,
        \`prize\` decimal(16,2) DEFAULT 0.00,
        \`is_claimed\` tinyint(1) DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_rank_round\` (\`rank_id\`,\`round_no\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rebate_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`bet_amount\` decimal(16,2) DEFAULT 0.00,
        \`rebate_amount\` decimal(16,2) DEFAULT 0.00,
        \`rebate_rate\` decimal(6,4) DEFAULT 0.0000,
        \`status\` tinyint(4) DEFAULT 0,
        \`date_key\` varchar(10) DEFAULT NULL,
        \`game_type\` varchar(30) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`recharge_awards\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`award_name\` varchar(100) DEFAULT NULL,
        \`award_type\` varchar(30) DEFAULT NULL,
        \`min_amount\` decimal(16,2) DEFAULT 0.00,
        \`max_amount\` decimal(16,2) DEFAULT 999999.00,
        \`bonus_rate\` decimal(5,4) DEFAULT 0.0000,
        \`bonus_fixed\` decimal(16,2) DEFAULT 0.00,
        \`max_bonus\` decimal(16,2) DEFAULT 999999.00,
        \`sort_order\` int(11) DEFAULT 0,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`recharge_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(64) NOT NULL,
        \`user_id\` varchar(32) NOT NULL,
        \`channel_id\` int(10) unsigned DEFAULT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`actual_amount\` decimal(16,2) DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 0,
        \`pay_url\` varchar(1000) DEFAULT NULL,
        \`callback_data\` text DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`share_configs\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(200) DEFAULT NULL,
        \`description\` text DEFAULT NULL,
        \`image_url\` varchar(500) DEFAULT NULL,
        \`link_url\` varchar(500) DEFAULT NULL,
        \`game_type\` varchar(30) DEFAULT NULL,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sms_codes\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`phone\` varchar(20) NOT NULL,
        \`code\` varchar(10) NOT NULL,
        \`type\` varchar(20) DEFAULT 'login',
        \`expired_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        \`used\` tinyint(1) DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_phone_code\` (\`phone\`,\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`config_key\` varchar(100) NOT NULL,
        \`config_val\` text DEFAULT NULL,
        \`description\` varchar(255) DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_config_key\` (\`config_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`transaction_types\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`type_code\` varchar(30) NOT NULL,
        \`type_name\` varchar(50) NOT NULL,
        \`category\` varchar(20) DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`type_code\` (\`type_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`source_type\` varchar(30) NOT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`balance\` decimal(16,2) DEFAULT NULL,
        \`ref_id\` varchar(64) DEFAULT NULL,
        \`description\` varchar(255) DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`transfer_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`direction\` varchar(20) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_favorites\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`game_code\` varchar(100) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_game\` (\`user_id\`,\`game_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_recent_games\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`game_code\` varchar(100) NOT NULL,
        \`played_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_game\` (\`user_id\`,\`game_code\`),
        KEY \`idx_user_played\` (\`user_id\`,\`played_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`token\` varchar(500) NOT NULL,
        \`device\` varchar(50) DEFAULT NULL,
        \`ip_address\` varchar(45) DEFAULT NULL,
        \`expired_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_token\` (\`token\`(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`phone\` varchar(20) DEFAULT NULL,
        \`nickname\` varchar(50) DEFAULT NULL,
        \`avatar\` varchar(500) NOT NULL DEFAULT '/images/avatar/default.webp',
        \`password_hash\` varchar(255) DEFAULT NULL,
        \`balance\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`bonus_balance\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`is_recharge\` tinyint(4) NOT NULL DEFAULT 0,
        \`vip_level\` tinyint(3) unsigned NOT NULL DEFAULT 0,
        \`invite_code\` varchar(20) DEFAULT NULL,
        \`invited_by\` varchar(20) DEFAULT NULL,
        \`tg_id\` varchar(100) DEFAULT NULL,
        \`google_id\` varchar(100) DEFAULT NULL,
        \`channel_id\` varchar(50) NOT NULL DEFAULT 'keralaluckydraw',
        \`visitor_id\` varchar(64) DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 1,
        \`app_award\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`version\` int(11) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_id\` (\`user_id\`),
        KEY \`idx_phone\` (\`phone\`),
        KEY \`idx_invite_code\` (\`invite_code\`),
        KEY \`idx_invited_by\` (\`invited_by\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`vip_awards\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`vip_level\` tinyint(3) unsigned NOT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_level\` (\`user_id\`,\`vip_level\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`vip_levels\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`level\` tinyint(3) unsigned NOT NULL,
        \`level_name\` varchar(50) DEFAULT NULL,
        \`recharge_amount\` decimal(16,2) DEFAULT 0.00,
        \`bet_amount\` decimal(16,2) DEFAULT 0.00,
        \`award_amount\` decimal(16,2) DEFAULT 0.00,
        \`monthly_reward\` decimal(16,2) DEFAULT 0.00,
        \`rebate_rate\` decimal(5,4) DEFAULT 0.0000,
        \`withdraw_limit\` decimal(16,2) DEFAULT 0.00,
        \`status\` tinyint(4) DEFAULT 1,
        \`icon_url\` varchar(500) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`level\` (\`level\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`wage_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`week_key\` varchar(20) NOT NULL,
        \`cond_amount\` decimal(16,2) DEFAULT 0.00,
        \`rc_amount\` decimal(16,2) DEFAULT 0.00,
        \`wage_amount\` decimal(16,2) DEFAULT 0.00,
        \`is_claim\` tinyint(1) DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_week\` (\`user_id\`,\`week_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`wheel_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`game_name\` varchar(100) DEFAULT NULL,
        \`segments\` longtext NOT NULL,
        \`free_spins\` int(11) DEFAULT 1,
        \`spin_price\` decimal(16,2) DEFAULT 10.00,
        \`status\` tinyint(4) DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`wheel_draw_history\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`wheel_id\` int(10) unsigned NOT NULL,
        \`segment_idx\` int(11) NOT NULL,
        \`prize\` decimal(16,2) DEFAULT NULL,
        \`is_free\` tinyint(1) DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`withdrawal_records\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(64) NOT NULL,
        \`user_id\` varchar(32) NOT NULL,
        \`bankcard_id\` bigint(20) unsigned DEFAULT NULL,
        \`amount\` decimal(16,2) NOT NULL,
        \`fee\` decimal(16,2) NOT NULL DEFAULT 0.00,
        \`actual_amount\` decimal(16,2) DEFAULT NULL,
        \`status\` tinyint(4) NOT NULL DEFAULT 0,
        \`remark\` varchar(500) DEFAULT NULL,
        \`admin_id\` int(10) unsigned DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_order_no\` (\`order_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'withdrawal_records',
      'wheel_draw_history',
      'wheel_config',
      'wage_records',
      'vip_levels',
      'vip_awards',
      'user_sessions',
      'user_recent_games',
      'user_favorites',
      'users',
      'transfer_records',
      'transactions',
      'transaction_types',
      'system_config',
      'sms_codes',
      'share_configs',
      'recharge_records',
      'recharge_awards',
      'rebate_records',
      'rank_records',
      'rank_config',
      'race_runner_frames',
      'popups',
      'pay_channels',
      'orders',
      'messages',
      'lottery_draw_details',
      'game_rounds',
      'game_providers',
      'game_odds_config',
      'game_list',
      'game_fee_config',
      'game_categories',
      'checkin_records',
      'checkin_config',
      'cdkey_usage',
      'cdkey_codes',
      'casino_games',
      'cashrain_records',
      'cashrain_config',
      'box_items',
      'box_games',
      'box_draw_history',
      'banners',
      'bank_cards',
      'avatar_list',
      'announcements',
      'agent_levels',
      'agent_commissions',
      'admin_users',
      'admin_logs',
      'activity_done',
      'activities',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
