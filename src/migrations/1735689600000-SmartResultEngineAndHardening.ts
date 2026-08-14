import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmartResultEngineAndHardening1735689600000 implements MigrationInterface {
  name = 'SmartResultEngineAndHardening1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`game_rounds\`
        ADD COLUMN \`result_status\` varchar(20) NOT NULL DEFAULT 'auto' AFTER \`manual_result\`,
        ADD COLUMN \`result_mode\` varchar(20) DEFAULT NULL AFTER \`result_status\`,
        ADD COLUMN \`proposed_result\` json DEFAULT NULL AFTER \`result_mode\`,
        ADD COLUMN \`proposed_by\` varchar(30) DEFAULT NULL AFTER \`proposed_result\`,
        ADD COLUMN \`approved_by\` varchar(30) DEFAULT NULL AFTER \`proposed_by\`,
        ADD COLUMN \`approved_at\` timestamp NULL DEFAULT NULL AFTER \`approved_by\`,
        ADD COLUMN \`created_by\` varchar(30) DEFAULT NULL AFTER \`settled_by\`,
        ADD COLUMN \`updated_by\` varchar(30) DEFAULT NULL AFTER \`created_by\`,
        ADD COLUMN \`deleted_at\` timestamp NULL DEFAULT NULL,
        ADD INDEX \`idx_result_status\` (\`result_status\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`game_odds_config\`
        ADD COLUMN \`created_by\` varchar(30) DEFAULT NULL,
        ADD COLUMN \`updated_by\` varchar(30) DEFAULT NULL,
        ADD COLUMN \`deleted_at\` timestamp NULL DEFAULT NULL
    `);
    await queryRunner.query(`
      DELETE FROM \`game_odds_config\`
      WHERE \`game_id\` NOT IN (SELECT \`id\` FROM \`game_list\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`game_odds_config\`
        ADD CONSTRAINT \`fk_odds_game\` FOREIGN KEY (\`game_id\`)
        REFERENCES \`game_list\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        ADD COLUMN \`created_by\` varchar(30) DEFAULT NULL,
        ADD COLUMN \`updated_by\` varchar(30) DEFAULT NULL,
        ADD COLUMN \`deleted_at\` timestamp NULL DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`orders\`
        ADD COLUMN \`deleted_at\` timestamp NULL DEFAULT NULL,
        ADD INDEX \`idx_game_round_status\` (\`game_id\`, \`round_no\`, \`status\`)
    `);

    await queryRunner.query(`
      CREATE TABLE \`result_decisions\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`round_id\` bigint unsigned NOT NULL,
        \`game_id\` int unsigned NOT NULL,
        \`game_type\` varchar(30) NOT NULL,
        \`mode\` varchar(20) NOT NULL,
        \`decided_by\` varchar(30) NOT NULL,
        \`candidates_evaluated\` int NOT NULL DEFAULT 0,
        \`candidate_space\` int NOT NULL DEFAULT 0,
        \`sampled\` tinyint NOT NULL DEFAULT 0,
        \`chosen_result\` json DEFAULT NULL,
        \`total_stake\` decimal(16,2) NOT NULL DEFAULT 0,
        \`total_payout\` decimal(16,2) NOT NULL DEFAULT 0,
        \`profit_loss\` decimal(16,2) NOT NULL DEFAULT 0,
        \`house_edge_target\` decimal(6,4) DEFAULT NULL,
        \`reason\` varchar(255) DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`idx_rd_round\` (\`round_id\`),
        INDEX \`idx_rd_game\` (\`game_id\`),
        INDEX \`idx_rd_mode\` (\`mode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`status_enums\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`domain\` varchar(30) NOT NULL,
        \`code\` int NOT NULL,
        \`label\` varchar(50) NOT NULL,
        \`color\` varchar(20) DEFAULT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_domain_code\` (\`domain\`, \`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO \`status_enums\` (\`domain\`, \`code\`, \`label\`, \`color\`, \`sort_order\`) VALUES
        ('round', 0, 'Betting Open', 'green', 0),
        ('round', 1, 'Betting Closed', 'orange', 1),
        ('round', 2, 'Settled', 'blue', 2),
        ('round', 3, 'Cancelled', 'default', 3),
        ('order', 0, 'Pending', 'orange', 0),
        ('order', 1, 'Won', 'green', 1),
        ('order', 2, 'Lost', 'default', 2),
        ('order', 3, 'Cancelled', 'red', 3),
        ('order', 4, 'Settled', 'blue', 4),
        ('order', 5, 'Refunded', 'purple', 5),
        ('recharge', 0, 'Pending', 'orange', 0),
        ('recharge', 1, 'Approved', 'green', 1),
        ('recharge', 2, 'Rejected', 'red', 2),
        ('recharge', 3, 'Cancelled', 'default', 3),
        ('withdraw', 0, 'Pending', 'orange', 0),
        ('withdraw', 1, 'Approved', 'green', 1),
        ('withdraw', 2, 'Rejected', 'red', 2)
    `);

    await queryRunner.query(`
      CREATE TABLE \`notification_templates\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`channel\` varchar(20) NOT NULL DEFAULT 'in_app',
        \`title\` varchar(200) DEFAULT NULL,
        \`body\` text,
        \`vars_json\` json DEFAULT NULL,
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`created_by\` varchar(30) DEFAULT NULL,
        \`updated_by\` varchar(30) DEFAULT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_code_channel\` (\`code\`, \`channel\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO \`notification_templates\` (\`code\`, \`channel\`, \`title\`, \`body\`, \`vars_json\`) VALUES
        ('win_payout', 'in_app', 'You won!', 'Congratulations! You won {{amount}} on {{gameName}} round {{roundNo}}.', '["amount","gameName","roundNo"]'),
        ('recharge_approved', 'in_app', 'Recharge approved', 'Your recharge of {{amount}} has been approved.', '["amount"]'),
        ('recharge_rejected', 'in_app', 'Recharge rejected', 'Your recharge of {{amount}} was rejected. {{remark}}', '["amount","remark"]'),
        ('withdraw_approved', 'in_app', 'Withdrawal approved', 'Your withdrawal of {{amount}} has been approved.', '["amount"]'),
        ('withdraw_rejected', 'in_app', 'Withdrawal rejected', 'Your withdrawal of {{amount}} was rejected. {{remark}}', '["amount","remark"]')
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`system_config\`
        (\`config_key\`, \`config_val\`, \`description\`, \`config_group\`, \`config_type\`, \`display_label\`, \`sort_order\`)
      VALUES
        ('result_mode_default', 'random', 'Default result-selection mode when a game has none set (random|weighted|min_payout|max_profit|lowest_risk)', 'result', 'string', 'Default Result Mode', 1),
        ('result_house_edge_default', '0.15', 'Default target house edge for lowest_risk mode (0-1)', 'result', 'number', 'Default House Edge', 2),
        ('result_sample_size', '2000', 'Candidate sample size for large result spaces (digit5/lottery)', 'result', 'number', 'Result Sample Size', 3),
        ('result_decision_budget_ms', '250', 'Wall-clock budget (ms) for result-engine candidate scoring per draw', 'result', 'number', 'Result Decision Budget (ms)', 4),
        ('odds_missing_policy', 'use_stored', 'Behaviour when odds cannot be resolved at settlement (use_stored|void_bet|error)', 'result', 'string', 'Missing Odds Policy', 5),
        ('odds_alias_map', '{}', 'Maps specific bet codes to odds classes, e.g. {"champion_3":"champion","number_7":"number"}', 'result', 'json', 'Odds Alias Map', 6),
        ('color_map_default', '{"0":["red","violet"],"1":["green"],"2":["red"],"3":["green"],"4":["red"],"5":["green","violet"],"6":["red"],"7":["green"],"8":["red"],"9":["green"]}', 'Default WinGo number-to-colours map (single source of truth)', 'game', 'json', 'Default Colour Map', 30)
    `);

    await queryRunner.query(`
      UPDATE \`game_list\`
      SET \`result_config_json\` = JSON_OBJECT('resultMode', 'random')
      WHERE \`result_config_json\` IS NULL AND \`is_third_party\` = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`system_config\` WHERE \`config_key\` IN (
        'result_mode_default', 'result_house_edge_default', 'result_sample_size',
        'result_decision_budget_ms', 'odds_missing_policy', 'odds_alias_map', 'color_map_default'
      )
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS \`notification_templates\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`status_enums\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`result_decisions\``);

    await queryRunner.query(`
      ALTER TABLE \`orders\`
        DROP INDEX \`idx_game_round_status\`,
        DROP COLUMN \`deleted_at\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        DROP COLUMN \`created_by\`,
        DROP COLUMN \`updated_by\`,
        DROP COLUMN \`deleted_at\`
    `);

    await queryRunner.query(
      `ALTER TABLE \`game_odds_config\` DROP FOREIGN KEY \`fk_odds_game\``,
    );
    await queryRunner.query(`
      ALTER TABLE \`game_odds_config\`
        DROP COLUMN \`created_by\`,
        DROP COLUMN \`updated_by\`,
        DROP COLUMN \`deleted_at\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`game_rounds\`
        DROP INDEX \`idx_result_status\`,
        DROP COLUMN \`result_status\`,
        DROP COLUMN \`result_mode\`,
        DROP COLUMN \`proposed_result\`,
        DROP COLUMN \`proposed_by\`,
        DROP COLUMN \`approved_by\`,
        DROP COLUMN \`approved_at\`,
        DROP COLUMN \`created_by\`,
        DROP COLUMN \`updated_by\`,
        DROP COLUMN \`deleted_at\`
    `);
  }
}
