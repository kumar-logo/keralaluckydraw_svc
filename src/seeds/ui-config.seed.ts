import { DataSource } from 'typeorm';
import { UiConfig } from '../entities/ui-config.entity';
import { UiColorMap } from '../entities/ui-color-map.entity';
import { UiStatusMap } from '../entities/ui-status-map.entity';
import { UiState } from '../entities/ui-state.entity';
import { UiPosition } from '../entities/ui-position.entity';
import { UiPayRate } from '../entities/ui-pay-rate.entity';
import { UiMysteryBoxGradient } from '../entities/ui-mystery-box-gradient.entity';
import { UiResultTab } from '../entities/ui-result-tab.entity';

const colorMap: Record<string, string[]> = {
  '0': ['red', 'violet'],
  '1': ['green'],
  '2': ['red'],
  '3': ['green'],
  '4': ['red'],
  '5': ['green', 'violet'],
  '6': ['red'],
  '7': ['green'],
  '8': ['red'],
  '9': ['green'],
};

const statusMaps: Record<
  string,
  Record<number, { text: string; color: string }>
> = {
  round: {
    0: { text: 'Betting Open', color: 'green' },
    1: { text: 'Betting Closed', color: 'orange' },
    2: { text: 'Settled', color: 'blue' },
    3: { text: 'Cancelled', color: 'default' },
  },
  order: {
    0: { text: 'Pending', color: 'orange' },
    1: { text: 'Won', color: 'green' },
    2: { text: 'Lost', color: 'default' },
    3: { text: 'Cancelled', color: 'red' },
    4: { text: 'Settled', color: 'blue' },
    5: { text: 'Refunded', color: 'purple' },
  },
  recharge: {
    0: { text: 'Pending', color: 'orange' },
    1: { text: 'Approved', color: 'green' },
    2: { text: 'Rejected', color: 'red' },
    3: { text: 'Cancelled', color: 'default' },
  },
  withdraw: {
    0: { text: 'Pending', color: 'orange' },
    1: { text: 'Approved', color: 'green' },
    2: { text: 'Rejected', color: 'red' },
  },
};

const stateNames = [
  'Kerala',
  'Tamil',
  'MadhyaPradesh',
  'Maharashtra',
  'Karnataka',
  'Nagaland',
];
const stateColors = [
  '#00B92B',
  '#D80000',
  '#F5D000',
  '#DB7500',
  '#B800D0',
  '#0012D4',
];
const positionColors = ['#D50000', '#0087D4', '#BD6600', '#008B59'];
const positionGradients = [
  ['#D50000', '#FF4E16'],
  ['#0087D4', '#00A2FF'],
  ['#BD6600', '#F58A27'],
  ['#008B59', '#008C59'],
];
const payRates = [
  { odds: 1.85, type: 4 },
  { odds: 5.4, type: 1 },
  { odds: 17, type: 5 },
];
const mysteryBoxGradients = [
  'linear-gradient(180deg, #FFB889 0%, #C34F02 100%)',
  'linear-gradient(180deg, #C4DBFF 0%, #5386D8 100%)',
  'linear-gradient(180deg, #E5BFF1 0%, #A356BB 100%)',
  'linear-gradient(180deg, #BFE7A7 0%, #599A31 100%)',
  'linear-gradient(180deg, #F6DB9B 0%, #CAA03C 100%)',
  'linear-gradient(180deg, #FBCFB4 0%, #C26930 100%)',
  'linear-gradient(180deg, #E9EDB6 0%, #9EA810 100%)',
  'linear-gradient(180deg, #F9C0C0 0%, #C13B3B 100%)',
];
const resultTabs = [
  { key: 'kerala', label: 'Kerala' },
  { key: 'dubai', label: 'Dubai' },
  { key: '3digit', label: '3Digits' },
  { key: '45d', label: '4D & 5D' },
  { key: 'color', label: 'WinGo' },
  { key: 'dice', label: 'K3' },
];

export async function seedUiConfig(ds: DataSource) {
  console.log('[UiConfig] Clearing existing ui config...');
  await ds.getRepository(UiResultTab).clear();
  await ds.getRepository(UiMysteryBoxGradient).clear();
  await ds.getRepository(UiPayRate).clear();
  await ds.getRepository(UiPosition).clear();
  await ds.getRepository(UiState).clear();
  await ds.getRepository(UiStatusMap).clear();
  await ds.getRepository(UiColorMap).clear();
  await ds.getRepository(UiConfig).clear();

  const cfg = ds.getRepository(UiConfig);
  await cfg.save(
    cfg.create({
      spriteScale: 0.75,
      catLottery: 1,
      catCasino: 5,
      catSlot: 6,
      catLobby: 1020,
      catLive: 1025,
      catFishing: 1026,
    }),
  );

  const cm = ds.getRepository(UiColorMap);
  const cmRows: UiColorMap[] = [];
  for (const [digit, colors] of Object.entries(colorMap)) {
    colors.forEach((color, i) =>
      cmRows.push(cm.create({ digit: Number(digit), color, sortOrder: i })),
    );
  }
  await cm.save(cmRows);

  const sm = ds.getRepository(UiStatusMap);
  const smRows: UiStatusMap[] = [];
  for (const [domain, statuses] of Object.entries(statusMaps)) {
    for (const [status, v] of Object.entries(statuses)) {
      smRows.push(
        sm.create({
          domain,
          status: Number(status),
          text: v.text,
          color: v.color,
        }),
      );
    }
  }
  await sm.save(smRows);

  const st = ds.getRepository(UiState);
  await st.save(
    stateNames.map((name, i) =>
      st.create({ sortOrder: i, name, color: stateColors[i] }),
    ),
  );

  const pos = ds.getRepository(UiPosition);
  await pos.save(
    positionColors.map((color, i) =>
      pos.create({
        sortOrder: i,
        color,
        gradientFrom: positionGradients[i][0],
        gradientTo: positionGradients[i][1],
      }),
    ),
  );

  const pr = ds.getRepository(UiPayRate);
  await pr.save(
    payRates.map((p, i) =>
      pr.create({ sortOrder: i, odds: p.odds, type: p.type }),
    ),
  );

  const mb = ds.getRepository(UiMysteryBoxGradient);
  await mb.save(
    mysteryBoxGradients.map((gradient, i) =>
      mb.create({ sortOrder: i, gradient }),
    ),
  );

  const rt = ds.getRepository(UiResultTab);
  await rt.save(
    resultTabs.map((t, i) =>
      rt.create({ sortOrder: i, key: t.key, label: t.label }),
    ),
  );

  console.log(
    `[UiConfig] config=1 colorMap=${cmRows.length} statusMap=${smRows.length} states=${stateNames.length} positions=${positionColors.length} payRates=${payRates.length} gradients=${mysteryBoxGradients.length} resultTabs=${resultTabs.length}`,
  );
}
