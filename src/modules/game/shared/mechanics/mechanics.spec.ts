import { ColorMechanic } from './color.mechanic';
import { DiceMechanic } from './dice.mechanic';
import { RaceMechanic } from './race.mechanic';
import { Digit3Mechanic, Digit5Mechanic } from './digit.mechanic';
import { SingleDigitMechanic } from './single-digit.mechanic';
import { LotteryMechanic } from './lottery.mechanic';
import { FAMILY_DEFAULTS, Rng } from '../game-config.types';

function seqRng(values: number[]): Rng {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}

describe('ColorMechanic', () => {
  const cfg = FAMILY_DEFAULTS.color;

  it('generates a config-driven, deterministic result', () => {
    const r = ColorMechanic.generate(cfg, seqRng([0.55]));
    expect(r.number).toBe(5);
    expect(r.colors).toEqual(['green', 'violet']);
    expect(r.sizeType).toBe('big');
    expect(r.drawResult).toBe('5');
  });

  it('evaluates colour bets and resolves the odds class', () => {
    const result = ColorMechanic.generate(cfg, seqRng([0.55]));
    expect(
      ColorMechanic.evaluate({
        betType: 'color',
        betContent: { betNum: 'green' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'green_violet' });
    expect(
      ColorMechanic.evaluate({
        betType: 'color',
        betContent: { betNum: 'red' },
        result,
        cfg,
      }).won,
    ).toBe(false);
    expect(
      ColorMechanic.evaluate({
        betType: 'color',
        betContent: { betNum: 'violet' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'violet' });
  });

  it('evaluates size and exact-number bets', () => {
    const result = {
      number: 3,
      colors: ['green'],
      sizeType: 'small',
      drawResult: '3',
    };
    expect(
      ColorMechanic.evaluate({
        betType: 'size',
        betContent: { betNum: 'small' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'small' });
    expect(
      ColorMechanic.evaluate({
        betType: 'number',
        betContent: { betNum: '3' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'number' });
    expect(
      ColorMechanic.evaluate({
        betType: 'number',
        betContent: { betNum: '7' },
        result,
        cfg,
      }).won,
    ).toBe(false);
  });

  it('enumerates the full 0-9 candidate space', () => {
    const candidates = ColorMechanic.enumerateCandidates(cfg);
    expect(candidates).toHaveLength(10);
    expect(candidates.map((c) => c.number)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});

describe('DiceMechanic', () => {
  const cfg = FAMILY_DEFAULTS.dice;

  it('generates a config-driven, deterministic result', () => {
    const r = DiceMechanic.generate(cfg, seqRng([0, 0.5, 0.99]));
    expect(r.dice).toEqual([1, 4, 6]);
    expect(r.sum).toBe(11);
    expect(r.sizeType).toBe('big');
    expect(r.parityType).toBe('odd');
    expect(r.isTriple).toBe(false);
  });

  it('evaluates sum, single, double and leopard bets', () => {
    const result = {
      dice: [4, 4, 4],
      sum: 12,
      sizeType: 'big',
      parityType: 'even',
      isTriple: true,
      drawResult: '4,4,4',
    };
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'sum_big' },
        result,
        cfg,
      }).won,
    ).toBe(false);
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'leopard_four' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'leopard_four' });
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'double_four' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'single_four' },
        result,
        cfg,
      }).won,
    ).toBe(true);

    const mixed = {
      dice: [2, 5, 6],
      sum: 13,
      isTriple: false,
      drawResult: '2,5,6',
    };
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'sum_big' },
        result: mixed,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      DiceMechanic.evaluate({
        betType: '',
        betContent: { betNum: 'sum_thirteen' },
        result: mixed,
        cfg,
      }).won,
    ).toBe(true);
  });

  it('enumerates the 56 sorted combinations for 3d6', () => {
    const candidates = DiceMechanic.enumerateCandidates(cfg);
    expect(candidates).toHaveLength(56);
  });
});

