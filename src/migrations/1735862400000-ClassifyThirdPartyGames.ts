import { MigrationInterface, QueryRunner } from 'typeorm';

const OUR_GAME_TYPES = [
  'clq',
  'dcq',
  'k3',
  'rnc',
  'brc',
  'p3o',
  'p3q',
  'p4b',
  'xo',
  'xq',
  'fived',
  'p1b',
  'dubai_p1b',
  'box',
  'wheel',
];

export class ClassifyThirdPartyGames1735862400000 implements MigrationInterface {
  name = 'ClassifyThirdPartyGames1735862400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const types = OUR_GAME_TYPES.map((t) => `'${t}'`).join(', ');
    await queryRunner.query(`UPDATE \`game_list\` SET \`is_third_party\` = 1`);
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_third_party\` = 0 WHERE \`is_lottery\` = 1 OR \`game_type\` IN (${types})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE \`game_list\` SET \`is_third_party\` = 0`);
  }
}
