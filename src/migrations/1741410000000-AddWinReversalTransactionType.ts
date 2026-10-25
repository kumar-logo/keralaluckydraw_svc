import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWinReversalTransactionType1741410000000 implements MigrationInterface {
  name = 'AddWinReversalTransactionType1741410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO \`transaction_types\` (\`type_code\`, \`type_name\`, \`category\`, \`filter_group\`)
       SELECT 'win_reversal', 'Winning Reversal', 'expense', 'win' FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM \`transaction_types\` WHERE \`type_code\` = 'win_reversal')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`transaction_types\` WHERE \`type_code\` = 'win_reversal'`,
    );
  }
}
