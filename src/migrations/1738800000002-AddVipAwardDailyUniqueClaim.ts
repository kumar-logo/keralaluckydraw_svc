import { MigrationInterface, QueryRunner } from 'typeorm';

interface CountRow {
  cnt: number;
}

export class AddVipAwardDailyUniqueClaim1738800000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND column_name = 'award_date'`,
    );
    if (Number(columnRows[0].cnt) === 0) {
      await queryRunner.query(
        `ALTER TABLE vip_awards
         ADD COLUMN award_date varchar(10) NOT NULL DEFAULT '' AFTER vip_level`,
      );
      await queryRunner.query(
        `UPDATE vip_awards
         SET award_date = DATE_FORMAT(created_at, '%Y-%m-%d')
         WHERE award_date = ''`,
      );
    }

    const oldIndexRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND index_name = 'uk_user_level'`,
    );
    if (Number(oldIndexRows[0].cnt) > 0) {
      await queryRunner.query(
        `ALTER TABLE vip_awards DROP INDEX uk_user_level`,
      );
    }

    const newIndexRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND index_name = 'uk_user_level_date'`,
    );
    if (Number(newIndexRows[0].cnt) === 0) {
      await queryRunner.query(
        `DELETE a1 FROM vip_awards a1
         INNER JOIN vip_awards a2
           ON a1.user_id = a2.user_id
          AND a1.vip_level = a2.vip_level
          AND a1.award_date = a2.award_date
          AND a1.id > a2.id`,
      );
      await queryRunner.query(
        `ALTER TABLE vip_awards
         ADD UNIQUE INDEX uk_user_level_date (user_id, vip_level, award_date)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const newIndexRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND index_name = 'uk_user_level_date'`,
    );
    if (Number(newIndexRows[0].cnt) > 0) {
      await queryRunner.query(
        `ALTER TABLE vip_awards DROP INDEX uk_user_level_date`,
      );
    }

    const oldIndexRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND index_name = 'uk_user_level'`,
    );
    if (Number(oldIndexRows[0].cnt) === 0) {
      await queryRunner.query(
        `ALTER TABLE vip_awards
         ADD UNIQUE INDEX uk_user_level (user_id, vip_level)`,
      );
    }

    const columnRows: CountRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'vip_awards'
         AND column_name = 'award_date'`,
    );
    if (Number(columnRows[0].cnt) > 0) {
      await queryRunner.query(`ALTER TABLE vip_awards DROP COLUMN award_date`);
    }
  }
}
