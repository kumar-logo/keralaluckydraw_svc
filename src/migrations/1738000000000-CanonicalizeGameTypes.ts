import { MigrationInterface, QueryRunner } from 'typeorm';

const GAME_TYPE_TABLES = [
  'game_list',
  'orders',
  'game_rounds',
  'game_odds_config',
  'result_decisions',
  'game_fee_config',
  'rebate_records',
  'share_configs',
  'agent_levels',
];

const CANONICAL_MAP: [string, string][] = [
  ['clq', 'color'],
  ['wingo', 'color'],
  ['dcq', 'dice'],
  ['k3', 'dice'],
  ['rnc', 'race'],
  ['box', 'mystery_box'],
  ['wheel', 'lucky_spin'],
  ['brc', 'cash_rain'],
  ['p3o', 'three_digit'],
  ['p3q', 'three_digit_quick'],
  ['p4b', 'four_five_digit'],
  ['fived', 'four_five_digit'],
  ['xo', 'state'],
  ['xq', 'state'],
  ['p1b', 'dubai'],
  ['dubai_p1b', 'dubai'],
  ['dbi', 'dubai'],
  ['kro', 'kerala'],
  ['krc', 'kerala_online'],
  ['pjb', 'punjab'],
];

const REVERSE_MAP: [string, string][] = [
  ['color', 'clq'],
  ['dice', 'dcq'],
  ['race', 'rnc'],
  ['mystery_box', 'box'],
  ['lucky_spin', 'wheel'],
  ['cash_rain', 'brc'],
  ['three_digit', 'p3o'],
  ['three_digit_quick', 'p3q'],
  ['four_five_digit', 'p4b'],
  ['state', 'xq'],
  ['dubai', 'p1b'],
  ['kerala', 'kro'],
  ['kerala_online', 'krc'],
  ['punjab', 'pjb'],
];

const CANONICAL_LOTTERY_TYPES = [
  'kerala',
  'kerala_online',
  'three_digit',
  'three_digit_quick',
  'four_five_digit',
  'state',
  'dubai',
  'punjab',
];

const CANONICAL_GAME_TYPES = [
  'color',
  'dice',
  'race',
  'mystery_box',
  'lucky_spin',
  'cash_rain',
];

const inList = (values: string[]) => values.map((v) => `'${v}'`).join(', ');

export class CanonicalizeGameTypes1738000000000 implements MigrationInterface {
  name = 'CanonicalizeGameTypes1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of GAME_TYPE_TABLES) {
      for (const [from, to] of CANONICAL_MAP) {
        await queryRunner.query(
          `UPDATE \`${table}\` SET \`game_type\` = ? WHERE \`game_type\` = ?`,
          [to, from],
        );
      }
    }

    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_lottery\` = 1 WHERE \`game_type\` IN (${inList(
        CANONICAL_LOTTERY_TYPES,
      )})`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_lottery\` = 0 WHERE \`game_type\` IN (${inList(
        CANONICAL_GAME_TYPES,
      )})`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_third_party\` = 0 WHERE \`is_lottery\` = 1 OR \`game_type\` IN (${inList(
        CANONICAL_GAME_TYPES,
      )})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of GAME_TYPE_TABLES) {
      for (const [from, to] of REVERSE_MAP) {
        await queryRunner.query(
          `UPDATE \`${table}\` SET \`game_type\` = ? WHERE \`game_type\` = ?`,
          [to, from],
        );
      }
    }

    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_lottery\` = 1 WHERE \`game_type\` IN ('kro', 'krc', 'pjb')`,
    );
    await queryRunner.query(
      `UPDATE \`game_list\` SET \`is_lottery\` = 0 WHERE \`game_type\` IN ('p3o', 'p3q', 'p4b', 'xq', 'p1b')`,
    );
  }
}
