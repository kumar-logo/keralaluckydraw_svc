import { ResultEngineService } from './result-engine.service';
import { MECHANIC_BY_FAMILY } from './mechanics';
import { OddsService } from './odds.service';
import { ResultMode } from '../../../common/enums/result-mode.enum';
import { SlatMatchMode } from '../../../common/enums';

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
      getResultDecisionBudgetMs: async () => 30000,
      getResultModeDefault: async () => ResultMode.MaxProfit,
      getResultHouseEdgeDefault: async () => 0.15,
    } as never,
  );

const decide = (
  gameType: string,
  family: string,
  cfg: unknown,
  orders: unknown[],
  oddsMap: Record<string, number>,
) =>
  engine().decide({
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

describe('DIGIT5 through the REAL engine: covering portfolios cannot beat the house', () => {
  const cfg = { family: 'digit5', digitCount: 5 };
  const bet = (code: string, stake: number, numbers?: string) => ({
    betType: code,
    betContent: numbers === undefined ? { betCode: code } : { numbers, betType: code },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });

  it('big+small covers every outcome: Sum(1/odds)=1.0 -> house is break-even, never negative', async () => {
    const d = await decide('four_five_digit', 'digit5',
      cfg, [bet('big', 1000), bet('small', 1000)], { big: 2, small: 2 });
    expect(d.totalStake).toBe(2000);
    expect(d.totalPayout).toBe(2000);
    expect(d.profitLoss).toBe(0);
  });

  it('odd+even covers every outcome: also exactly break-even, never a loss', async () => {
    const d = await decide('four_five_digit', 'digit5',
      cfg, [bet('odd', 500), bet('even', 500)], { odd: 2, even: 2 });
    expect(d.totalPayout).toBe(1000);
    expect(d.profitLoss).toBe(0);
  });

  it('all 10 first-digits bet at odds 9: Sum(1/odds)=10/9 -> house keeps a real edge', async () => {
    const orders = Array.from({ length: 10 }, (_, dgt) => bet('first1', 100, String(dgt)));
    const d = await decide('four_five_digit', 'digit5', cfg, orders, { first1: 9 });
    expect(d.totalStake).toBe(1000);
    expect(d.totalPayout).toBe(900);
    expect(d.profitLoss).toBe(100);
  });

  it("user's example generalised: first-digit 0..8 bet, 9 left free -> engine draws a 9xxxx and pays 0", async () => {
    const orders = Array.from({ length: 9 }, (_, dgt) => bet('first1', 100, String(dgt)));
    const d = await decide('four_five_digit', 'digit5', cfg, orders, { first1: 9 });
    expect(d.totalPayout).toBe(0);
    expect(String((d.result as { number: string }).number).charAt(0)).toBe('9');
  });

  it('THE Rs.42,750 ROUND: 5 distinct exact4 suffixes, engine finds a clean number and pays 0', async () => {
    const orders = ['1712', '1710', '5423', '9643', '5789'].map((n) => bet('exact4', 5, n));
    for (let i = 0; i < 50; i += 1) {
      const d = await decide('four_five_digit', 'digit5', cfg, orders, { exact4: 9000 });
      expect(d.totalPayout).toBe(0);
    }
  });

  it('exact4 at 90% coverage (9000 of 10000 suffixes): sampler still finds a free number, pays 0', async () => {
    const orders: unknown[] = [];
    for (let s = 0; s < 9000; s += 1) {
      orders.push(bet('exact4', 1, String(s).padStart(4, '0')));
    }
    const d = await decide('four_five_digit', 'digit5', cfg, orders, { exact4: 9000 });
    expect(d.totalPayout).toBe(0);
  });

  it('KNOWN SAMPLING BOUNDARY: at 9999/10000 the free set is ~10 of 100000 numbers; 2000-sampling can miss it and the engine takes the minimum available loss (never a crash, never worse than one hit)', async () => {
    const orders: unknown[] = [];
    for (let s = 0; s < 10000; s += 1) {
      if (s === 7777) continue;
      orders.push(bet('exact4', 1, String(s).padStart(4, '0')));
    }
    const d = await decide('four_five_digit', 'digit5', cfg, orders, { exact4: 9000 });
    expect([0, 9000]).toContain(d.totalPayout);
    expect(d.totalWinners).toBeLessThanOrEqual(1);
    // The zero-loss guarantee survives the sampling miss: exact4 odds (9000)
    // are below the 10000-outcome space, so even the worst forced hit costs
    // 9000 against a 9999 stake -> the HOUSE STILL PROFITS.
    expect(d.profitLoss).toBeGreaterThan(0);
  });

  it('ZERO-LOSS INVARIANT for the sampled space: because odds < outcome-count, no exact4 round can ever go negative, sampled or not', async () => {
    // Full saturation: every one of the 10000 suffixes bet.
    const orders = Array.from({ length: 10000 }, (_, s) =>
      bet('exact4', 1, String(s).padStart(4, '0')),
    );
    const d = await decide('four_five_digit', 'digit5', cfg, orders, { exact4: 9000 });
    expect(d.totalStake).toBe(10000);
    expect(d.totalPayout).toBe(9000);
    expect(d.profitLoss).toBe(1000);
  });
});

describe('DUBAI (single_digit) through the REAL engine: the literal 1..6-in-1..7 example', () => {
  const cfg = { family: 'single_digit', numberRange: [1, 7] };
  const numBet = (n: number, stake: number) => ({
    betType: String(n),
    betContent: { betNum: String(n) },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });
  const odds: Record<string, number> = {};
  for (let n = 1; n <= 36; n += 1) odds[`number_${n}`] = 30;

  it('bet 1..6, range 1..7: engine draws 7 and pays nothing', async () => {
    const orders = [1, 2, 3, 4, 5, 6].map((n) => numBet(n, 100));
    const d = await decide('dubai', 'single_digit', cfg, orders, odds);
    expect(Number((d.result as { number: number }).number)).toBe(7);
    expect(d.totalPayout).toBe(0);
  });

  it('every number 1..7 bet, one cheap: engine picks the cheapest, weighing ALL orders', async () => {
    const stakes: Record<number, number> = { 1: 100, 2: 100, 3: 100, 4: 5, 5: 100, 6: 100, 7: 100 };
    const orders = Object.entries(stakes).map(([n, s]) => numBet(Number(n), s));
    const d = await decide('dubai', 'single_digit', cfg, orders, odds);
    expect(Number((d.result as { number: number }).number)).toBe(4);
    expect(d.totalPayout).toBe(150);
  });

  it('live-shaped range 1..36 with 1..35 bet: engine draws 36 and pays 0', async () => {
    const wide = { family: 'single_digit', numberRange: [1, 36] };
    const orders = Array.from({ length: 35 }, (_, i) => numBet(i + 1, 10));
    const d = await decide('dubai', 'single_digit', wide, orders, odds);
    expect(Number((d.result as { number: number }).number)).toBe(36);
    expect(d.totalPayout).toBe(0);
  });
});

describe('SLAT (fixed-prize) through the REAL engine: unmatched slat = 0, saturated = lowest fixed loss', () => {
  const product = {
    id: 1,
    digitCount: 3,
    price: 11,
    matchMode: SlatMatchMode.Group,
    title: 'Slat-1D',
    status: 1,
    tiers: [
      { label: 'A', positions: [0], winAmount: 1000, tierRank: 0 },
      { label: 'B', positions: [1], winAmount: 1000, tierRank: 0 },
      { label: 'C', positions: [2], winAmount: 1000, tierRank: 0 },
    ],
  };
  const cfg = { family: 'digit3', digitCount: 3, slatProducts: [product] };
  const slatBet = (label: string, pos: number[], digit: string, stake: number) => ({
    betType: label,
    betContent: { slatProductId: 1, betType: label, numbers: digit, positions: pos },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });

  it('slat A on digits 0..8 at position 0, 9 left free: engine draws 9xx so no slat matches -> pays 0', async () => {
    const orders = Array.from({ length: 9 }, (_, dgt) => slatBet('A', [0], String(dgt), 11));
    const d = await decide('three_digit', 'digit3', cfg, orders, {});
    expect(d.totalPayout).toBe(0);
    expect(String((d.result as { number: string }).number).charAt(0)).toBe('9');
  });

  it('slat A on ALL 10 digits at position 0: no free result exists -> engine takes the single fixed 1000 loss, not more', async () => {
    const orders = Array.from({ length: 10 }, (_, dgt) => slatBet('A', [0], String(dgt), 11));
    const d = await decide('three_digit', 'digit3', cfg, orders, {});
    expect(d.totalStake).toBe(110);
    expect(d.totalPayout).toBe(1000);
    expect(d.reason).toBe('forced_min_loss');
  });

  it('mixed slat A+B+C, one gap in A: engine steers to the gap so only the unavoidable groups pay', async () => {
    const orders = [
      ...Array.from({ length: 9 }, (_, dgt) => slatBet('A', [0], String(dgt), 11)),
    ];
    const d = await decide('three_digit', 'digit3', cfg, orders, {});
    expect(d.totalPayout).toBe(0);
  });
});

describe('KERALA lottery through the REAL engine: a draw whose prizes miss every ticket pays 0', () => {
  const cfg = {
    family: 'lottery',
    ticketLength: 6,
    prizeCounts: { third: 2, fourth: 10, fifth: 10, consolation: 10 },
    prizeMatchRules: { first: 100000, second: 50000, last4: 5000 },
  };
  const ticket = (code: string, stake: number) => ({
    betType: 'ticket',
    betContent: { numbers: code },
    totalAmount: stake,
    odds: 0,
    quantity: 1,
  });

  it('a handful of tickets: engine finds a draw where none win -> payout 0', async () => {
    const orders = ['123456', '234567', '345678'].map((c) => ticket(c, 10));
    for (let i = 0; i < 20; i += 1) {
      const d = await decide('kerala', 'lottery', cfg, orders, {});
      expect(d.totalPayout).toBe(0);
    }
  });
});
