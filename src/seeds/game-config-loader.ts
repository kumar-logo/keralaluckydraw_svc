import { DataSource } from 'typeorm';
import { GameList } from '../entities/game-list.entity';
import { SlatMatchMode } from '../common/enums';

export interface SeedGameConfig {
  roundDuration?: number;
  stopBetBefore?: number;
  drawDelay?: number;
  autoGenerate?: boolean;
  scheduledDrawTime?: string | null;
  maxPrize?: string;
  digitCount?: number;
  quick?: { cycle?: number };
  cycle?: number;
  cycleSec?: number;
  themeColor?: string;
  isQuick?: boolean;
  imgId?: string;
  lobbyIcon?: string;
  payRate?: number;
  lobbySections?: string[];
  lobbyOrder?: Record<string, number>;
  runnerCount?: number;
  raceFrames?: number;
  ticketLength?: number;
  canInsurance?: boolean;
  insuranceRate?: number;
  prefix1st?: string;
  prefix2ndList?: string[];
  prizeCounts?: {
    second?: number;
    third?: number;
    fourth?: number;
    fifth?: number;
    consolation?: number;
  };
  drawTime?: string;
  prize?: {
    level?: number;
    prize?: string | number;
    intPrize?: number;
    tierName?: string;
    matchRule?: string;
    prizeLabel?: string;
    prizeValue?: number;
  }[];
  coinType?: number;
  freeCount?: number;
  iconImgID?: string;
  coverImgID?: string;
  iconUrl?: string;
  items?: {
    itemID?: number;
    name?: string;
    prize?: number;
    rate?: string | number;
    icon?: string;
    imgID?: string;
    link?: string;
  }[];
  itemCount?: number;
  multipleCount?: number;
  freeSpins?: number;
  segments?: {
    name?: string;
    prize?: number;
    weight?: number;
    odds?: number;
  }[];
  pickTimes?: { timeName?: string; drawTime?: string }[];
  pickInfos?: {
    pickInfoId?: number;
    pickLevel?: number;
    pickTitle?: string;
    pickAmount?: number;
    pickWinAmount?: number[];
  }[];
  gameType?: number;
  pick4Price?: number;
  pick4Prize?: { level?: number; prize?: number }[];
  pick5Price?: number;
  pick5Prize?: { level?: number; prize?: number }[];
  dailyRewards?: number[];
  colorPalette?: { colorKey?: string; hex?: string }[];
  numberColors?: { number?: number; colors?: string[] }[];
  raceRunners?: {
    name?: string;
    nameShort?: string;
    colorHex?: string;
    spriteKey?: string;
  }[];
  slatProducts?: {
    digitCount: number;
    price: number;
    matchMode: SlatMatchMode;
    title?: string;
    tiers: {
      label: string;
      positions: number[];
      winAmount: number;
      tierRank?: number;
    }[];
  }[];
}

export interface SeedRuleSection {
  title: string;
  content: string;
}

export type SeedGame = Partial<GameList> & {
  configJson?: SeedGameConfig;
  rulesJson?: SeedRuleSection[];
};

export function gameColumnsFromConfig(
  cfg: SeedGameConfig | undefined,
  isThirdParty: boolean,
): Partial<GameList> {
  const c = cfg || {};
  return {
    stopBetBeforeSec: c.stopBetBefore ?? 10,
    drawDelaySec: c.drawDelay ?? 0,
    autoGenerate: isThirdParty ? 0 : c.autoGenerate === false ? 0 : 1,
    lotteryType: c.autoGenerate === false ? 'manual' : 'auto',
    scheduledDrawTime: c.scheduledDrawTime
      ? new Date(c.scheduledDrawTime)
      : null,
    maxPrize: c.maxPrize,
    digitCount: c.digitCount,
    quickCycleSec: c.quick?.cycle ?? c.cycle,
    isQuick: c.isQuick ? 1 : 0,
    imgId: c.imgId,
    lobbyIconUrl: c.lobbyIcon,
    payRate: typeof c.payRate === 'number' ? c.payRate : undefined,
    resultMode: isThirdParty ? 'random' : 'max_profit',
  };
}

const DEFAULT_COLOR_PALETTE: { colorKey: string; hex: string }[] = [
  { colorKey: 'red', hex: '#be0000' },
  { colorKey: 'green', hex: '#109216' },
  { colorKey: 'violet', hex: '#670fbf' },
];

const DEFAULT_DICE_PALETTE: { colorKey: string; hex: string }[] = [
  { colorKey: 'small', hex: '#0090e2' },
  { colorKey: 'green', hex: '#02921b' },
  { colorKey: 'big', hex: '#e20000' },
  { colorKey: 'odd', hex: '#b91010' },
  { colorKey: 'even', hex: '#176be3' },
];

