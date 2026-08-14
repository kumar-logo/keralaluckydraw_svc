import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnusedTables1741030000000 implements MigrationInterface {
  private readonly tables = [
    'activity_done',
    'box_draw_history',
    'user_recent_games',
    'user_sessions',
    'status_enums',
    'bak_kerala_orders',
    'bak_kerala_rounds',
    'bak_kerala_ldd',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }

  public async down(): Promise<void> {
    return;
  }
}
