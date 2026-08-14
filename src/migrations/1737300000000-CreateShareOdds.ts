import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShareOdds1737300000000 implements MigrationInterface {
  name = 'CreateShareOdds1737300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`share_channel\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(60) NOT NULL,
        \`icon\` varchar(60) NOT NULL,
        \`url\` varchar(500) NOT NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`odds_alias\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`bet_code\` varchar(60) NOT NULL,
        \`odds_class\` varchar(60) NOT NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `odds_alias`');
    await queryRunner.query('DROP TABLE IF EXISTS `share_channel`');
  }
}