const DEFAULT_RACE_RUNNERS: {
  name: string;
  nameShort: string;
  colorHex: string;
  spriteKey: string;
}[] = [
  { name: 'Kerala', nameShort: 'KL', colorHex: '#00B92B', spriteKey: 'kerala' },
  {
    name: 'Tamil Nadu',
    nameShort: 'TN',
    colorHex: '#D80000',
    spriteKey: 'tamil',
  },
  {
    name: 'Madhya Pradesh',
    nameShort: 'MP',
    colorHex: '#F5D000',
    spriteKey: 'mp',
  },
  {
    name: 'Maharashtra',
    nameShort: 'MH',
    colorHex: '#DB7500',
    spriteKey: 'mh',
  },
  { name: 'Karnataka', nameShort: 'KA', colorHex: '#B800D0', spriteKey: 'ka' },
  { name: 'Nagaland', nameShort: 'NL', colorHex: '#0012D4', spriteKey: 'nl' },
];

const RACE_RUNNER_DEFAULT_COLOR = '#000000';

const DEFAULT_NUMBER_COLORS: { number: number; colors: string[] }[] = [
  { number: 0, colors: ['red', 'violet'] },
  { number: 1, colors: ['green'] },
  { number: 2, colors: ['red'] },
  { number: 3, colors: ['green'] },
  { number: 4, colors: ['red'] },
  { number: 5, colors: ['green', 'violet'] },
  { number: 6, colors: ['red'] },
  { number: 7, colors: ['green'] },
  { number: 8, colors: ['red'] },
  { number: 9, colors: ['green'] },
];

