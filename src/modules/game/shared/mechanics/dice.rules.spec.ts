import { DiceMechanic } from './dice.mechanic';
import { FAMILY_DEFAULTS } from '../game-config.types';

const cfg = { ...FAMILY_DEFAULTS.dice, bigSmallThreshold: 10 };

function result(dice: number[]) {
  return {
    dice,
    sum: dice.reduce((a, b) => a + b, 0),
    isTriple: dice.length > 0 && dice.every((d) => d === dice[0]),
    drawResult: dice.join(','),
  };
}

function evalBet(code: string, dice: number[]) {
  return DiceMechanic.evaluate({
    betType: '',
    betContent: { betNum: code },
    result: result(dice),
    cfg,
  });
}

describe('DiceMechanic.evaluate — sum size (big/small) with triple-void', () => {
  it('sum_big wins on a non-triple over the threshold', () => {
    const o = evalBet('sum_big', [4, 5, 6]); // sum 15 > 10, not triple
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_big');
  });

  it('sum_big loses on a non-triple at/under the threshold', () => {
    const o = evalBet('sum_big', [1, 2, 3]); // sum 6 <= 10
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_big');
  });

  it('sum_big LOSES on a triple whose sum is over the threshold (triple-void)', () => {
    const o = evalBet('sum_big', [5, 5, 5]); // sum 15 > 10 but triple voids it
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_big');
  });

  it('sum_small wins on a non-triple at/under the threshold', () => {
    const o = evalBet('sum_small', [1, 2, 3]); // sum 6 <= 10
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_small');
  });

  it('sum_small loses on a non-triple over the threshold', () => {
    const o = evalBet('sum_small', [4, 5, 6]); // sum 15 > 10
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_small');
  });

  it('sum_small LOSES on a triple whose sum is under the threshold (triple-void) — [2,2,2] sum 6', () => {
    const o = evalBet('sum_small', [2, 2, 2]); // sum 6 <= 10 but triple voids it
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_small');
  });
});

describe('DiceMechanic.evaluate — sum parity (odd/even) with triple-void', () => {
  it('sum_odd wins on a non-triple odd sum', () => {
    const o = evalBet('sum_odd', [1, 2, 4]); // sum 7 odd, not triple
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_odd');
  });

  it('sum_odd loses on a non-triple even sum', () => {
    const o = evalBet('sum_odd', [1, 2, 3]); // sum 6 even
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_odd');
  });

  it('sum_odd LOSES on a triple whose sum is odd (triple-void) — [1,1,1] sum 3', () => {
    const o = evalBet('sum_odd', [1, 1, 1]); // sum 3 odd but triple voids it
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_odd');
  });

  it('sum_even wins on a non-triple even sum', () => {
    const o = evalBet('sum_even', [1, 2, 3]); // sum 6 even, not triple
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_even');
  });

  it('sum_even loses on a non-triple odd sum', () => {
    const o = evalBet('sum_even', [1, 2, 4]); // sum 7 odd
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_even');
  });

  it('sum_even LOSES on a triple whose sum is even (triple-void) — [2,2,2] sum 6', () => {
    const o = evalBet('sum_even', [2, 2, 2]); // sum 6 even but triple voids it
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('sum_even');
  });
});

describe('DiceMechanic.evaluate — specific sums (NOT voided by triples)', () => {
  const cases: Array<{ code: string; win: number[]; lose: number[] }> = [
    { code: 'sum_three', win: [1, 1, 1], lose: [1, 1, 2] },
    { code: 'sum_four', win: [1, 1, 2], lose: [1, 1, 1] },
    { code: 'sum_five', win: [1, 2, 2], lose: [1, 1, 1] },
    { code: 'sum_six', win: [1, 2, 3], lose: [1, 1, 1] },
    { code: 'sum_seven', win: [1, 2, 4], lose: [1, 1, 2] },
    { code: 'sum_eight', win: [1, 3, 4], lose: [1, 1, 2] },
    { code: 'sum_nine', win: [2, 3, 4], lose: [1, 1, 2] },
    { code: 'sum_ten', win: [2, 4, 4], lose: [1, 1, 2] },
    { code: 'sum_eleven', win: [3, 4, 4], lose: [1, 1, 2] },
    { code: 'sum_twelve', win: [4, 4, 4], lose: [1, 1, 2] },
    { code: 'sum_thirteen', win: [3, 4, 6], lose: [1, 1, 2] },
    { code: 'sum_fourteen', win: [4, 4, 6], lose: [1, 1, 2] },
    { code: 'sum_fifteen', win: [3, 6, 6], lose: [1, 1, 2] },
    { code: 'sum_sixteen', win: [4, 6, 6], lose: [1, 1, 2] },
    { code: 'sum_seventeen', win: [5, 6, 6], lose: [1, 1, 2] },
    { code: 'sum_eighteen', win: [6, 6, 6], lose: [5, 6, 6] },
  ];

  for (const { code, win, lose } of cases) {
    it(`${code} wins on a matching sum (${win.join(',')})`, () => {
      const o = evalBet(code, win);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(code);
    });

    it(`${code} loses on a non-matching sum (${lose.join(',')})`, () => {
      const o = evalBet(code, lose);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(code);
    });
  }

  it('sum_twelve WINS on the triple [4,4,4] (specific sums are NOT triple-voided)', () => {
    const o = evalBet('sum_twelve', [4, 4, 4]); // sum 12, triple, still wins
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_twelve');
  });

  it('sum_three WINS on the triple [1,1,1] (specific sums are NOT triple-voided)', () => {
    const o = evalBet('sum_three', [1, 1, 1]); // sum 3, triple, still wins
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_three');
  });

  it('sum_eighteen WINS on the triple [6,6,6] (specific sums are NOT triple-voided)', () => {
    const o = evalBet('sum_eighteen', [6, 6, 6]); // sum 18, triple, still wins
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('sum_eighteen');
  });
});

