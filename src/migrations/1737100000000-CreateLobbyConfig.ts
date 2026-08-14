import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLobbyConfig1737100000000 implements MigrationInterface {
  name = 'CreateLobbyConfig1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`lobby_section\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`scope\` varchar(20) NOT NULL,
        \`filter_type\` varchar(60) NOT NULL,
        \`filter_name\` varchar(100) NOT NULL,
        \`row_count\` int(11) NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lobby_section_scope\` (\`scope\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`lobby_provider\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`category_id\` int(11) NULL,
        \`filter_type\` varchar(60) NOT NULL,
        \`filter_name\` varchar(100) NOT NULL,
        \`big_icon_x\` int(11) NOT NULL DEFAULT 0,
        \`big_icon_y\` int(11) NOT NULL DEFAULT 0,
        \`icon_x\` int(11) NOT NULL DEFAULT 0,
        \`icon_y\` int(11) NOT NULL DEFAULT 0,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lobby_provider_cat\` (\`category_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`lobby_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`filter_icon\` varchar(500) NOT NULL DEFAULT '',
        \`light_icon\` varchar(500) NOT NULL DEFAULT '',
        \`filter_width\` int(11) NOT NULL DEFAULT 518,
        \`filter_height\` int(11) NOT NULL DEFAULT 794,
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `lobby_provider`');
    await queryRunner.query('DROP TABLE IF EXISTS `lobby_section`');
    await queryRunner.query('DROP TABLE IF EXISTS `lobby_config`');
  }
}
