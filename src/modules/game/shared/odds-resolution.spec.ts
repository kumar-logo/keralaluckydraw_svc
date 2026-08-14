import { OddsService } from './odds.service';
import { ResultEngineService } from './result-engine.service';
import { MECHANIC_BY_FAMILY } from './mechanics';
import { ResultMode } from '../../../common/enums/result-mode.enum';

const svc = new OddsService();

const COLOR_ODDS: Record<string, number> = {
  green: 2,
  red: 2,
  violet: 4.5,
  green_violet: 1.5,
  red_violet: 1.5,
  big: 2,
  small: 2,
  number: 9,
};

describe('OddsService: the mechanic-supplied oddsKey must win over the raw betCode', () => {
  it('green landing on a violet number pays the 1.5 overlap, not the flat 2.0', () => {
    const r = svc.resolve({
      oddsMap: COLOR_ODDS,
      betCode: 'green',
      oddsKey: 'green_violet',
      storedOdds: 0,
    });
    expect(r.odds).toBe(1.5);
    expect(r.source).toBe('config');
  });

  it('red landing on a violet number pays 1.5', () => {
    expect(
      svc.resolve({
        oddsMap: COLOR_ODDS,
        betCode: 'red',
        oddsKey: 'red_violet',
        storedOdds: 0,
      }).odds,
    ).toBe(1.5);
  });

  it('green on a non-violet number still pays the flat 2.0', () => {
    expect(
      svc.resolve({
        oddsMap: COLOR_ODDS,
        betCode: 'green',
        oddsKey: 'green',
        storedOdds: 0,
      }).odds,
    ).toBe(2);
  });

  it('NO REGRESSION: families whose oddsKey equals the betCode are unchanged', () => {
    const cases: [string, string, Record<string, number>, number][] = [
      ['sum_big', 'sum_big', { sum_big: 1.95 }, 1.95],
      ['exact4', 'exact4', { exact4: 9000 }, 9000],
      ['leopard_any', 'leopard_any', { leopard_any: 24 }, 24],
    ];
    for (const [betCode, oddsKey, map, want] of cases) {
      expect(svc.resolve({ oddsMap: map, betCode, oddsKey, storedOdds: 0 }).odds).toBe(want);
    }
  });

  it('NO REGRESSION: race resolves by class when the betCode is a runner number', () => {
    expect(
      svc.resolve({
        oddsMap: { champion: 5.4, top3_fixed: 100 },
        betCode: '2',
        oddsKey: 'champion',
        storedOdds: 0,
      }).odds,
    ).toBe(5.4);
  });

  it('NO REGRESSION: single-digit resolves the specific number_N key', () => {
    expect(
      svc.resolve({
        oddsMap: { number_7: 30 },
        betCode: '7',
        oddsKey: 'number_7',
        storedOdds: 0,
      }).odds,
    ).toBe(30);
  });

  it('falls back to the betCode when the oddsKey has no configured row', () => {
    expect(
      svc.resolve({
        oddsMap: { green: 2 },
        betCode: 'green',
        oddsKey: 'green_violet',
        storedOdds: 0,
      }).odds,
    ).toBe(2);
  });
});

const engine = () =>
  new ResultEngineService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    new OddsService(),
    {
      getOddsAliasMap: async () => ({}),
      getOddsMissingPolicy: async () => 'use_stored',
      getResultSampleSize: async () => 2000,
      getResultDecisionBudgetMs: async () => 5000,
      getResultModeDefault: async () => ResultMode.MaxProfit,
      getResultHouseEdgeDefault: async () => 0.15,
    } as never,
  );

describe('the green+red hedge must no longer be break-even for the house', () => {
  const cfg = {
    family: 'color',
    numberRange: [0, 9],
    bigSmallThreshold: 5,
    colorMap: {
      0: ['red', 'violet'],
      1: ['green'],
      2: ['red'],
      3: ['green'],
      4: ['red'],
      5: ['green', 'violet'],
      6: ['red'],
      7: ['green'],
      8: ['red'],
      9: ['green'],
    },
  };

  it('steers to a violet number so the hedge costs 1500 instead of 2000', async () => {
    const hedge = ['green', 'red'].map((code) => ({
      betType: code,
      betContent: { betCode: code },
      totalAmount: 1000,
      odds: 0,
      quantity: 1,
    }));

    const d = await engine().decide({
      gameType: 'color',
      cfg: cfg as never,
      mechanic: MECHANIC_BY_FAMILY.get('color'),
      orders: hedge as never,
      oddsMap: COLOR_ODDS,
      mode: ResultMode.MaxProfit,
      houseEdgeTarget: 0.15,
      avoidBigPrize: false,
      avoidZeroOrder: false,
    } as never);

    expect(d.totalStake).toBe(2000);
    expect(d.totalPayout).toBe(1500);
    expect(d.profitLoss).toBe(500);
    expect([0, 5]).toContain(Number((d.result as { number: number }).number));
  });
});
