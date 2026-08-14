import { MigrationInterface, QueryRunner } from 'typeorm';

const REMOVED_IN = `('state', 'state_quick', 'kerala_online', 'three_digit_quick')`;

const GAME_TYPE_TABLES = [
  'orders',
  'game_rounds',
  'game_odds_config',
  'result_decisions',
  'game_fee_config',
  'rebate_records',
  'share_configs',
  'agent_levels',
];

const CHILD_TABLES = [
  'game_kerala_config',
  'game_punjab_config',
  'game_race_config',
  'game_box_config',
  'game_wheel_config',
  'game_pick4_config',
  'game_lobby_placement',
  'game_number_prefix',
  'game_prize_tier',
  'game_box_item',
  'game_wheel_segment',
  'game_pick_time',
  'game_pick_info',
  'game_pick_win_amount',
  'game_pick_prize',
  'game_daily_reward',
  'game_rule_section',
];

interface IdRow {
  id: number;
}

export class RemoveDeprecatedLotteryTypes1738200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const games: IdRow[] = await queryRunner.query(
      `SELECT id FROM game_list WHERE game_type IN ${REMOVED_IN}`,
    );
    const ids = games.map((g) => Number(g.id)).filter((n) => !Number.isNaN(n));

    if (ids.length > 0) {
      const idIn = `(${ids.join(', ')})`;
      for (const table of CHILD_TABLES) {
        try {
          await queryRunner.query(
            `DELETE FROM ${table} WHERE game_id IN ${idIn}`,
          );
        } catch {
          continue;
        }
      }
    }

    for (const table of GAME_TYPE_TABLES) {
      try {
        await queryRunner.query(
          `DELETE FROM ${table} WHERE game_type IN ${REMOVED_IN}`,
        );
      } catch {
        continue;
      }
    }

    await queryRunner.query(
      `DELETE FROM game_list WHERE game_type IN ${REMOVED_IN}`,
    );
  }

  public async down(): Promise<void> {
    return;
  }
}
