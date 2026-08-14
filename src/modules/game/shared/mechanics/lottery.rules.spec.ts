import { LotteryMechanic } from './lottery.mechanic';
import { GameMechanicsConfig, FAMILY_DEFAULTS } from '../game-config.types';

function cfg(): GameMechanicsConfig {
  return {
    family: 'lottery',
    prizeMatchRules: {
      first: 500000,
      second: 50000,
      third: 5000,
      consolation: 5000,
      last4: 5000,
      last3: 2000,
      last2: 500,
    },
  };
}

function prizeResult() {
  const prizes = {
    first: '123456',
    second: ['234567'],
    third: ['345678'],
    consolation: ['111111', '222222'],
  };
  return { prizes, drawResult: prizes.first };
}

function bet(numbers: string) {
  return { betType: 'ticket', betContent: { numbers }, cfg: cfg() } as const;
}

describe('LotteryMechanic — Kerala prize-tier rules', () => {
  it('uses FAMILY_DEFAULTS.lottery as its defaults', () => {
    expect(LotteryMechanic.defaults).toBe(FAMILY_DEFAULTS.lottery);
  });

  describe('exact tier matches', () => {
    it('awards the first-tier prize on an exact first match', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('123456'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('first');
      expect(outcome.oddsKey).toBe('first');
      expect(outcome.fixedWin).toBe(500000);
    });

    it('awards the second-tier prize when the ticket is in the second array', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('234567'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('second');
      expect(outcome.oddsKey).toBe('second');
      expect(outcome.fixedWin).toBe(50000);
    });

    it('awards the third-tier prize when the ticket is in the third array', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('345678'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('third');
      expect(outcome.oddsKey).toBe('third');
      expect(outcome.fixedWin).toBe(5000);
    });

    it('awards the consolation prize for either consolation code', () => {
      const first = LotteryMechanic.evaluate({
        ...bet('111111'),
        result: prizeResult(),
      });
      expect(first.won).toBe(true);
      expect(first.prizeLevel).toBe('consolation');
      expect(first.oddsKey).toBe('consolation');
      expect(first.fixedWin).toBe(5000);

      const second = LotteryMechanic.evaluate({
        ...bet('222222'),
        result: prizeResult(),
      });
      expect(second.won).toBe(true);
      expect(second.prizeLevel).toBe('consolation');
      expect(second.fixedWin).toBe(5000);
    });
  });

  describe('losing ticket', () => {
    it('loses when the ticket matches no tier and shares no suffix with first', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('987654'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(false);
      expect(outcome.prizeLevel).toBeUndefined();
      expect(outcome.fixedWin).toBeUndefined();
    });

    it('loses when there is no ticket at all', () => {
      const outcome = LotteryMechanic.evaluate({
        betType: 'ticket',
        betContent: {},
        result: prizeResult(),
        cfg: cfg(),
      });
      expect(outcome.won).toBe(false);
    });
  });

  describe('lastN suffix fallback on the first prize', () => {
    // NOTE: the suffix rule is `n < ticket.length`, so a 6-digit ticket can win
    // last4/last3/last2/last1, but a ticket of length N cannot win lastN itself
    // (full-length match is the exact path). Kerala tickets are full 6-digit numbers.
    it("wins last3 when a 6-digit ticket '999856' shares the last 3 of first '123856'", () => {
      const prizes = {
        first: '123856',
        second: ['234567'],
        third: ['345678'],
        consolation: ['111111', '222222'],
      };
      const outcome = LotteryMechanic.evaluate({
        ...bet('999856'),
        result: { prizes, drawResult: prizes.first },
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('last3');
      expect(outcome.oddsKey).toBe('last3');
      expect(outcome.fixedWin).toBe(2000);
    });

    it("wins last4 when a 6-digit ticket '993456' shares the last 4 of first '123456'", () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('993456'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('last4');
      expect(outcome.oddsKey).toBe('last4');
      expect(outcome.fixedWin).toBe(5000);
    });

    it('loses on a suffix mismatch against the first prize', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('999'),
        result: prizeResult(),
      });
      expect(outcome.won).toBe(false);
    });
  });

  describe('no-prizes fallback path (result.number only)', () => {
    it("treats an exact number match as a 'first' win", () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('123456'),
        result: { number: '123456' },
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('first');
      expect(outcome.oddsKey).toBe('first');
      expect(outcome.fixedWin).toBe(500000);
    });

    it('falls back to a lastN suffix match against result.number', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('993456'),
        result: { number: '123456' },
      });
      expect(outcome.won).toBe(true);
      expect(outcome.prizeLevel).toBe('last4');
      expect(outcome.oddsKey).toBe('last4');
      expect(outcome.fixedWin).toBe(5000);
    });

    it('loses on the fallback path when neither exact nor suffix match', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('789'),
        result: { number: '123456' },
      });
      expect(outcome.won).toBe(false);
    });

    it('loses when there are neither prizes nor a result number', () => {
      const outcome = LotteryMechanic.evaluate({
        ...bet('123456'),
        result: {},
      });
      expect(outcome.won).toBe(false);
    });
  });
});
