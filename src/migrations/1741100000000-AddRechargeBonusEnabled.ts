import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRechargeBonusEnabled1741100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'app_config'
         AND column_name = 'recharge_bonus_enabled'`,
    );
    if (Number(existing?.[0]?.c ?? 0) === 0) {
      await queryRunner.query(
        `ALTER TABLE app_config
           ADD COLUMN recharge_bonus_enabled TINYINT NOT NULL DEFAULT 1
           AFTER vip_enabled`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE app_config DROP COLUMN recharge_bonus_enabled`,
    );
  }
}
