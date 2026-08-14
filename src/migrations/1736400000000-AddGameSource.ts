import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameSource1736400000000 implements MigrationInterface {
  name = 'AddGameSource1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`SHOW COLUMNS FROM \`game_list\``);
    const hasColumn = (field: string): boolean =>
      columns.some((column: { Field: string }) => column.Field === field);

    if (!hasColumn('source')) {
      await queryRunner.query(
        `ALTER TABLE \`game_list\` ADD COLUMN \`source\` varchar(10) NOT NULL DEFAULT 'TK' AFTER \`category_id\``,
      );
      await queryRunner.query(
        `UPDATE \`game_list\` SET \`source\` = LEFT(\`provider\`, 10) WHERE \`is_third_party\` = 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`game_list\` DROP COLUMN \`source\``);
  }
}
