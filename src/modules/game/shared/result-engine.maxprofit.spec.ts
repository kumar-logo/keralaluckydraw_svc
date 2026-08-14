import { ResultEngineService } from './result-engine.service';
import { MECHANIC_BY_FAMILY } from './mechanics';
import { OddsService } from './odds.service';
import { ResultMode } from '../../../common/enums/result-mode.enum';

const order = (numbers: string) => ({
  betType: 'exact4',
  betContent: {
    orderGroup: 'P4G1784488025210903637427062769',
    numbers,
    betType: 'exact4',
  },
  totalAmount: 5,
  odds: 0,
  quantity: 1,
});

const PRODUCTION_ORDERS = [
  order('1712'),
  order('1710'),
  order('5423'),
  order('9643'),
  order('5789'),
];

const ODDS_MAP: Record<string, number> = {
  exact4: 9000,
  exact5: 90000,
  first: 9,
  big: 2,
  small: 2,
  odd: 2,
  even: 2,
  sum: 5,
};

const buildEngine = (): ResultEngineService => {
  const configLoader = {
    getOddsAliasMap: async () => ({}),
    getOddsMissingPolicy: async () => 'use_stored',
    getResultSampleSize: async () => 2000,
    getResultDecisionBudgetMs: async () => 5000,
    getResultModeDefault: async () => ResultMode.MaxProfit,
    getResultHouseEdgeDefault: async () => 0.15,
  };
  return new ResultEngineService(
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
};

describe('max_profit must never pick a result that pays out (round 260719080100542)', () => {
  it('REGRESSION: scores the winning candidate and refuses it', async () => {
    const engine = buildEngine();

    const decision = await engine.decide({
      gameType: 'four_five_digit',
      cfg: { family: 'digit5', digitCount: 5 } as never,
      mechanic: MECHANIC_BY_FAMILY.get('digit5'),
      orders: PRODUCTION_ORDERS as never,
      oddsMap: ODDS_MAP,
      mode: ResultMode.MaxProfit,
      houseEdgeTarget: 0.15,
      avoidBigPrize: false,
      avoidZeroOrder: false,
    } as never);

    expect(decision.totalStake).toBe(25);
    expect(decision.totalPayout).toBe(0);
    expect(decision.profitLoss).toBe(25);

    const chosen = String(
      (decision.result as { number?: string }).number ?? '',
    );
    expect(chosen).not.toBe('05789');
    expect(chosen.slice(-4)).not.toBe('5789');
  });

  it('every bet number is invisible-proof: none of the 5 can win the chosen result', async () => {
    const engine = buildEngine();
    const mech = MECHANIC_BY_FAMILY.get('digit5');
    const cfg = { family: 'digit5', digitCount: 5 } as never;

    for (let run = 0; run < 25; run += 1) {
      const decision = await engine.decide({
        gameType: 'four_five_digit',
        cfg,
        mechanic: mech,
        orders: PRODUCTION_ORDERS as never,
        oddsMap: ODDS_MAP,
        mode: ResultMode.MaxProfit,
        houseEdgeTarget: 0.15,
        avoidBigPrize: false,
        avoidZeroOrder: false,
      } as never);

      const winners = PRODUCTION_ORDERS.filter(
        (o) =>
          mech!.evaluate({
            betType: o.betType,
            betContent: o.betContent,
            result: decision.result,
            cfg,
          }).won,
      );
      expect(winners).toHaveLength(0);
      expect(decision.totalPayout).toBe(0);
    }
  });

  it('when EVERY outcome pays, it picks the cheapest instead of a random one', async () => {
    const engine = buildEngine();
    const saturating = Array.from({ length: 10 }, (_, i) => ({
      betType: 'first',
      betContent: { numbers: String(i), betType: 'first' },
      totalAmount: i === 7 ? 1 : 100,
      odds: 0,
      quantity: 1,
    }));

    const decision = await engine.decide({
      gameType: 'four_five_digit',
      cfg: { family: 'digit5', digitCount: 5 } as never,
      mechanic: MECHANIC_BY_FAMILY.get('digit5'),
      orders: saturating as never,
      oddsMap: { first: 9 },
      mode: ResultMode.MaxProfit,
      houseEdgeTarget: 0.15,
      avoidBigPrize: false,
      avoidZeroOrder: false,
    } as never);

    expect(decision.totalPayout).toBe(9);
    expect(
      String((decision.result as { number?: string }).number ?? '').charAt(0),
    ).toBe('7');
  });
});
