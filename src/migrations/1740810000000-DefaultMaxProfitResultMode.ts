import { MigrationInterface, QueryRunner } from 'typeorm';
import { ResultMode } from '../common/enums/result-mode.enum';

export class DefaultMaxProfitResultMode1740810000000 implements MigrationInterface {
  name = 'DefaultMaxProfitResultMode1740810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_config\`
         SET \`result_mode_default\` = ?
       WHERE \`result_mode_default\` = ?`,
      [ResultMode.MaxProfit, ResultMode.Random],
    );

    await queryRunner.query(
      `UPDATE \`game_list\`
         SET \`result_mode\` = ?
       WHERE (\`result_mode\` IS NULL OR \`result_mode\` = ?)
         AND \`auto_generate\` = 1`,
      [ResultMode.MaxProfit, ResultMode.Random],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_config\`
         SET \`result_mode_default\` = ?
       WHERE \`result_mode_default\` = ?`,
      [ResultMode.Random, ResultMode.MaxProfit],
    );

    await queryRunner.query(
      `UPDATE \`game_list\`
         SET \`result_mode\` = ?
       WHERE \`result_mode\` = ?
         AND \`auto_generate\` = 1`,
      [ResultMode.Random, ResultMode.MaxProfit],
    );
  }
}
