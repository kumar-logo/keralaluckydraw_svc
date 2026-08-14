import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPayChannels1739200000000 implements MigrationInterface {
  name = 'DropPayChannels1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`pay_channels\``);
  }

  public async down(): Promise<void> {
    return;
  }
}
