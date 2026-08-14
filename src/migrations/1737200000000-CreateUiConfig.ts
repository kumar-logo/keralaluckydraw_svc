import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUiConfig1737200000000 implements MigrationInterface {
  name = 'CreateUiConfig1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sprite_scale\` decimal(6,4) NOT NULL DEFAULT 0.7500,
        \`cat_lottery\` int(11) NOT NULL DEFAULT 1,
        \`cat_casino\` int(11) NOT NULL DEFAULT 5,
        \`cat_slot\` int(11) NOT NULL DEFAULT 6,
        \`cat_lobby\` int(11) NOT NULL DEFAULT 1020,
        \`cat_live\` int(11) NOT NULL DEFAULT 1025,
        \`cat_fishing\` int(11) NOT NULL DEFAULT 1026,
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_color_map\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`digit\` int(11) NOT NULL,
        \`color\` varchar(20) NOT NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ui_color_map_digit\` (\`digit\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_status_map\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`domain\` varchar(20) NOT NULL,
        \`status\` int(11) NOT NULL,
        \`status_text\` varchar(60) NOT NULL,
        \`color\` varchar(20) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ui_status_map_domain\` (\`domain\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_state\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`name\` varchar(60) NOT NULL,
        \`color\` varchar(20) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_position\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`color\` varchar(20) NOT NULL,
        \`gradient_from\` varchar(20) NOT NULL,
        \`gradient_to\` varchar(20) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_pay_rate\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`odds\` decimal(10,4) NOT NULL,
        \`type\` int(11) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_mystery_box_gradient\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`gradient\` varchar(200) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ui_result_tab\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`tab_key\` varchar(40) NOT NULL,
        \`label\` varchar(60) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `ui_result_tab`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_mystery_box_gradient`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_pay_rate`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_position`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_state`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_status_map`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_color_map`');
    await queryRunner.query('DROP TABLE IF EXISTS `ui_config`');
  }
}
