import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankCardHolderAndBankName1736200000000 implements MigrationInterface {
  name = 'AddBankCardHolderAndBankName1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`SHOW COLUMNS FROM \`bank_cards\``);
    const hasColumn = (field: string): boolean =>
      columns.some((column: { Field: string }) => column.Field === field);

    if (!hasColumn('holder_name')) {
      await queryRunner.query(
        `ALTER TABLE \`bank_cards\` ADD COLUMN \`holder_name\` varchar(100) DEFAULT NULL AFTER \`card_name\``,
      );
    }

    if (!hasColumn('bank_name')) {
      await queryRunner.query(
        `ALTER TABLE \`bank_cards\` ADD COLUMN \`bank_name\` varchar(100) DEFAULT NULL AFTER \`holder_name\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`bank_cards\` DROP COLUMN \`bank_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`bank_cards\` DROP COLUMN \`holder_name\``,
    );
  }
}
