import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedTransferStatusMap1741110000000 implements MigrationInterface {
  name = 'SeedTransferStatusMap1741110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`ui_status_map\` (\`domain\`, \`status\`, \`status_text\`, \`color\`)
      SELECT * FROM (
        SELECT 'transfer' AS domain, 1 AS status, 'Success' AS status_text, 'green' AS color
      ) AS seed
      WHERE NOT EXISTS (
        SELECT 1 FROM \`ui_status_map\`
        WHERE \`domain\` = 'transfer' AND \`status\` = 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`ui_status_map\` WHERE \`domain\` = 'transfer'`,
    );
  }
}
