import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayChannelGatewayCode1739000000000 implements MigrationInterface {
  name = 'AddPayChannelGatewayCode1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SHOW COLUMNS FROM \`pay_channels\``,
    );
    const has = (field: string): boolean =>
      columns.some((column: { Field: string }) => column.Field === field);

    if (!has('gateway_code')) {
      await queryRunner.query(
        'ALTER TABLE `pay_channels` ADD COLUMN `gateway_code` varchar(50) NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `pay_channels` DROP COLUMN `gateway_code`',
    );
  }
}
