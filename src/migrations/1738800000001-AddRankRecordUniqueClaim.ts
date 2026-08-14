import { MigrationInterface, QueryRunner } from 'typeorm';

interface IndexRow {
  cnt: number;
}

export class AddRankRecordUniqueClaim1738800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing: IndexRow[] = await queryRunner.query(
      `SELECT COUNT(1) AS cnt FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'rank_records'
         AND index_name = 'uniq_rank_user_round'`,
    );
    if (Number(existing[0].cnt) > 0) return;

    await queryRunner.query(
      `DELETE r1 FROM rank_records r1
       INNER JOIN rank_records r2
         ON r1.user_id = r2.user_id
        AND r1.rank_id = r2.rank_id
        AND r1.round_no = r2.round_no
        AND r1.id > r2.id`,
    );

    await queryRunner.query(
      `ALTER TABLE rank_records
       ADD UNIQUE INDEX uniq_rank_user_round (user_id, rank_id, round_no)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE rank_records DROP INDEX uniq_rank_user_round`,
    );
  }
}
