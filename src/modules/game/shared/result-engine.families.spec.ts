import { ResultEngineService } from './result-engine.service';
import { MECHANIC_BY_FAMILY } from './mechanics';
import { OddsService } from './odds.service';
import { ResultMode } from '../../../common/enums/result-mode.enum';

const loader = (sampleSize: number, budgetMs: number) => ({
  getOddsAliasMap: async () => ({}),
  getOddsMissingPolicy: async () => 'use_stored',
  getResultSampleSize: async () => sampleSize,
  getResultDecisionBudgetMs: async () => budgetMs,
  getResultModeDefault: async () => ResultMode.MaxProfit,
  getResultHouseEdgeDefault: async () => 0.15,
});

const engine = (sampleSize = 2000, budgetMs = 5000) =>
  new ResultEngineService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    new OddsService(),
    loader(sampleSize, budgetMs) as never,
  );

const decide = (
  gameType: string,
  family: string,
  cfg: unknown,
  orders: unknown[],
  oddsMap: Record<string, number>,
  sampleSize = 2000,
  budgetMs = 5000,
) =>
  engine(sampleSize, budgetMs).decide({
    gameType,
    cfg: cfg as never,
    mechanic: MECHANIC_BY_FAMILY.get(family),
    orders: orders as never,
    oddsMap,
    mode: ResultMode.MaxProfit,
    houseEdgeTarget: 0.15,
    avoidBigPrize: false,
    avoidZeroOrder: false,
  } as never);

const order = (betCode: string, stake: number) => ({
  betType: betCode,
  betContent: { betCode },
  totalAmount: stake,
  odds: 0,
  quantity: 1,
});

describe('DICE: candidate space is complete and the pick is the true minimum', () => {
  const cfg = { family: 'dice', diceCount: 3, diceFaces: 6, bigSmallThreshold: 10 };

  it('enumerates every distinguishable 3d6 outcome (56 sorted combinations)', () => {
    const cands = MECHANIC_BY_FAMILY.get('dice')!.enumerateCandidates!(cfg as never, {} as never);
    expect(cands).toHaveLength(56);
  });

  it('finds a zero-payout outcome when sums 3..10 are all bet (picks a big sum)', async () => {
    const orders = [3, 4, 5, 6, 7, 8, 9, 10].map((s) => order(`sum_${s}`, 100));
    const d = await decide('dice', 'dice', cfg, orders, { sum_3: 200 });
    expect(d.totalPayout).toBe(0);
  });

  it('when every sum is bet it picks the cheapest sum, weighing ALL orders', async () => {
    const orders = Array.from({ length: 16 }, (_, i) =>
      order(`sum_${i + 3}`, i + 3 === 11 ? 1 : 300),
    );
    const oddsMap: Record<string, number> = {};
    for (let s = 3; s <= 18; s += 1) oddsMap[`sum_${s}`] = 2;

    const d = await decide('dice', 'dice', cfg, orders, oddsMap);
    expect(d.totalPayout).toBe(2);
  });

  it('big AND small are both bet: engine finds the TRIPLE that voids both (payout 0)', async () => {
    const orders = [order('sum_big', 1000), order('sum_small', 5)];
    const d = await decide('dice', 'dice', cfg, orders, { sum_big: 2, sum_small: 2 });
    expect(d.totalPayout).toBe(0);
    const dice = (d.result as { dice: number[] }).dice;
    expect(new Set(dice).size).toBe(1);
  });

  it('no zero exists: compares triple(30) vs small(10) vs big(2000) and takes 10', async () => {
    const orders = [
      order('sum_big', 1000),
      order('sum_small', 5),
      order('leopard_any', 1),
    ];
    const d = await decide('dice', 'dice', cfg, orders, {
      sum_big: 2,
      sum_small: 2,
      leopard_any: 30,
    });
    expect(d.totalPayout).toBe(10);
    const dice = (d.result as { dice: number[] }).dice;
    expect(new Set(dice).size).toBeGreaterThan(1);
    expect(dice.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10);
  });

  it('triple bets are scored (leopard_any must not be invisible)', async () => {
    const orders = [order('leopard_any', 100)];
    const d = await decide('dice', 'dice', cfg, orders, { leopard_any: 30 });
    expect(d.totalPayout).toBe(0);
    const dice = (d.result as { dice: number[] }).dice;
    expect(new Set(dice).size).toBeGreaterThan(1);
  });
});

