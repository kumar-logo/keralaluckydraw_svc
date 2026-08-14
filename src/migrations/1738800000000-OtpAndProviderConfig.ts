import { MigrationInterface, QueryRunner } from 'typeorm';

const APP_CONFIG_COLUMNS: Array<[string, string]> = [
  ['otp_enabled', 'tinyint NOT NULL DEFAULT 0'],
  ['otp_length', 'int NOT NULL DEFAULT 6'],
  ['otp_ttl_seconds', 'int NOT NULL DEFAULT 300'],
  ['otp_resend_cooldown_sec', 'int NOT NULL DEFAULT 60'],
  ['otp_max_attempts', 'int NOT NULL DEFAULT 5'],
  ['sms_enabled', 'tinyint NOT NULL DEFAULT 0'],
  ['sms_endpoint', "varchar(255) NOT NULL DEFAULT ''"],
  ['sms_api_key', "varchar(255) NOT NULL DEFAULT ''"],
  ['sms_sender_id', "varchar(50) NOT NULL DEFAULT ''"],
  ['sms_route', "varchar(20) NOT NULL DEFAULT ''"],
  ['sms_template_id', "varchar(50) NOT NULL DEFAULT ''"],
  ['whatsapp_enabled', 'tinyint NOT NULL DEFAULT 0'],
  ['whatsapp_endpoint', "varchar(255) NOT NULL DEFAULT ''"],
  ['whatsapp_token', "varchar(255) NOT NULL DEFAULT ''"],
  ['whatsapp_template_name', "varchar(100) NOT NULL DEFAULT ''"],
  ['whatsapp_lang_code', "varchar(10) NOT NULL DEFAULT 'en'"],
  ['google_client_id', "varchar(255) NOT NULL DEFAULT ''"],
  ['telegram_bot_token', "varchar(255) NOT NULL DEFAULT ''"],
];

const OTP_TEMPLATES: Array<[string, string, string, string]> = [
  [
    'otp_login',
    'sms',
    'Login OTP',
    'Dear Customer, {otp} is your verification code -PNGOTP',
  ],
  [
    'otp_register',
    'sms',
    'Register OTP',
    'Dear Customer, {otp} is your verification code -PNGOTP',
  ],
  ['otp_login', 'whatsapp', 'Login OTP', 'otp_template_common'],
  ['otp_register', 'whatsapp', 'Register OTP', 'otp_template_common'],
];

export class OtpAndProviderConfig1738800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sms_codes ADD COLUMN IF NOT EXISTS channel varchar(20) NOT NULL DEFAULT 'sms'`,
    );
    await queryRunner.query(
      `ALTER TABLE sms_codes ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE sms_codes MODIFY COLUMN expired_at timestamp NULL DEFAULT NULL`,
    );

    for (const [name, def] of APP_CONFIG_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ${name} ${def}`,
      );
    }

    for (const [code, channel, title, body] of OTP_TEMPLATES) {
      await queryRunner.query(
        `INSERT IGNORE INTO notification_templates (code, channel, title, body, status) VALUES (?, ?, ?, ?, 1)`,
        [code, channel, title, body],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notification_templates WHERE code IN ('otp_login', 'otp_register')`,
    );
    for (const [name] of APP_CONFIG_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE app_config DROP COLUMN IF EXISTS ${name}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE sms_codes DROP COLUMN IF EXISTS channel`,
    );
    await queryRunner.query(
      `ALTER TABLE sms_codes DROP COLUMN IF EXISTS attempts`,
    );
  }
}
