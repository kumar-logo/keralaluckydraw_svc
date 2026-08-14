import { MigrationInterface, QueryRunner } from 'typeorm';
import { ResultMode } from '../common/enums/result-mode.enum';

export class DefaultLowestRiskResultMode1740820000000 implements MigrationInterface {
  name = 'DefaultLowestRiskResultMode1740820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_config\`
         SET \`result_mode_default\` = ?
       WHERE \`result_mode_default\` = ?`,
      [ResultMode.LowestRisk, ResultMode.MaxProfit],
    );

    await queryRunner.query(
      `UPDATE \`game_list\`
         SET \`result_mode\` = ?
       WHERE \`result_mode\` = ?
         AND \`auto_generate\` = 1`,
      [ResultMode.LowestRisk, ResultMode.MaxProfit],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`app_config\`
         SET \`result_mode_default\` = ?
       WHERE \`result_mode_default\` = ?`,
      [ResultMode.MaxProfit, ResultMode.LowestRisk],
    );

    await queryRunner.query(
      `UPDATE \`game_list\`
         SET \`result_mode\` = ?
       WHERE \`result_mode\` = ?
         AND \`auto_generate\` = 1`,
      [ResultMode.MaxProfit, ResultMode.LowestRisk],
    );
  }
}