describe('RaceMechanic (P0-1 fix)', () => {
  const cfg = { ...FAMILY_DEFAULTS.race, runnerCount: 12 };
  const positions = [8, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12];
  const result = {
    positions,
    runnerCount: 12,
    champion: 8,
    second: 1,
    third: 2,
    drawResult: positions.join(','),
  };

  it('wins a champion bet from numeric category + runner', () => {
    expect(
      RaceMechanic.evaluate({
        betType: '1',
        betContent: { betType: 1, betNum: '8' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'champion' });
    expect(
      RaceMechanic.evaluate({
        betType: '1',
        betContent: { betType: 1, betNum: '3' },
        result,
        cfg,
      }).won,
    ).toBe(false);
  });

  it('top3_fixed (type 2) needs the exact 1st/2nd/3rd order; top3_random (type 5) needs 3 unique top-3 picks', () => {
    expect(
      RaceMechanic.evaluate({
        betType: '2',
        betContent: { betType: 2, betNum: '8,1,2' },
        result,
        cfg,
      }).won,
    ).toBe(true); // exact order champion,second,third
    expect(
      RaceMechanic.evaluate({
        betType: '2',
        betContent: { betType: 2, betNum: '1,8,2' },
        result,
        cfg,
      }).won,
    ).toBe(false); // wrong order
    expect(
      RaceMechanic.evaluate({
        betType: '5',
        betContent: { betType: 5, betNum: '8,1,2' },
        result,
        cfg,
      }).won,
    ).toBe(true); // all three in top3 (any order)
    expect(
      RaceMechanic.evaluate({
        betType: '5',
        betContent: { betType: 5, betNum: '8,1,9' },
        result,
        cfg,
      }).won,
    ).toBe(false); // 9 not in top3
  });

  it('winning_group (type 3) matches the champion group; top3_any (type 4) matches any selected runner in the top 3', () => {
    // champion 8 in a 12-runner race → group floor((8-1)/2)+1 = 4
    expect(
      RaceMechanic.evaluate({
        betType: '3',
        betContent: { betType: 3, betNum: '4' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      RaceMechanic.evaluate({
        betType: '3',
        betContent: { betType: 3, betNum: '1' },
        result,
        cfg,
      }).won,
    ).toBe(false);
    expect(
      RaceMechanic.evaluate({
        betType: '4',
        betContent: { betType: 4, betNum: '8' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      RaceMechanic.evaluate({
        betType: '4',
        betContent: { betType: 4, betNum: '9' },
        result,
        cfg,
      }).won,
    ).toBe(false);
  });

  it('champion (type 1) wins from a bare canonical runner number', () => {
    expect(
      RaceMechanic.evaluate({
        betType: '1',
        betContent: { betType: 1, betNum: '8' },
        result,
        cfg,
      }).won,
    ).toBe(true);
  });

  it('generates a valid permutation and enumerates top-3 orderings', () => {
    const seq: Rng = { next: () => 0.5 };
    const r = RaceMechanic.generate(
      { ...FAMILY_DEFAULTS.race, runnerCount: 6 },
      seq,
    );
    expect(
      (r.positions ?? []).slice().sort((a: number, b: number) => a - b),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      RaceMechanic.enumerateCandidates({
        ...FAMILY_DEFAULTS.race,
        runnerCount: 6,
      }),
    ).toHaveLength(6 * 5 * 4);
  });
});

describe('Digit3Mechanic (P0-2 fix)', () => {
  const cfg = FAMILY_DEFAULTS.digit3;
  const result = {
    number: '123',
    digits: [1, 2, 3],
    drawResult: '123',
    sum: 6,
  };

  it('wins an exact (level 3) bet using betContent.numbers', () => {
    expect(
      Digit3Mechanic.evaluate({
        betType: '3',
        betContent: { numbers: '123', betType: '3' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: '3' });
    expect(
      Digit3Mechanic.evaluate({
        betType: '3',
        betContent: { numbers: '124', betType: '3' },
        result,
        cfg,
      }).won,
    ).toBe(false);
  });

  it('handles box, suffix levels, sum and size rules', () => {
    expect(
      Digit3Mechanic.evaluate({
        betType: 'box',
        betContent: { numbers: '321', betType: 'box' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      Digit3Mechanic.evaluate({
        betType: '1',
        betContent: { numbers: '993', betType: '1' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      Digit3Mechanic.evaluate({
        betType: 'sum',
        betContent: { numbers: '006', betType: 'sum' },
        result,
        cfg,
      }).won,
    ).toBe(true);
  });
});

describe('Digit5Mechanic', () => {
  const cfg = FAMILY_DEFAULTS.digit5;
  const result = {
    number: '12345',
    digits: [1, 2, 3, 4, 5],
    drawResult: '12345',
    sum: 15,
  };

  it('wins exact5 and position bets', () => {
    expect(
      Digit5Mechanic.evaluate({
        betType: 'exact5',
        betContent: { numbers: '12345', betType: 'exact5' },
        result,
        cfg,
      }).won,
    ).toBe(true);
    expect(
      Digit5Mechanic.evaluate({
        betType: 'first',
        betContent: { numbers: '19999', betType: 'first' },
        result,
        cfg,
      }).won,
    ).toBe(true);
  });

  it('injects targeted candidates for the large 5-digit space', () => {
    const candidates = Digit5Mechanic.enumerateCandidates(cfg, {
      sampleSize: 50,
      targets: ['12345'],
    });
    expect(candidates.some((c) => c.number === '12345')).toBe(true);
  });
});

describe('SingleDigitMechanic', () => {
  const cfg = FAMILY_DEFAULTS.single_digit;
  it('wins an exact number bet', () => {
    expect(
      SingleDigitMechanic.evaluate({
        betType: '5',
        betContent: { betCode: '5' },
        result: { number: '5' },
        cfg,
      }),
    ).toEqual({ won: true, oddsKey: 'number_5' });
  });
});

describe('LotteryMechanic (P0-3 fix)', () => {
  const cfg = FAMILY_DEFAULTS.lottery;

  it('matches auto-generated result prize tiers', () => {
    const result = {
      prizes: {
        first: '123456',
        second: '654321',
        third: ['111111', '222222'],
      },
      drawResult: '123456',
    };
    expect(
      LotteryMechanic.evaluate({
        betType: 'ticket',
        betContent: { numbers: '123456' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, prizeLevel: 'first', oddsKey: 'first' });
    expect(
      LotteryMechanic.evaluate({
        betType: 'ticket',
        betContent: { numbers: '222222' },
        result,
        cfg,
      }).prizeLevel,
    ).toBe('third');
  });

  it('matches admin-set result shape ({amount, codes})', () => {
    const result = {
      prizes: { first: { amount: 100000, codes: ['999999'] } },
      drawResult: '999999',
    };
    expect(
      LotteryMechanic.evaluate({
        betType: 'ticket',
        betContent: { numbers: '999999' },
        result,
        cfg,
      }).prizeLevel,
    ).toBe('first');
  });

  it('awards last-N consolation matches', () => {
    const result = { prizes: { first: '123456' }, drawResult: '123456' };
    expect(
      LotteryMechanic.evaluate({
        betType: 'ticket',
        betContent: { numbers: '003456' },
        result,
        cfg,
      }),
    ).toEqual({ won: true, prizeLevel: 'last4', oddsKey: 'last4' });
  });
});
