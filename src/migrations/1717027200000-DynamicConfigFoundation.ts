import { MigrationInterface, QueryRunner } from 'typeorm';

export class DynamicConfigFoundation1717027200000 implements MigrationInterface {
  name = 'DynamicConfigFoundation1717027200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        ADD COLUMN \`is_lottery\` tinyint NOT NULL DEFAULT 0 AFTER \`is_hot\`,
        ADD COLUMN \`is_third_party\` tinyint NOT NULL DEFAULT 0 AFTER \`is_lottery\`,
        ADD COLUMN \`group_name\` varchar(100) DEFAULT NULL AFTER \`is_third_party\`,
        ADD COLUMN \`lottery_type\` varchar(20) NOT NULL DEFAULT 'auto' AFTER \`group_name\`,
        ADD COLUMN \`theme_color\` varchar(20) DEFAULT NULL AFTER \`lottery_type\`,
        ADD COLUMN \`bg_color\` varchar(20) DEFAULT NULL AFTER \`theme_color\`,
        ADD COLUMN \`text_color\` varchar(20) DEFAULT NULL AFTER \`bg_color\`,
        ADD COLUMN \`border_color\` varchar(20) DEFAULT NULL AFTER \`text_color\`,
        ADD COLUMN \`emoji\` varchar(10) DEFAULT NULL AFTER \`border_color\`,
        ADD COLUMN \`thumbnail_url\` varchar(500) DEFAULT NULL AFTER \`banner_url\`,
        ADD COLUMN \`description\` text DEFAULT NULL AFTER \`emoji\`,
        ADD COLUMN \`rules_json\` json DEFAULT NULL AFTER \`config_json\`,
        ADD COLUMN \`ui_config_json\` json DEFAULT NULL AFTER \`rules_json\`,
        ADD COLUMN \`result_config_json\` json DEFAULT NULL AFTER \`ui_config_json\`,
        ADD COLUMN \`visibility_json\` json DEFAULT NULL AFTER \`result_config_json\`,
        ADD INDEX \`idx_is_lottery\` (\`is_lottery\`),
        ADD INDEX \`idx_is_third_party\` (\`is_third_party\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`system_config\`
        ADD COLUMN \`config_group\` varchar(50) DEFAULT NULL AFTER \`description\`,
        ADD COLUMN \`config_type\` varchar(20) NOT NULL DEFAULT 'string' AFTER \`config_group\`,
        ADD COLUMN \`display_label\` varchar(100) DEFAULT NULL AFTER \`config_type\`,
        ADD COLUMN \`sort_order\` int NOT NULL DEFAULT 0 AFTER \`display_label\`,
        ADD INDEX \`idx_config_group\` (\`config_group\`)
    `);

    await queryRunner.query(`
      UPDATE \`game_list\` SET \`is_lottery\` = 1
      WHERE \`game_type\` IN ('kro', 'krc', 'pjb', 'xq')
    `);

    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🎯' WHERE \`game_type\` = 'clq' AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🎲' WHERE \`game_type\` = 'dcq' AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🏇' WHERE \`game_type\` IN ('rnc', 'brc') AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🔢' WHERE \`game_type\` IN ('p3o', 'p3q', 'p4b', 'p1b') AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '📦' WHERE \`game_type\` = 'box' AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🎡' WHERE \`game_type\` = 'wheel' AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🎰' WHERE \`game_type\` IN ('evolution', '2j') AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🃏' WHERE \`game_type\` = 'inout' AND \`emoji\` IS NULL`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`emoji\` = '🎟️' WHERE \`game_type\` IN ('kro', 'krc', 'pjb', 'xq') AND \`emoji\` IS NULL`,
    );

    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'finance',
        \`config_type\` = 'number',
        \`display_label\` = 'Withdraw Fee Rate',
        \`sort_order\` = 1
      WHERE \`config_key\` = 'withdraw_fee_rate'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'finance',
        \`config_type\` = 'number',
        \`display_label\` = 'Minimum Withdraw Amount',
        \`sort_order\` = 2
      WHERE \`config_key\` = 'withdraw_min_amount'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'finance',
        \`config_type\` = 'number',
        \`display_label\` = 'Maximum Withdraw Amount',
        \`sort_order\` = 3
      WHERE \`config_key\` = 'withdraw_max_amount'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'finance',
        \`config_type\` = 'number',
        \`display_label\` = 'Wage Rate',
        \`sort_order\` = 4
      WHERE \`config_key\` = 'wage_rate'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'system',
        \`config_type\` = 'number',
        \`display_label\` = 'Scheduler Tick (ms)',
        \`sort_order\` = 1
      WHERE \`config_key\` = 'scheduler_tick_ms'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'system',
        \`config_type\` = 'number',
        \`display_label\` = 'Round Cooldown (ms)',
        \`sort_order\` = 2
      WHERE \`config_key\` = 'round_cooldown_ms'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'system',
        \`config_type\` = 'string',
        \`display_label\` = 'App Name',
        \`sort_order\` = 3
      WHERE \`config_key\` = 'app_name'
    `);
    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'system',
        \`config_type\` = 'string',
        \`display_label\` = 'Site URL',
        \`sort_order\` = 4
      WHERE \`config_key\` = 'site_url'
    `);

    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'lottery',
        \`config_type\` = 'number',
        \`display_label\` = CONCAT('Prize Multiplier - ', REPLACE(\`config_key\`, 'lottery_prize_', '')),
        \`sort_order\` = 10
      WHERE \`config_key\` LIKE 'lottery_prize_%'
    `);

    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'game',
        \`config_type\` = 'number',
        \`display_label\` = REPLACE(REPLACE(\`config_key\`, 'color_', ''), '_', ' '),
        \`sort_order\` = 20
      WHERE \`config_key\` LIKE 'color_%' OR \`config_key\` LIKE 'dice_%'
    `);

    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'commission',
        \`config_type\` = 'number',
        \`display_label\` = CONCAT('Commission Rate Level ', REPLACE(\`config_key\`, 'commission_rate_l', '')),
        \`sort_order\` = 30
      WHERE \`config_key\` LIKE 'commission_rate_%'
    `);

    await queryRunner.query(`
      UPDATE \`system_config\` SET
        \`config_group\` = 'rank',
        \`config_type\` = 'number',
        \`display_label\` = CONCAT('Rank ', REPLACE(\`config_key\`, 'rank_reward_', ''), ' Reward'),
        \`sort_order\` = 40
      WHERE \`config_key\` LIKE 'rank_reward_%'
    `);

    await queryRunner.query(`
      UPDATE \`system_config\` SET \`config_group\` = 'general'
      WHERE \`config_group\` IS NULL
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\` (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES (
        'status_maps',
        '${JSON.stringify({
          round: {
            0: { text: 'Betting Open', color: 'green' },
            1: { text: 'Betting Closed', color: 'orange' },
            2: { text: 'Settled', color: 'blue' },
            3: { text: 'Cancelled', color: 'default' },
          },
          order: {
            0: { text: 'Pending', color: 'orange' },
            1: { text: 'Won', color: 'green' },
            2: { text: 'Lost', color: 'default' },
            3: { text: 'Cancelled', color: 'red' },
            4: { text: 'Settled', color: 'blue' },
            5: { text: 'Refunded', color: 'purple' },
          },
          recharge: {
            0: { text: 'Pending', color: 'orange' },
            1: { text: 'Approved', color: 'green' },
            2: { text: 'Rejected', color: 'red' },
            3: { text: 'Cancelled', color: 'default' },
          },
          withdraw: {
            0: { text: 'Pending', color: 'orange' },
            1: { text: 'Approved', color: 'green' },
            2: { text: 'Rejected', color: 'red' },
          },
        }).replace(/'/g, "\\'")}',
        'Status text and color mappings for rounds, orders, recharges, withdrawals',
        'ui',
        'json',
        'Status Maps',
        1
      )
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\` (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES (
        'interval_presets',
        '${JSON.stringify([
          { value: 30, label: '30 Seconds' },
          { value: 60, label: '1 Minute' },
          { value: 90, label: '1.5 Minutes' },
          { value: 120, label: '2 Minutes' },
          { value: 180, label: '3 Minutes' },
          { value: 300, label: '5 Minutes' },
          { value: 600, label: '10 Minutes' },
          { value: 3600, label: '1 Hour' },
          { value: 86400, label: 'Daily' },
          { value: 604800, label: 'Weekly' },
        ]).replace(/'/g, "\\'")}',
        'Preset interval options for game scheduling',
        'game',
        'json',
        'Interval Presets',
        5
      )
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\` (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES (
        'prize_tier_options',
        '${JSON.stringify(['first', 'second', 'third', 'fourth', 'fifth', 'consolation']).replace(/'/g, "\\'")}',
        'Available prize tier options for lottery games',
        'lottery',
        'json',
        'Prize Tier Options',
        1
      )
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\` (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES (
        'lottery_colors',
        '${JSON.stringify({
          'Online-Official': '#CF3F57',
          SAMRUDHI: '#E15756',
          KARUNYA: '#684CE7',
          'SUVARNA KERALAM': '#0C91D2',
          'KARUNYA PLUS': '#E5740C',
          DHANALEKSHMI: '#48C17B',
          'STHREE-SAKTHI': '#CF28A9',
          BHAGYATHARA: '#65C316',
        }).replace(/'/g, "\\'")}',
        'Color mappings for lottery names',
        'lottery',
        'json',
        'Lottery Colors',
        2
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`system_config\` WHERE \`config_key\` IN ('status_maps', 'interval_presets', 'prize_tier_options', 'lottery_colors')`,
    );

    await queryRunner.query(`
      ALTER TABLE \`system_config\`
        DROP INDEX \`idx_config_group\`,
        DROP COLUMN \`config_group\`,
        DROP COLUMN \`config_type\`,
        DROP COLUMN \`display_label\`,
        DROP COLUMN \`sort_order\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        DROP INDEX \`idx_is_lottery\`,
        DROP INDEX \`idx_is_third_party\`,
        DROP COLUMN \`is_lottery\`,
        DROP COLUMN \`is_third_party\`,
        DROP COLUMN \`group_name\`,
        DROP COLUMN \`lottery_type\`,
        DROP COLUMN \`theme_color\`,
        DROP COLUMN \`bg_color\`,
        DROP COLUMN \`text_color\`,
        DROP COLUMN \`border_color\`,
        DROP COLUMN \`emoji\`,
        DROP COLUMN \`thumbnail_url\`,
        DROP COLUMN \`description\`,
        DROP COLUMN \`rules_json\`,
        DROP COLUMN \`ui_config_json\`,
        DROP COLUMN \`result_config_json\`,
        DROP COLUMN \`visibility_json\`
    `);
  }
}
