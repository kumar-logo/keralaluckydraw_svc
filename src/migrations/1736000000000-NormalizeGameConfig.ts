import { MigrationInterface, QueryRunner } from 'typeorm';

function parseJson(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch (err) {
      console.warn(
        `[NormalizeGameConfig] Failed to parse JSON config: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
  }
  return null;
}

function toInt(value: unknown, fallback: number | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export class NormalizeGameConfig1736000000000 implements MigrationInterface {
  name = 'NormalizeGameConfig1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        ADD COLUMN \`stop_bet_before_sec\` int NOT NULL DEFAULT 10 AFTER \`draw_interval\`,
        ADD COLUMN \`draw_delay_sec\` int NOT NULL DEFAULT 5 AFTER \`stop_bet_before_sec\`,
        ADD COLUMN \`auto_generate\` tinyint NOT NULL DEFAULT 1 AFTER \`draw_delay_sec\`,
        ADD COLUMN \`max_prize\` varchar(50) NULL AFTER \`auto_generate\`,
        ADD COLUMN \`digit_count\` int NULL AFTER \`max_prize\`,
        ADD COLUMN \`quick_cycle_sec\` int NULL AFTER \`digit_count\`,
        ADD COLUMN \`is_quick\` tinyint NOT NULL DEFAULT 0 AFTER \`quick_cycle_sec\`,
        ADD COLUMN \`img_id\` varchar(64) NULL AFTER \`is_quick\`,
        ADD COLUMN \`lobby_icon_url\` varchar(500) NULL AFTER \`img_id\`,
        ADD COLUMN \`pay_rate\` decimal(10,2) NULL AFTER \`lobby_icon_url\`,
        ADD COLUMN \`result_mode\` varchar(20) NOT NULL DEFAULT 'random' AFTER \`pay_rate\`,
        ADD COLUMN \`result_house_edge_target\` decimal(5,4) NULL AFTER \`result_mode\`,
        ADD COLUMN \`result_hold_for_approval\` tinyint NOT NULL DEFAULT 0 AFTER \`result_house_edge_target\`,
        ADD COLUMN \`result_avoid_big_prize\` tinyint NOT NULL DEFAULT 0 AFTER \`result_hold_for_approval\`,
        ADD COLUMN \`result_avoid_zero_order\` tinyint NOT NULL DEFAULT 0 AFTER \`result_avoid_big_prize\`
    `);

    await queryRunner.query(`
      CREATE TABLE \`game_race_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`runner_count\` int NOT NULL DEFAULT 6,
        \`race_frames\` int NOT NULL DEFAULT 20,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_kerala_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`ticket_length\` int NOT NULL DEFAULT 6,
        \`can_insurance\` tinyint NOT NULL DEFAULT 0,
        \`insurance_rate\` decimal(6,4) NOT NULL DEFAULT 0.1,
        \`prefix_1st\` varchar(8) NULL,
        \`second_count\` int NOT NULL DEFAULT 0,
        \`third_count\` int NOT NULL DEFAULT 0,
        \`fourth_count\` int NOT NULL DEFAULT 0,
        \`fifth_count\` int NOT NULL DEFAULT 0,
        \`consolation_count\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_punjab_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`can_insurance\` tinyint NOT NULL DEFAULT 0,
        \`draw_time\` varchar(20) NULL,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_box_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`coin_type\` int NOT NULL DEFAULT 1,
        \`free_count\` int NOT NULL DEFAULT 0,
        \`icon_img_id\` varchar(64) NULL,
        \`cover_img_id\` varchar(64) NULL,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_wheel_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`item_count\` int NOT NULL DEFAULT 12,
        \`multiple_count\` int NOT NULL DEFAULT 30,
        \`free_spins\` int NOT NULL DEFAULT 0,
        \`cover_img_id\` varchar(64) NULL,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_pick4_config\` (
        \`game_id\` int unsigned NOT NULL,
        \`pick_variant\` tinyint NOT NULL DEFAULT 1,
        \`pick4_price\` decimal(16,2) NOT NULL DEFAULT 0,
        \`pick5_price\` decimal(16,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_lobby_placement\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`section\` varchar(50) NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_game_section\` (\`game_id\`, \`section\`),
        KEY \`idx_lobby_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_number_prefix\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`prefix\` varchar(4) NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_prefix_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_prize_tier\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`level\` int NOT NULL,
        \`prize_label\` varchar(30) NULL,
        \`prize_value\` decimal(16,2) NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_prize_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_box_item\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`item_id\` int NOT NULL DEFAULT 0,
        \`name\` varchar(100) NOT NULL,
        \`prize\` decimal(16,2) NOT NULL DEFAULT 0,
        \`rate\` decimal(10,4) NOT NULL DEFAULT 0,
        \`icon_url\` varchar(500) NULL,
        \`img_id\` varchar(64) NULL,
        \`link_url\` varchar(500) NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_boxitem_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_wheel_segment\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`name\` varchar(20) NOT NULL,
        \`prize\` decimal(16,2) NOT NULL DEFAULT 0,
        \`weight\` int NOT NULL DEFAULT 0,
        \`odds\` decimal(10,2) NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_wheelseg_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_pick_time\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`time_name\` varchar(30) NOT NULL,
        \`draw_time\` varchar(20) NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_picktime_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_pick_info\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`pick_info_id\` int NOT NULL,
        \`pick_level\` int NOT NULL,
        \`pick_title\` varchar(50) NOT NULL,
        \`pick_amount\` int NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_pickinfo_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_pick_win_amount\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`pick_info_id\` int unsigned NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`amount\` decimal(16,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_pickwin_info\` (\`pick_info_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_pick_prize\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`variant\` tinyint NOT NULL,
        \`level\` int NOT NULL,
        \`prize\` decimal(16,2) NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_pickprize_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_daily_reward\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`amount\` decimal(16,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_daily_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`game_rule_section\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`game_id\` int unsigned NOT NULL,
        \`title\` varchar(100) NOT NULL,
        \`content\` text NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_rule_game\` (\`game_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.backfill(queryRunner);

    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        DROP COLUMN \`config_json\`,
        DROP COLUMN \`rules_json\`,
        DROP COLUMN \`ui_config_json\`,
        DROP COLUMN \`result_config_json\`,
        DROP COLUMN \`visibility_json\`
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS \`wheel_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`box_items\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`box_games\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`cashrain_config\``);
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    const rows: Record<string, unknown>[] = await queryRunner.query(
      `SELECT id, game_type, is_third_party, config_json, rules_json, result_config_json FROM game_list`,
    );

    for (const row of rows) {
      const gameId = row.id;
      const cfg = parseJson(row.config_json) || {};
      const resultCfg = parseJson(row.result_config_json) || {};
      const rules = parseJson(row.rules_json);

      const stopBet = toInt(cfg.stopBetBefore, 10);
      const drawDelay = toInt(cfg.drawDelay, 5);
      const autoGenerate =
        row.is_third_party === 1 ? 0 : cfg.autoGenerate === false ? 0 : 1;
      const maxPrize = typeof cfg.maxPrize === 'string' ? cfg.maxPrize : null;
      const digitCount = toInt(cfg.digitCount, null);
      const quick =
        cfg.quick !== null && typeof cfg.quick === 'object'
          ? (cfg.quick as Record<string, unknown>)
          : undefined;
      const quickCycle = toInt(quick?.cycle ?? cfg.cycle, null);
      const isQuick = cfg.isQuick === true ? 1 : 0;
      const imgId = typeof cfg.imgId === 'string' ? cfg.imgId : null;
      const lobbyIcon =
        typeof cfg.lobbyIcon === 'string' ? cfg.lobbyIcon : null;
      const payRate = typeof cfg.payRate === 'number' ? cfg.payRate : null;
      const seededMode =
        typeof resultCfg.resultMode === 'string' ? resultCfg.resultMode : '';
      const resultMode =
        row.is_third_party === 1
          ? 'random'
          : seededMode && seededMode !== 'random'
            ? seededMode
            : 'max_profit';
      const houseEdge =
        typeof resultCfg.houseEdgeTarget === 'number'
          ? resultCfg.houseEdgeTarget
          : null;
      const hold = resultCfg.holdForApproval === true ? 1 : 0;
      const avoidBig = resultCfg.avoidBigPrize === true ? 1 : 0;
      const avoidZero = resultCfg.avoidZeroOrder === true ? 1 : 0;

      await queryRunner.query(
        `UPDATE game_list SET stop_bet_before_sec=?, draw_delay_sec=?, auto_generate=?, max_prize=?, digit_count=?, quick_cycle_sec=?, is_quick=?, img_id=?, lobby_icon_url=?, pay_rate=?, result_mode=?, result_house_edge_target=?, result_hold_for_approval=?, result_avoid_big_prize=?, result_avoid_zero_order=? WHERE id=?`,
        [
          stopBet,
          drawDelay,
          autoGenerate,
          maxPrize,
          digitCount,
          quickCycle,
          isQuick,
          imgId,
          lobbyIcon,
          payRate,
          resultMode,
          houseEdge,
          hold,
          avoidBig,
          avoidZero,
          gameId,
        ],
      );

      const sections: string[] = Array.isArray(cfg.lobbySections)
        ? cfg.lobbySections
        : [];
      const lobbyOrder: Record<string, unknown> =
        cfg.lobbyOrder && typeof cfg.lobbyOrder === 'object'
          ? (cfg.lobbyOrder as Record<string, unknown>)
          : {};
      for (const section of sections) {
        if (typeof section !== 'string') continue;
        await queryRunner.query(
          `INSERT INTO game_lobby_placement (game_id, section, sort_order) VALUES (?, ?, ?)`,
          [gameId, section, toInt(lobbyOrder[section], 0)],
        );
      }

      if (cfg.runnerCount != null || cfg.raceFrames != null) {
        await queryRunner.query(
          `INSERT INTO game_race_config (game_id, runner_count, race_frames) VALUES (?, ?, ?)`,
          [gameId, toInt(cfg.runnerCount, 6), toInt(cfg.raceFrames, 20)],
        );
      }

      if (
        cfg.ticketLength != null ||
        cfg.prefix1st != null ||
        cfg.prizeCounts != null
      ) {
        const pc: Record<string, unknown> =
          cfg.prizeCounts && typeof cfg.prizeCounts === 'object'
            ? (cfg.prizeCounts as Record<string, unknown>)
            : {};
        await queryRunner.query(
          `INSERT INTO game_kerala_config (game_id, ticket_length, can_insurance, insurance_rate, prefix_1st, second_count, third_count, fourth_count, fifth_count, consolation_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            gameId,
            toInt(cfg.ticketLength, 6),
            cfg.canInsurance === true ? 1 : 0,
            typeof cfg.insuranceRate === 'number' ? cfg.insuranceRate : 0.1,
            typeof cfg.prefix1st === 'string' ? cfg.prefix1st : null,
            toInt(pc.second, 0),
            toInt(pc.third, 0),
            toInt(pc.fourth, 0),
            toInt(pc.fifth, 0),
            toInt(pc.consolation, 0),
          ],
        );
        const prefixes: string[] = Array.isArray(cfg.prefix2ndList)
          ? cfg.prefix2ndList
          : [];
        for (let i = 0; i < prefixes.length; i++) {
          await queryRunner.query(
            `INSERT INTO game_number_prefix (game_id, prefix, sort_order) VALUES (?, ?, ?)`,
            [gameId, String(prefixes[i]), i],
          );
        }
      }

      if (cfg.drawTime != null && row.game_type === 'pjb') {
        await queryRunner.query(
          `INSERT INTO game_punjab_config (game_id, can_insurance, draw_time) VALUES (?, ?, ?)`,
          [
            gameId,
            cfg.canInsurance === true ? 1 : 0,
            typeof cfg.drawTime === 'string' ? cfg.drawTime : null,
          ],
        );
      }

      const prizeTiers: Record<string, unknown>[] = Array.isArray(cfg.prize)
        ? cfg.prize
        : [];
      for (let i = 0; i < prizeTiers.length; i++) {
        const tier: Record<string, unknown> = prizeTiers[i] || {};
        await queryRunner.query(
          `INSERT INTO game_prize_tier (game_id, level, prize_label, prize_value, sort_order) VALUES (?, ?, ?, ?, ?)`,
          [
            gameId,
            toInt(tier.level, i + 1),
            typeof tier.prize === 'string' ? tier.prize : null,
            typeof tier.intPrize === 'number'
              ? tier.intPrize
              : Number(tier.prize) || 0,
            i,
          ],
        );
      }

      if (row.game_type === 'box') {
        await queryRunner.query(
          `INSERT INTO game_box_config (game_id, coin_type, free_count, icon_img_id, cover_img_id) VALUES (?, ?, ?, ?, ?)`,
          [
            gameId,
            toInt(cfg.coinType, 1),
            toInt(cfg.freeCount, 0),
            typeof cfg.iconImgID === 'string' ? cfg.iconImgID : null,
            typeof cfg.coverImgID === 'string' ? cfg.coverImgID : null,
          ],
        );
        const items: Record<string, unknown>[] = Array.isArray(cfg.items)
          ? cfg.items
          : [];
        for (let i = 0; i < items.length; i++) {
          const it: Record<string, unknown> = items[i] || {};
          await queryRunner.query(
            `INSERT INTO game_box_item (game_id, item_id, name, prize, rate, icon_url, img_id, link_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              gameId,
              toInt(it.itemID, 0),
              String(it.name || ''),
              Number(it.prize) || 0,
              Number(it.rate) || 0,
              typeof it.icon === 'string' ? it.icon : null,
              typeof it.imgID === 'string' ? it.imgID : null,
              typeof it.link === 'string' ? it.link : null,
              i,
            ],
          );
        }
      }

      if (row.game_type === 'wheel') {
        await queryRunner.query(
          `INSERT INTO game_wheel_config (game_id, item_count, multiple_count, free_spins, cover_img_id) VALUES (?, ?, ?, ?, ?)`,
          [
            gameId,
            toInt(cfg.itemCount, 12),
            toInt(cfg.multipleCount, 30),
            toInt(cfg.freeSpins, 0),
            typeof cfg.coverImgID === 'string' ? cfg.coverImgID : null,
          ],
        );
        const segments: Record<string, unknown>[] = Array.isArray(cfg.segments)
          ? cfg.segments
          : [];
        for (let i = 0; i < segments.length; i++) {
          const sg: Record<string, unknown> = segments[i] || {};
          await queryRunner.query(
            `INSERT INTO game_wheel_segment (game_id, name, prize, weight, odds, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              gameId,
              String(sg.name || ''),
              Number(sg.prize) || 0,
              toInt(sg.weight, 0),
              Number(sg.odds) || 0,
              i,
            ],
          );
        }
      }

      const pickTimes: Record<string, unknown>[] = Array.isArray(cfg.pickTimes)
        ? cfg.pickTimes
        : [];
      for (let i = 0; i < pickTimes.length; i++) {
        const pt: Record<string, unknown> = pickTimes[i] || {};
        await queryRunner.query(
          `INSERT INTO game_pick_time (game_id, time_name, draw_time, sort_order) VALUES (?, ?, ?, ?)`,
          [gameId, String(pt.timeName || ''), String(pt.drawTime || ''), i],
        );
      }

      const pickInfos: Record<string, unknown>[] = Array.isArray(cfg.pickInfos)
        ? cfg.pickInfos
        : [];
      for (let i = 0; i < pickInfos.length; i++) {
        const pi: Record<string, unknown> = pickInfos[i] || {};
        const inserted: { insertId?: number } = await queryRunner.query(
          `INSERT INTO game_pick_info (game_id, pick_info_id, pick_level, pick_title, pick_amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            gameId,
            toInt(pi.pickInfoId, i + 1),
            toInt(pi.pickLevel, i + 1),
            String(pi.pickTitle || ''),
            toInt(pi.pickAmount, 0),
            i,
          ],
        );
        const pickInfoRowId = inserted?.insertId;
        const winAmounts: unknown[] = Array.isArray(pi.pickWinAmount)
          ? pi.pickWinAmount
          : [];
        for (let j = 0; j < winAmounts.length; j++) {
          await queryRunner.query(
            `INSERT INTO game_pick_win_amount (pick_info_id, sort_order, amount) VALUES (?, ?, ?)`,
            [pickInfoRowId, j, Number(winAmounts[j]) || 0],
          );
        }
      }

      if (row.game_type === 'p4b') {
        await queryRunner.query(
          `INSERT INTO game_pick4_config (game_id, pick_variant, pick4_price, pick5_price) VALUES (?, ?, ?, ?)`,
          [
            gameId,
            toInt(cfg.gameType, 1),
            Number(cfg.pick4Price) || 0,
            Number(cfg.pick5Price) || 0,
          ],
        );
        const p4: Record<string, unknown>[] = Array.isArray(cfg.pick4Prize)
          ? cfg.pick4Prize
          : [];
        for (let i = 0; i < p4.length; i++) {
          await queryRunner.query(
            `INSERT INTO game_pick_prize (game_id, variant, level, prize, sort_order) VALUES (?, 4, ?, ?, ?)`,
            [gameId, toInt(p4[i]?.level, i + 1), Number(p4[i]?.prize) || 0, i],
          );
        }
        const p5: Record<string, unknown>[] = Array.isArray(cfg.pick5Prize)
          ? cfg.pick5Prize
          : [];
        for (let i = 0; i < p5.length; i++) {
          await queryRunner.query(
            `INSERT INTO game_pick_prize (game_id, variant, level, prize, sort_order) VALUES (?, 5, ?, ?, ?)`,
            [gameId, toInt(p5[i]?.level, i + 1), Number(p5[i]?.prize) || 0, i],
          );
        }
      }

      const dailyRewards: unknown[] = Array.isArray(cfg.dailyRewards)
        ? cfg.dailyRewards
        : [];
      for (let i = 0; i < dailyRewards.length; i++) {
        await queryRunner.query(
          `INSERT INTO game_daily_reward (game_id, sort_order, amount) VALUES (?, ?, ?)`,
          [gameId, i, Number(dailyRewards[i]) || 0],
        );
      }

      const ruleSections: Record<string, unknown>[] = Array.isArray(rules)
        ? rules
        : [];
      for (let i = 0; i < ruleSections.length; i++) {
        const rs: Record<string, unknown> = ruleSections[i] || {};
        if (!rs.title && !rs.content) continue;
        await queryRunner.query(
          `INSERT INTO game_rule_section (game_id, title, content, sort_order) VALUES (?, ?, ?, ?)`,
          [gameId, String(rs.title || ''), String(rs.content || ''), i],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        ADD COLUMN \`config_json\` json NULL,
        ADD COLUMN \`rules_json\` json NULL,
        ADD COLUMN \`ui_config_json\` json NULL,
        ADD COLUMN \`result_config_json\` json NULL,
        ADD COLUMN \`visibility_json\` json NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS \`game_rule_section\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_daily_reward\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_pick_prize\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_pick_win_amount\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_pick_info\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_pick_time\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_wheel_segment\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_box_item\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_prize_tier\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_number_prefix\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_lobby_placement\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_pick4_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_wheel_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_box_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_punjab_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_kerala_config\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`game_race_config\``);

    await queryRunner.query(`
      ALTER TABLE \`game_list\`
        DROP COLUMN \`result_avoid_zero_order\`,
        DROP COLUMN \`result_avoid_big_prize\`,
        DROP COLUMN \`result_hold_for_approval\`,
        DROP COLUMN \`result_house_edge_target\`,
        DROP COLUMN \`result_mode\`,
        DROP COLUMN \`pay_rate\`,
        DROP COLUMN \`lobby_icon_url\`,
        DROP COLUMN \`img_id\`,
        DROP COLUMN \`is_quick\`,
        DROP COLUMN \`quick_cycle_sec\`,
        DROP COLUMN \`digit_count\`,
        DROP COLUMN \`max_prize\`,
        DROP COLUMN \`auto_generate\`,
        DROP COLUMN \`draw_delay_sec\`,
        DROP COLUMN \`stop_bet_before_sec\`
    `);
  }
}
