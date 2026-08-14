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

const decide = (orders: unknown[], oddsMap: Record<string, number>) =>
  engine().decide({
    gameType: 'four_five_digit',
    cfg: { family: 'digit5', digitCount: 5 } as never,
    mechanic: MECHANIC_BY_FAMILY.get('digit5'),
    orders: orders as never,
    oddsMap,
    mode: ResultMode.MaxProfit,
    houseEdgeTarget: 0.15,
    avoidBigPrize: false,
    avoidZeroOrder: false,
  } as never);

const firstBet = (digit: number, stake: number) => ({
  betType: 'first',
  betContent: { numbers: String(digit), betType: 'first' },
  totalAmount: stake,
  odds: 0,
  quantity: 1,
});

describe('aggregate(): every distinct bet selection must be scored', () => {
  it('REGRESSION: 10 different numbers are NOT collapsed into one group', async () => {
    const orders = Array.from({ length: 10 }, (_, d) =>
      firstBet(d, d === 3 ? 2 : 500),
    );
    const decision = await decide(orders, { first: 9 });

    expect(decision.totalStake).toBe(500 * 9 + 2);
    expect(decision.totalPayout).toBe(18);
    expect(
      String((decision.result as { number?: string }).number ?? '').charAt(0),
    ).toBe('3');
  });

  it('identical selections still merge so their stakes accumulate', async () => {
    const orders = [
      ...Array.from({ length: 10 }, (_, d) => firstBet(d, 100)),
      firstBet(7, 100),
    ];
    const decision = await decide(orders, { first: 2 });

    expect(decision.totalStake).toBe(1100);
    expect(decision.totalPayout).toBe(200);
    expect(
      String((decision.result as { number?: string }).number ?? '').charAt(0),
    ).not.toBe('7');
  });

  it('picks the single unbet number when one exists', async () => {
    const orders = Array.from({ length: 9 }, (_, d) => firstBet(d, 50));
    const decision = await decide(orders, { first: 9 });

    expect(decision.totalPayout).toBe(0);
    expect(
      String((decision.result as { number?: string }).number ?? '').charAt(0),
    ).toBe('9');
  });
});
