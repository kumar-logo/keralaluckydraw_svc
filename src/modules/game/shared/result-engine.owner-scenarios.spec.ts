import { ResultEngineService } from './result-engine.service';
import { MECHANIC_BY_FAMILY } from './mechanics';
import { OddsService } from './odds.service';
import { ResultMode } from '../../../common/enums/result-mode.enum';

const configLoader = {
  getOddsAliasMap: async () => ({}),
  getOddsMissingPolicy: async () => 'use_stored',
  getResultSampleSize: async () => 2000,
  getResultDecisionBudgetMs: async () => 5000,
  getResultModeDefault: async () => ResultMode.MaxProfit,
  getResultHouseEdgeDefault: async () => 0.15,
};

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
    configLoader as never,
  );

const COLOR_CFG = {
  family: 'color',
  numberRange: [1, 7],
  bigSmallThreshold: 5,
  colorMap: {},
} as never;

const bet = (code: string, stake: number) => ({
  betType: code,
  betContent: { betCode: code },
  totalAmount: stake,
  odds: 0,
  quantity: 1,
});

const decideColor = (orders: unknown[], oddsMap: Record<string, number>) =>
  engine().decide({
    gameType: 'color',
    cfg: COLOR_CFG,
    mechanic: MECHANIC_BY_FAMILY.get('color'),
    orders: orders as never,
    oddsMap,
    mode: ResultMode.MaxProfit,
    houseEdgeTarget: 0.15,
    avoidBigPrize: false,
    avoidZeroOrder: false,
  } as never);

const chosen = (d: { result: unknown }) => Number((d.result as { number: number }).number);

describe("owner scenario: bets on 1..6 in a 1..7 space", () => {
  it('picks the ONE unbet number 7 and pays nothing', async () => {
    const orders = [1, 2, 3, 4, 5, 6].map((n) => bet(String(n), 100));
    const d = await decideColor(orders, { number: 9 });

    expect(chosen(d)).toBe(7);
    expect(d.totalPayout).toBe(0);
    expect(d.totalStake).toBe(600);
    expect(d.profitLoss).toBe(600);
  });

  it('HARDER: 7 is unbet as a number but a big-stake "big" bet also wins on 7 — must pick the genuinely cheapest, NOT merely the unbet one', async () => {
    const orders = [
      ...[1, 2, 3, 4, 5, 6].map((n) => bet(String(n), 1)),
      bet('big', 1000),
    ];
    const d = await decideColor(orders, { number: 9, big: 2, small: 2 });

    // 6 -> number(9) + big(2000) = 2009 ; 7 -> big(2000) ; 1..5 -> number(9) only
    expect(d.totalPayout).toBe(9);
    expect(chosen(d)).toBeLessThanOrEqual(5);
    expect(chosen(d)).not.toBe(7);
    expect(d.profitLoss).toBe(1006 - 9);
  });

  it('every number is bet: picks the minimum-loss number, considering ALL orders', async () => {
    const stakes: Record<number, number> = {
      1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 1,
    };
    const orders = Object.entries(stakes).map(([n, s]) => bet(n, s));
    const d = await decideColor(orders, { number: 9 });

    expect(chosen(d)).toBe(7);
    expect(d.totalPayout).toBe(9);
    expect(d.reason).toBe(ResultMode.MaxProfit);
  });

  it('when even the best outcome loses money it still picks the smallest loss and flags forced_min_loss', async () => {
    const orders = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      bet(String(n), n === 4 ? 10 : 500),
    );
    const d = await decideColor(orders, { number: 9 });

    expect(chosen(d)).toBe(4);
    expect(d.totalPayout).toBe(90);
    expect(d.totalStake).toBe(500 * 6 + 10);
    expect(d.profitLoss).toBeGreaterThan(0);
  });

  it('a true forced loss reports forced_min_loss', async () => {
    const orders = [1, 2, 3, 4, 5, 6, 7].map((n) => bet(String(n), 10));
    const d = await decideColor(orders, { number: 50 });

    expect(d.totalStake).toBe(70);
    expect(d.totalPayout).toBe(500);
    expect(d.profitLoss).toBeLessThan(0);
    expect(d.reason).toBe('forced_min_loss');
  });

  it('multiple orders on the SAME number accumulate and shift the optimum', async () => {
    const orders = [
      bet('1', 10),
      bet('1', 10),
      bet('1', 10),
      bet('2', 25),
      ...[3, 4, 5, 6, 7].map((n) => bet(String(n), 40)),
    ];
    const d = await decideColor(orders, { number: 9 });

    // 1 -> 30*9=270 ; 2 -> 25*9=225 ; others -> 40*9=360
    expect(chosen(d)).toBe(2);
    expect(d.totalPayout).toBe(225);
  });

  it('mixed bet types are all counted, not just the numeric ones', async () => {
    const orders = [
      bet('big', 100),
      bet('small', 100),
      bet('3', 5),
    ];
    const d = await decideColor(orders, { number: 9, big: 2, small: 2 });

    expect(d.totalPayout).toBe(200);
    expect(chosen(d)).not.toBe(3);
  });
});