describe('RACE: candidate space is complete and the pick is the true minimum', () => {
  const cfg = { family: 'race', runnerCount: 6 };

  const championBet = (runner: number, stake: number) => ({
    betType: '1',
    betContent: { betType: 1, betNum: String(runner), numbers: String(runner) },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });

  it('enumerates every champion/second/third permutation (6*5*4 = 120)', () => {
    const cands = MECHANIC_BY_FAMILY.get('race')!.enumerateCandidates!(cfg as never, {} as never);
    expect(cands).toHaveLength(120);
  });

  it('picks the one unbacked runner as champion', async () => {
    const orders = [1, 2, 3, 4, 5].map((r) => championBet(r, 100));
    const d = await decide('race', 'race', cfg, orders, { champion: 5 });
    expect(d.totalPayout).toBe(0);
    expect((d.result as { positions: number[] }).positions[0]).toBe(6);
  });

  it('every runner backed: champion is the cheapest one, not a random one', async () => {
    const stakes: Record<number, number> = { 1: 500, 2: 500, 3: 7, 4: 500, 5: 500, 6: 500 };
    const orders = Object.entries(stakes).map(([r, s]) => championBet(Number(r), s));
    const d = await decide('race', 'race', cfg, orders, { champion: 5 });
    expect((d.result as { positions: number[] }).positions[0]).toBe(3);
    expect(d.totalPayout).toBe(35);
  });

  it('top3_any bets (class 4) are scored too, not just champion', async () => {
    const orders = [
      championBet(1, 10),
      { betType: '4', betContent: { betType: 4, betNum: '2' }, totalAmount: 1000, odds: 0, quantity: 1 },
    ];
    const d = await decide('race', 'race', cfg, orders, { champion: 5, top3_any: 2 });
    const pos = (d.result as { positions: number[] }).positions;
    expect(pos.slice(0, 3)).not.toContain(2);
    expect(d.totalPayout).toBeLessThanOrEqual(50);
  });
});

describe('DIGIT 3 (space 1000): full enumeration guarantees the optimum', () => {
  const cfg = { family: 'digit3', digitCount: 3 };

  it('enumerates the complete 1000-number space', () => {
    const cands = MECHANIC_BY_FAMILY.get('digit3')!.enumerateCandidates!(cfg as never, {} as never);
    expect(cands).toHaveLength(1000);
  });

  it('finds a zero-payout number even when 999 of 1000 are bet', async () => {
    const orders: unknown[] = [];
    for (let n = 0; n < 1000; n += 1) {
      if (n === 573) continue;
      orders.push({
        betType: 'exact3',
        betContent: { numbers: String(n).padStart(3, '0'), betType: 'exact3' },
        totalAmount: 1,
        odds: 0,
        quantity: 1,
      });
    }
    const d = await decide('three_digit', 'digit3', cfg, orders, { exact3: 900 }, 2000, 60000);
    expect(d.totalPayout).toBe(0);
    expect((d.result as { number: string }).number).toBe('573');
  });
});

describe('DIGIT 5 (space 100000): sampled — measure the real risk', () => {
  const cfg = { family: 'digit5', digitCount: 5 };

  const exact4 = (numbers: string, stake: number) => ({
    betType: 'exact4',
    betContent: { numbers, betType: 'exact4' },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });

  it('with a realistic round it still lands on zero payout every time (200 runs)', async () => {
    const orders = ['1712', '1710', '5423', '9643', '5789'].map((n) => exact4(n, 5));
    for (let i = 0; i < 200; i += 1) {
      const d = await decide('four_five_digit', 'digit5', cfg, orders, { exact4: 9000 });
      expect(d.totalPayout).toBe(0);
    }
  });

  it('sampling does NOT cover the space: candidate count is capped at sampleSize', () => {
    const cands = MECHANIC_BY_FAMILY.get('digit5')!.enumerateCandidates!(cfg as never, {
      sampleSize: 2000,
      targets: [],
    } as never);
    expect(cands.length).toBe(2000);
    expect(cands.length).toBeLessThan(100000);
  });

  it('BUSY ROUND: even 3000 distinct picks still lands on a free result', async () => {
    for (const distinct of [200, 1000, 3000]) {
      const orders = Array.from({ length: distinct }, (_, i) =>
        exact4(String(i % 10000).padStart(4, '0'), 5),
      );
      for (let run = 0; run < 10; run += 1) {
        const d = await decide(
          'four_five_digit', 'digit5', cfg, orders, { exact4: 9000 }, 2000, 30000,
        );
        expect(d.totalPayout).toBe(0);
      }
    }
  }, 300000);

  it('targets never consume the whole sample, so free candidates always exist', () => {
    const targets = Array.from({ length: 5000 }, (_, i) =>
      String(i).padStart(4, '0'),
    );
    const cands = MECHANIC_BY_FAMILY.get('digit5')!.enumerateCandidates!(
      cfg as never,
      { sampleSize: 2000, targets } as never,
    );
    const covered = new Set(targets);
    const free = cands.filter(
      (c) => !covered.has(String((c as { number: string }).number).slice(-4)),
    );
    const fromTargets = cands.length - free.length;
    expect(cands).toHaveLength(2000);
    expect(free.length).toBeGreaterThan(500);
    expect(fromTargets).toBeLessThan(1400);
  });

  it('SATURATED: covering the space cannot beat the house while odds < outcome count', async () => {
    const orders = Array.from({ length: 1000 }, (_, n) => ({
      betType: 'exact3',
      betContent: { numbers: String(n).padStart(3, '0'), betType: 'exact3' },
      totalAmount: 1, odds: 0, quantity: 1,
    }));
    const d = await decide(
      'three_digit', 'digit3', { family: 'digit3', digitCount: 3 }, orders,
      { exact3: 900 }, 2000, 60000,
    );
    expect(d.totalStake).toBe(1000);
    expect(d.totalPayout).toBe(900);
    expect(d.profitLoss).toBeGreaterThan(0);
  }, 120000);
});