describe('DiceMechanic.evaluate — single (any die shows the face)', () => {
  const cases: Array<{ code: string; die: number }> = [
    { code: 'single_one', die: 1 },
    { code: 'single_two', die: 2 },
    { code: 'single_three', die: 3 },
    { code: 'single_four', die: 4 },
    { code: 'single_five', die: 5 },
    { code: 'single_six', die: 6 },
  ];

  for (const { code, die } of cases) {
    it(`${code} wins when one die shows ${die}`, () => {
      // target die present, the other two distinct from each other and not a triple
      const win = [die, die === 6 ? 1 : 6, die === 5 ? 2 : 5];
      const o = evalBet(code, win);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(code);
    });

    it(`${code} loses when no die shows ${die}`, () => {
      const lose = [1, 2, 3, 4, 5, 6].filter((d) => d !== die).slice(0, 3);
      const o = evalBet(code, lose);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(code);
    });
  }

  it('single counts each die independently (one occurrence is enough)', () => {
    const o = evalBet('single_two', [2, 4, 6]); // exactly one 2
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('single_two');
  });
});

describe('DiceMechanic.evaluate — double (needs >= 2 of the die)', () => {
  const cases: Array<{ code: string; die: number }> = [
    { code: 'double_one', die: 1 },
    { code: 'double_two', die: 2 },
    { code: 'double_three', die: 3 },
    { code: 'double_four', die: 4 },
    { code: 'double_five', die: 5 },
    { code: 'double_six', die: 6 },
  ];

  for (const { code, die } of cases) {
    it(`${code} wins on exactly two of ${die}`, () => {
      const other = die === 6 ? 1 : 6;
      const o = evalBet(code, [die, die, other]);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(code);
    });

    it(`${code} loses on only one of ${die}`, () => {
      const a = die === 6 ? 1 : 6;
      const b = die === 5 ? 2 : 5;
      const o = evalBet(code, [die, a, b]);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(code);
    });
  }

  it('double also wins on three of the die (>= 2)', () => {
    const o = evalBet('double_three', [3, 3, 3]); // triple still has >= 2
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('double_three');
  });
});

describe('DiceMechanic.evaluate — leopard (triple) bets', () => {
  it('leopard_any wins on any triple', () => {
    const o = evalBet('leopard_any', [3, 3, 3]);
    expect(o.won).toBe(true);
    expect(o.oddsKey).toBe('leopard_any');
  });

  it('leopard_any loses on a non-triple', () => {
    const o = evalBet('leopard_any', [3, 3, 5]);
    expect(o.won).toBe(false);
    expect(o.oddsKey).toBe('leopard_any');
  });

  const cases: Array<{ code: string; die: number }> = [
    { code: 'leopard_one', die: 1 },
    { code: 'leopard_two', die: 2 },
    { code: 'leopard_three', die: 3 },
    { code: 'leopard_four', die: 4 },
    { code: 'leopard_five', die: 5 },
    { code: 'leopard_six', die: 6 },
  ];

  for (const { code, die } of cases) {
    it(`${code} wins on the matching triple [${die},${die},${die}]`, () => {
      const o = evalBet(code, [die, die, die]);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe(code);
    });

    it(`${code} loses on a different triple`, () => {
      const wrong = die === 6 ? 1 : 6;
      const o = evalBet(code, [wrong, wrong, wrong]);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(code);
    });

    it(`${code} loses on a non-triple containing ${die}`, () => {
      const o = evalBet(code, [die, die, die === 6 ? 1 : 6]); // pair, not triple
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe(code);
    });
  }

  it('leopard_six differs from leopard_any: leopard_six loses on a [4,4,4] triple that leopard_any wins', () => {
    const four = evalBet('leopard_six', [4, 4, 4]);
    const any = evalBet('leopard_any', [4, 4, 4]);
    expect(four.won).toBe(false);
    expect(any.won).toBe(true);
  });
});