export async function insertGameChildConfig(
  ds: DataSource,
  gameId: number,
  gameType: string,
  cfg: SeedGameConfig | undefined,
  rules: SeedRuleSection[] | undefined,
): Promise<void> {
  const c = cfg || {};

  const sections = Array.isArray(c.lobbySections) ? c.lobbySections : [];
  const lobbyOrder = c.lobbyOrder || {};
  for (const section of sections) {
    await ds.query(
      `INSERT INTO game_lobby_placement (game_id, section, sort_order) VALUES (?, ?, ?)`,
      [gameId, section, Number(lobbyOrder[section]) || 0],
    );
  }

  if (c.runnerCount != null || c.raceFrames != null) {
    await ds.query(
      `INSERT INTO game_race_config (game_id, runner_count, race_frames) VALUES (?, ?, ?)`,
      [gameId, Number(c.runnerCount) || 6, Number(c.raceFrames) || 20],
    );
  }

  if (c.ticketLength != null || c.prefix1st != null || c.prizeCounts != null) {
    const pc = c.prizeCounts || {};
    await ds.query(
      `INSERT INTO game_kerala_config (game_id, ticket_length, can_insurance, insurance_rate, prefix_1st, second_count, third_count, fourth_count, fifth_count, consolation_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        Number(c.ticketLength) || 6,
        c.canInsurance ? 1 : 0,
        typeof c.insuranceRate === 'number' ? c.insuranceRate : 0.1,
        c.prefix1st ?? null,
        Number(pc.second) || 0,
        Number(pc.third) || 0,
        Number(pc.fourth) || 0,
        Number(pc.fifth) || 0,
        Number(pc.consolation) || 0,
      ],
    );
    const prefixes = Array.isArray(c.prefix2ndList) ? c.prefix2ndList : [];
    for (let i = 0; i < prefixes.length; i++) {
      await ds.query(
        `INSERT INTO game_number_prefix (game_id, prefix, sort_order) VALUES (?, ?, ?)`,
        [gameId, String(prefixes[i]), i],
      );
    }
  }

  if (gameType === 'punjab' && c.drawTime != null) {
    await ds.query(
      `INSERT INTO game_punjab_config (game_id, can_insurance, draw_time) VALUES (?, ?, ?)`,
      [gameId, c.canInsurance ? 1 : 0, c.drawTime ?? null],
    );
  }

  const prizeTiers = Array.isArray(c.prize) ? c.prize : [];
  for (let i = 0; i < prizeTiers.length; i++) {
    const tier = prizeTiers[i];
    await ds.query(
      `INSERT INTO game_prize_tier (game_id, level, tier_name, match_rule, prize_label, prize_value, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        Number(tier.level) || i + 1,
        tier.tierName ?? null,
        tier.matchRule ?? null,
        typeof tier.prize === 'string' ? tier.prize : (tier.prizeLabel ?? null),
        typeof tier.intPrize === 'number'
          ? tier.intPrize
          : Number(tier.prizeValue ?? tier.prize) || 0,
        i,
      ],
    );
  }

  if (gameType === 'mystery_box') {
    await ds.query(
      `INSERT INTO game_box_config (game_id, coin_type, free_count, icon_img_id, cover_img_id, icon_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        Number(c.coinType) || 1,
        Number(c.freeCount) || 0,
        c.iconImgID ?? null,
        c.coverImgID ?? null,
        c.iconUrl ?? null,
      ],
    );
    const items = Array.isArray(c.items) ? c.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await ds.query(
        `INSERT INTO game_box_item (game_id, item_id, name, prize, rate, icon_url, img_id, link_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          Number(it.itemID) || 0,
          String(it.name || ''),
          Number(it.prize) || 0,
          Number(it.rate) || 0,
          it.icon ?? null,
          it.imgID ?? null,
          it.link ?? null,
          i,
        ],
      );
    }
  }

  if (gameType === 'lucky_spin') {
    await ds.query(
      `INSERT INTO game_wheel_config (game_id, item_count, multiple_count, free_spins, cover_img_id) VALUES (?, ?, ?, ?, ?)`,
      [
        gameId,
        Number(c.itemCount) || 12,
        Number(c.multipleCount) || 30,
        Number(c.freeSpins) || 0,
        c.coverImgID ?? null,
      ],
    );
    const segments = Array.isArray(c.segments) ? c.segments : [];
    for (let i = 0; i < segments.length; i++) {
      const sg = segments[i];
      await ds.query(
        `INSERT INTO game_wheel_segment (game_id, name, prize, weight, odds, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          String(sg.name || ''),
          Number(sg.prize) || 0,
          Number(sg.weight) || 0,
          Number(sg.odds) || 0,
          i,
        ],
      );
    }
  }

  const pickTimes = Array.isArray(c.pickTimes) ? c.pickTimes : [];
  for (let i = 0; i < pickTimes.length; i++) {
    const pt = pickTimes[i];
    await ds.query(
      `INSERT INTO game_pick_time (game_id, time_name, draw_time, sort_order) VALUES (?, ?, ?, ?)`,
      [gameId, String(pt.timeName || ''), String(pt.drawTime || ''), i],
    );
  }

  const pickInfos = Array.isArray(c.pickInfos) ? c.pickInfos : [];
  for (let i = 0; i < pickInfos.length; i++) {
    const pi = pickInfos[i];
    const inserted: { insertId?: number } = await ds.query(
      `INSERT INTO game_pick_info (game_id, pick_info_id, pick_level, pick_title, pick_amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        Number(pi.pickInfoId) || i + 1,
        Number(pi.pickLevel) || i + 1,
        String(pi.pickTitle || ''),
        Number(pi.pickAmount) || 0,
        i,
      ],
    );
    const pickInfoRowId = inserted?.insertId;
    const winAmounts = Array.isArray(pi.pickWinAmount) ? pi.pickWinAmount : [];
    for (let j = 0; j < winAmounts.length; j++) {
      await ds.query(
        `INSERT INTO game_pick_win_amount (pick_info_id, sort_order, amount) VALUES (?, ?, ?)`,
        [pickInfoRowId, j, Number(winAmounts[j]) || 0],
      );
    }
  }

  if (gameType === 'four_five_digit') {
    await ds.query(
      `INSERT INTO game_pick4_config (game_id, pick_variant, pick4_price, pick5_price) VALUES (?, ?, ?, ?)`,
      [
        gameId,
        Number(c.gameType) || 1,
        Number(c.pick4Price) || 0,
        Number(c.pick5Price) || 0,
      ],
    );
    const p4 = Array.isArray(c.pick4Prize) ? c.pick4Prize : [];
    for (let i = 0; i < p4.length; i++) {
      await ds.query(
        `INSERT INTO game_pick_prize (game_id, variant, level, prize, sort_order) VALUES (?, 4, ?, ?, ?)`,
        [gameId, Number(p4[i]?.level) || i + 1, Number(p4[i]?.prize) || 0, i],
      );
    }
    const p5 = Array.isArray(c.pick5Prize) ? c.pick5Prize : [];
    for (let i = 0; i < p5.length; i++) {
      await ds.query(
        `INSERT INTO game_pick_prize (game_id, variant, level, prize, sort_order) VALUES (?, 5, ?, ?, ?)`,
        [gameId, Number(p5[i]?.level) || i + 1, Number(p5[i]?.prize) || 0, i],
      );
    }
  }

  const slatProducts = Array.isArray(c.slatProducts) ? c.slatProducts : [];
  for (let i = 0; i < slatProducts.length; i++) {
    const product = slatProducts[i];
    const inserted: { insertId?: number } = await ds.query(
      `INSERT INTO game_slat_product (game_id, digit_count, price, match_mode, title, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        gameId,
        Number(product.digitCount),
        Number(product.price),
        String(product.matchMode),
        String(product.title ?? ''),
        i,
      ],
    );
    const productId = inserted?.insertId;
    const tiers = Array.isArray(product.tiers) ? product.tiers : [];
    for (let j = 0; j < tiers.length; j++) {
      const tier = tiers[j];
      await ds.query(
        `INSERT INTO game_slat_tier (product_id, label, member_positions, win_amount, tier_rank, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          productId,
          String(tier.label),
          tier.positions.join(','),
          Number(tier.winAmount),
          Number(tier.tierRank) || 0,
          j,
        ],
      );
    }
  }

  const dailyRewards = Array.isArray(c.dailyRewards) ? c.dailyRewards : [];
  for (let i = 0; i < dailyRewards.length; i++) {
    await ds.query(
      `INSERT INTO game_daily_reward (game_id, sort_order, amount) VALUES (?, ?, ?)`,
      [gameId, i, Number(dailyRewards[i]) || 0],
    );
  }

  const ruleSections = Array.isArray(rules) ? rules : [];
  for (let i = 0; i < ruleSections.length; i++) {
    const rs = ruleSections[i];
    if (!rs.title && !rs.content) continue;
    await ds.query(
      `INSERT INTO game_rule_section (game_id, title, content, sort_order) VALUES (?, ?, ?, ?)`,
      [gameId, rs.title, rs.content, i],
    );
  }

  const colorPalette = Array.isArray(c.colorPalette)
    ? c.colorPalette
    : gameType === 'color'
      ? DEFAULT_COLOR_PALETTE
      : gameType === 'dice'
        ? DEFAULT_DICE_PALETTE
        : [];
  for (let i = 0; i < colorPalette.length; i++) {
    const cp = colorPalette[i];
    if (!cp.colorKey || !cp.hex) continue;
    await ds.query(
      `INSERT INTO game_color_palette (game_id, color_key, hex, sort_order) VALUES (?, ?, ?, ?)`,
      [gameId, String(cp.colorKey), String(cp.hex), i],
    );
  }

  const numberColors = Array.isArray(c.numberColors)
    ? c.numberColors
    : gameType === 'color'
      ? DEFAULT_NUMBER_COLORS
      : [];
  let numberColorOrder = 0;
  for (const nc of numberColors) {
    if (nc.number == null || !Array.isArray(nc.colors)) continue;
    for (const colorKey of nc.colors) {
      await ds.query(
        `INSERT INTO game_number_color (game_id, number, color_key, sort_order) VALUES (?, ?, ?, ?)`,
        [gameId, Number(nc.number), String(colorKey), numberColorOrder],
      );
      numberColorOrder += 1;
    }
  }

  const raceRunners = Array.isArray(c.raceRunners)
    ? c.raceRunners
    : gameType === 'race'
      ? DEFAULT_RACE_RUNNERS
      : [];
  for (let i = 0; i < raceRunners.length; i++) {
    const r = raceRunners[i];
    if (!r.name) continue;
    await ds.query(
      `INSERT INTO game_race_runner (game_id, name, name_short, color_hex, sprite_key, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        String(r.name),
        r.nameShort === undefined ? '' : r.nameShort,
        r.colorHex === undefined ? RACE_RUNNER_DEFAULT_COLOR : r.colorHex,
        r.spriteKey === undefined ? null : r.spriteKey,
        i,
      ],
    );
  }
}

export async function clearGameChildConfig(
  ds: DataSource,
  gameId: number,
): Promise<void> {
  const tables = [
    'game_lobby_placement',
    'game_race_config',
    'game_kerala_config',
    'game_number_prefix',
    'game_punjab_config',
    'game_prize_tier',
    'game_box_config',
    'game_box_item',
    'game_wheel_config',
    'game_wheel_segment',
    'game_pick_time',
    'game_pick_info',
    'game_pick_prize',
    'game_pick4_config',
    'game_daily_reward',
    'game_rule_section',
    'game_color_palette',
    'game_number_color',
    'game_race_runner',
  ];
  await ds.query(
    `DELETE t FROM game_slat_tier t INNER JOIN game_slat_product p ON t.product_id = p.id WHERE p.game_id = ?`,
    [gameId],
  );
  await ds.query(`DELETE FROM game_slat_product WHERE game_id = ?`, [gameId]);
  for (const table of tables) {
    await ds.query(`DELETE FROM \`${table}\` WHERE game_id = ?`, [gameId]);
  }
  await ds.query(
    `DELETE w FROM game_pick_win_amount w LEFT JOIN game_pick_info i ON w.pick_info_id = i.id WHERE i.id IS NULL`,
  );
}
