import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFirebaseConfig1741160000000 implements MigrationInterface {
  name = 'CreateFirebaseConfig1741160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`firebase_config\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`api_key\` varchar(255) NOT NULL DEFAULT '',
        \`auth_domain\` varchar(255) NOT NULL DEFAULT '',
        \`project_id\` varchar(255) NOT NULL DEFAULT '',
        \`storage_bucket\` varchar(255) NOT NULL DEFAULT '',
        \`messaging_sender_id\` varchar(255) NOT NULL DEFAULT '',
        \`app_id\` varchar(255) NOT NULL DEFAULT '',
        \`measurement_id\` varchar(255) NOT NULL DEFAULT '',
        \`service_account_json\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_fcm_tokens\` (
        \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(32) NOT NULL,
        \`token\` varchar(512) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT current_timestamp(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_fcm_token\` (\`token\`),
        KEY \`idx_fcm_user\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const cfgCount = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM firebase_config`,
    );
    if (Number(cfgCount?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `INSERT INTO firebase_config
          (api_key, auth_domain, project_id, storage_bucket, messaging_sender_id, app_id, measurement_id, service_account_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'AIzaSyAWlyxXcIwrPuoKLQtqdskPt-CyppaNVL0',
          'keralawinz.firebaseapp.com',
          'keralawinz',
          'keralawinz.firebasestorage.app',
          '780407124905',
          '1:780407124905:web:be97ba7717e30f72168ab8',
          'G-ME6Q8433BV',
          '',
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_fcm_tokens`');
    await queryRunner.query('DROP TABLE IF EXISTS `firebase_config`');
  }
}
