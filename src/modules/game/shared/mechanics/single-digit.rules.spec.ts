import { SingleDigitMechanic } from './single-digit.mechanic';
import { FAMILY_DEFAULTS, GameMechanicsConfig } from '../game-config.types';

const cfg: GameMechanicsConfig = FAMILY_DEFAULTS.single_digit ?? {
  family: 'single_digit',
};

function result(n: number) {
  return { number: n, drawResult: String(n) };
}

function bet(n: number | string) {
  return { betNum: String(n) };
}

describe('SingleDigitMechanic — single number bets', () => {
  const picks = [3, 7, 17, 36];

  for (const picked of picks) {
    it(`wins number_${picked} when result equals ${picked}`, () => {
      const outcome = SingleDigitMechanic.evaluate({
        betType: String(picked),
        betContent: bet(picked),
        result: result(picked),
        cfg,
      });
      expect(outcome.won).toBe(true);
      expect(outcome.oddsKey).toBe(`number_${picked}`);
      expect(outcome.fixedWin).toBeUndefined();
      expect(outcome.prizeLevel).toBeUndefined();
    });

    it(`loses number_${picked} when result differs from ${picked}`, () => {
      const drawn = picked === 1 ? 2 : 1;
      const outcome = SingleDigitMechanic.evaluate({
        betType: String(picked),
        betContent: bet(picked),
        result: result(drawn),
        cfg,
      });
      expect(outcome.won).toBe(false);
      expect(outcome.oddsKey).toBe(`number_${picked}`);
    });
  }

  it('wins a multi-digit pick at the top of the [1,36] range', () => {
    const outcome = SingleDigitMechanic.evaluate({
      betType: '36',
      betContent: bet(36),
      result: result(36),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.oddsKey).toBe('number_36');
  });

  it('does not confuse a 2-digit pick with its leading digit', () => {
    const outcome = SingleDigitMechanic.evaluate({
      betType: '17',
      betContent: bet(17),
      result: result(1),
      cfg,
    });
    expect(outcome.won).toBe(false);
    expect(outcome.oddsKey).toBe('number_17');
  });
});

describe('SingleDigitMechanic — invalid / empty bets', () => {
  it('returns won:false for an empty bet code', () => {
    const outcome = SingleDigitMechanic.evaluate({
      betType: '',
      betContent: { betNum: '' },
      result: result(7),
      cfg,
    });
    expect(outcome.won).toBe(false);
  });

  it('returns won:false for a NaN (non-numeric) bet code', () => {
    const outcome = SingleDigitMechanic.evaluate({
      betType: 'abc',
      betContent: { betNum: 'abc' },
      result: result(7),
      cfg,
    });
    expect(outcome.won).toBe(false);
  });

  it('returns won:false when the result number is missing', () => {
    const outcome = SingleDigitMechanic.evaluate({
      betType: '7',
      betContent: bet(7),
      result: { number: undefined, drawResult: undefined } as never,
      cfg,
    });
    expect(outcome.won).toBe(false);
  });
});
