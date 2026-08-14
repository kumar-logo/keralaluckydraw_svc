import { MigrationInterface, QueryRunner } from 'typeorm';

export class ThirdPartyIntegration1740840000000 implements MigrationInterface {
  name = 'ThirdPartyIntegration1740840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`third_party_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`agency_uid\` varchar(191) NOT NULL,
        \`member_prefix\` varchar(64) NOT NULL DEFAULT '',
        \`member_suffix\` varchar(64) NOT NULL DEFAULT '',
        \`currency\` varchar(8) NOT NULL DEFAULT 'INR',
        \`language\` varchar(8) NOT NULL DEFAULT 'en',
        \`platform\` int(11) NOT NULL DEFAULT 1,
        \`launch_url\` varchar(255) NOT NULL,
        \`callback_secret\` varchar(191) NULL,
        \`enabled\` tinyint(4) NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`third_party_txn\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`txn_key\` varchar(191) NOT NULL,
        \`serial_number\` varchar(191) NULL,
        \`member_id\` bigint(20) unsigned NOT NULL,
        \`game_round\` varchar(191) NULL,
        \`bet_amount\` decimal(18,6) NOT NULL DEFAULT 0,
        \`win_amount\` decimal(18,6) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uniq_txn_key\` (\`txn_key\`),
        KEY \`idx_member_round\` (\`member_id\`, \`game_round\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const uidExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'game_uid'`,
    );
    if (Number(uidExists?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE game_list ADD COLUMN game_uid VARCHAR(191) NULL AFTER game_code`,
      );
    }

    const cfgCount = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM third_party_config`,
    );
    if (Number(cfgCount?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `INSERT INTO third_party_config
          (agency_uid, member_prefix, member_suffix, currency, language, platform, launch_url, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'e8d127ea3e224game48ce40c0f558',
          'h86457',
          '10356',
          'INR',
          'en',
          1,
          'https://24gameapi.org/api/seamless/v1/launch.php',
          1,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const uidExists = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'game_list'
         AND COLUMN_NAME = 'game_uid'`,
    );
    if (Number(uidExists?.[0]?.c ?? 0) > 0) {
      await queryRunner.query(`ALTER TABLE game_list DROP COLUMN game_uid`);
    }
    await queryRunner.query('DROP TABLE IF EXISTS `third_party_txn`');
    await queryRunner.query('DROP TABLE IF EXISTS `third_party_config`');
  }
}
