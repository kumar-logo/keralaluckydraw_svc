import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppVersions1741230000000 implements MigrationInterface {
  name = 'CreateAppVersions1741230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`app_versions\` (
         \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
         \`version\` varchar(200) NOT NULL,
         PRIMARY KEY (\`id\`)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    const rows: Array<{ c: number }> = await queryRunner.query(
      'SELECT COUNT(*) AS c FROM `app_versions`',
    );
    const count = rows.length > 0 ? Number(rows[0].c) : 0;
    if (count === 0) {
      await queryRunner.query(
        "INSERT INTO `app_versions` (`version`) VALUES ('1.0.4')",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_versions`');
  }
}
