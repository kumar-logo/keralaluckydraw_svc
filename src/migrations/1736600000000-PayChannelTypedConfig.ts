import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayChannelTypedConfig1736600000000 implements MigrationInterface {
  name = 'PayChannelTypedConfig1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SHOW COLUMNS FROM \`pay_channels\``,
    );
    const has = (field: string): boolean =>
      columns.some((column: { Field: string }) => column.Field === field);

    const additions: string[] = [];
    if (!has('icon'))
      additions.push('ADD COLUMN `icon` varchar(500) DEFAULT NULL');
    if (!has('qr_code_url'))
      additions.push('ADD COLUMN `qr_code_url` varchar(500) DEFAULT NULL');
    if (!has('upi_id'))
      additions.push('ADD COLUMN `upi_id` varchar(100) DEFAULT NULL');
    if (!has('account_name'))
      additions.push('ADD COLUMN `account_name` varchar(100) DEFAULT NULL');
    if (!has('account_number'))
      additions.push('ADD COLUMN `account_number` varchar(50) DEFAULT NULL');
    if (!has('ifsc_code'))
      additions.push('ADD COLUMN `ifsc_code` varchar(20) DEFAULT NULL');
    if (!has('bank_name'))
      additions.push('ADD COLUMN `bank_name` varchar(100) DEFAULT NULL');
    if (!has('wallet_address'))
      additions.push('ADD COLUMN `wallet_address` varchar(200) DEFAULT NULL');
    if (!has('network'))
      additions.push('ADD COLUMN `network` varchar(20) DEFAULT NULL');
    if (!has('verify_mode'))
      additions.push(
        "ADD COLUMN `verify_mode` varchar(20) NOT NULL DEFAULT 'manual'",
      );
    if (!has('instructions'))
      additions.push('ADD COLUMN `instructions` varchar(500) DEFAULT NULL');
    if (additions.length) {
      await queryRunner.query(
        `ALTER TABLE \`pay_channels\` ${additions.join(', ')}`,
      );
    }

    if (has('config_json')) {
      await queryRunner.query(`
        UPDATE \`pay_channels\` SET
          \`icon\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.icon')),
          \`qr_code_url\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.qrCodeUrl')),
          \`upi_id\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.upiId')),
          \`account_name\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.accountName')),
          \`account_number\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.accountNumber')),
          \`ifsc_code\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.ifscCode')),
          \`bank_name\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.bankName')),
          \`wallet_address\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.walletAddress')),
          \`network\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.network')),
          \`verify_mode\` = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.verifyMode')), 'manual'),
          \`instructions\` = JSON_UNQUOTE(JSON_EXTRACT(\`config_json\`, '$.instructions'))
        WHERE \`config_json\` IS NOT NULL
      `);
      await queryRunner.query(
        `ALTER TABLE \`pay_channels\` DROP COLUMN \`config_json\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pay_channels\` ADD COLUMN \`config_json\` json DEFAULT NULL`,
    );
    await queryRunner.query(
      'ALTER TABLE `pay_channels` DROP COLUMN `icon`, DROP COLUMN `qr_code_url`, DROP COLUMN `upi_id`, DROP COLUMN `account_name`, DROP COLUMN `account_number`, DROP COLUMN `ifsc_code`, DROP COLUMN `bank_name`, DROP COLUMN `wallet_address`, DROP COLUMN `network`, DROP COLUMN `verify_mode`, DROP COLUMN `instructions`',
    );
  }
}
