import { ResultEngineService } from './result-engine.service';
import { OddsService } from './odds.service';
import { ColorMechanic } from './mechanics/color.mechanic';
import { FAMILY_DEFAULTS } from './game-config.types';

const configStub: any = {
  getJson: async (_k: string, d: any) => d,
  getString: async (_k: string, d: any) => d,
  getNumber: async (_k: string, d: any) => d,
  getOddsAliasMap: async () => ({}),
  getOddsMissingPolicy: async () => 'use_stored',
  getResultModeDefault: async () => 'random',
  getResultHouseEdgeDefault: async () => 0.15,
  getResultSampleSize: async () => 2000,
  getResultDecisionBudgetMs: async () => 250,
};

function makeEngine(): ResultEngineService {
  return new ResultEngineService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    new OddsService(),
    configStub,
  );
}

describe('ResultEngineService.decide', () => {
  const engine = makeEngine();
  const cfg = FAMILY_DEFAULTS.color;

  it('min_payout selects a result that pays nothing when possible', async () => {
    const orders = [
      {
        betType: 'color',
        betContent: { betNum: 'green' },
        totalAmount: 100,
        odds: 2,
        quantity: 1,
      },
      {
        betType: 'color',
        betContent: { betNum: 'green' },
        totalAmount: 50,
        odds: 2,
        quantity: 1,
      },
    ];
    const d = await engine.decide({
      gameType: 'color',
      cfg,
      mechanic: ColorMechanic,
      orders,
      oddsMap: {},
      mode: 'min_payout',
    });
    expect(d.totalPayout).toBe(0);
    expect(d.totalStake).toBe(150);
    expect(['0', '2', '4', '6', '8']).toContain(d.result.drawResult);
    expect(d.reason).toBe('min_payout');
  });

  it('max_profit also minimises payout (stake is fixed)', async () => {
    const orders = [
      {
        betType: 'number',
        betContent: { betNum: '7' },
        totalAmount: 100,
        odds: 9,
        quantity: 1,
      },
    ];
    const d = await engine.decide({
      gameType: 'color',
      cfg,
      mechanic: ColorMechanic,
      orders,
      oddsMap: { number: 9 },
      mode: 'max_profit',
    });
    expect(d.totalPayout).toBe(0);
    expect(d.result.drawResult).not.toBe('7');
  });

  it('lowest_risk keeps payout within the house-edge cap', async () => {
    const orders = [
      {
        betType: 'color',
        betContent: { betNum: 'green' },
        totalAmount: 100,
        odds: 2,
        quantity: 1,
      },
    ];
    const d = await engine.decide({
      gameType: 'color',
      cfg,
      mechanic: ColorMechanic,
      orders,
      oddsMap: {},
      mode: 'lowest_risk',
      houseEdgeTarget: 0.15,
    });
    expect(d.totalPayout).toBeLessThanOrEqual(100 * (1 - 0.15));
  });

  it('random evaluates a single generated result', async () => {
    const orders = [
      {
        betType: 'color',
        betContent: { betNum: 'green' },
        totalAmount: 100,
        odds: 2,
        quantity: 1,
      },
    ];
    const d = await engine.decide({
      gameType: 'color',
      cfg,
      mechanic: ColorMechanic,
      orders,
      oddsMap: {},
      mode: 'random',
    });
    expect(d.candidatesEvaluated).toBe(1);
    expect(d.result.drawResult).toBeDefined();
  });

  it('handles no orders gracefully', async () => {
    const d = await engine.decide({
      gameType: 'color',
      cfg,
      mechanic: ColorMechanic,
      orders: [],
      oddsMap: {},
      mode: 'min_payout',
    });
    expect(d.totalStake).toBe(0);
    expect(d.reason).toBe('no_orders');
  });
});
