import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminUserAvatar1741050000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admin_users DROP COLUMN IF EXISTS avatar`,
    );
  }
}
