import { MigrationInterface, QueryRunner } from 'typeorm';

export class EliminateConfigJson1736700000000 implements MigrationInterface {
  name = 'EliminateConfigJson1736700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payment_gateway_method\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`gateway_id\` int(10) unsigned NOT NULL,
        \`method_code\` varchar(30) NOT NULL,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_gateway\` (\`gateway_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rank_config_prize\` (
        \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`rank_config_id\` int(10) unsigned NOT NULL,
        \`rank_position\` int(11) NOT NULL,
        \`prize_amount\` decimal(16,2) NOT NULL DEFAULT 0.00,
        PRIMARY KEY (\`id\`),
        KEY \`idx_rank_config\` (\`rank_config_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const hasColumn = async (
      table: string,
      field: string,
    ): Promise<boolean> => {
      const cols = await queryRunner.query(`SHOW COLUMNS FROM \`${table}\``);
      return cols.some((c: { Field: string }) => c.Field === field);
    };

    if (await hasColumn('payment_gateways', 'supported_methods')) {
      const rows = await queryRunner.query(
        'SELECT id, supported_methods FROM payment_gateways WHERE supported_methods IS NOT NULL',
      );
      for (const row of rows) {
        let methods: string[] = [];
        try {
          methods = JSON.parse(row.supported_methods);
        } catch {
          methods = [];
        }
        for (let i = 0; i < methods.length; i++) {
          await queryRunner.query(
            'INSERT INTO payment_gateway_method (gateway_id, method_code, sort_order) VALUES (?, ?, ?)',
            [row.id, methods[i], i],
          );
        }
      }
      await queryRunner.query(
        'ALTER TABLE `payment_gateways` DROP COLUMN `supported_methods`',
      );
    }

    if (await hasColumn('rank_config', 'prizes')) {
      const rows = await queryRunner.query(
        'SELECT id, prizes FROM rank_config WHERE prizes IS NOT NULL',
      );
      for (const row of rows) {
        let prizes: Array<{ rank: number; prize: number }> = [];
        try {
          prizes = JSON.parse(row.prizes);
        } catch {
          prizes = [];
        }
        for (const p of prizes) {
          await queryRunner.query(
            'INSERT INTO rank_config_prize (rank_config_id, rank_position, prize_amount) VALUES (?, ?, ?)',
            [row.id, p.rank, p.prize],
          );
        }
      }
      await queryRunner.query('ALTER TABLE `rank_config` DROP COLUMN `prizes`');
    }

    if (await hasColumn('notification_templates', 'vars_json')) {
      await queryRunner.query(
        'ALTER TABLE `notification_templates` DROP COLUMN `vars_json`',
      );
    }
    if (await hasColumn('admin_users', 'permissions')) {
      await queryRunner.query(
        'ALTER TABLE `admin_users` DROP COLUMN `permissions`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `payment_gateways` ADD COLUMN `supported_methods` json DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `rank_config` ADD COLUMN `prizes` longtext DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `notification_templates` ADD COLUMN `vars_json` json DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `admin_users` ADD COLUMN `permissions` json DEFAULT NULL',
    );
    await queryRunner.query('DROP TABLE IF EXISTS `payment_gateway_method`');
    await queryRunner.query('DROP TABLE IF EXISTS `rank_config_prize`');
  }
}
