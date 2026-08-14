import { ColorMechanic } from './color.mechanic';
import { FAMILY_DEFAULTS } from '../game-config.types';

const cfg = FAMILY_DEFAULTS.color;

function result(number: number) {
  return { number };
}

function evalColor(code: string, number: number) {
  return ColorMechanic.evaluate({
    betType: 'color',
    betContent: { betNum: code },
    result: result(number),
    cfg,
  });
}

describe('ColorMechanic — colour bets (green / red / violet)', () => {
  it('green WINS on pure-green numbers 1,3,7,9', () => {
    for (const n of [1, 3, 7, 9]) {
      const outcome = evalColor('green', n);
      expect(outcome.won).toBe(true);
      expect(outcome.oddsKey).toBe('green');
    }
  });

  it('green LOSES on pure-red numbers 2,4,6,8 and on red+violet 0', () => {
    for (const n of [0, 2, 4, 6, 8]) {
      expect(evalColor('green', n).won).toBe(false);
    }
  });

  it('red WINS on pure-red numbers 2,4,6,8', () => {
    for (const n of [2, 4, 6, 8]) {
      const outcome = evalColor('red', n);
      expect(outcome.won).toBe(true);
      expect(outcome.oddsKey).toBe('red');
    }
  });

  it('red LOSES on pure-green numbers 1,3,7,9 and on green+violet 5', () => {
    for (const n of [1, 3, 5, 7, 9]) {
      expect(evalColor('red', n).won).toBe(false);
    }
  });

  it('violet WINS only on the overlap numbers 0 and 5', () => {
    expect(evalColor('violet', 0).won).toBe(true);
    expect(evalColor('violet', 5).won).toBe(true);
  });

  it('violet LOSES on every non-overlap number', () => {
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9]) {
      expect(evalColor('violet', n).won).toBe(false);
    }
  });
});

describe('ColorMechanic — violet-overlap oddsKey rule', () => {
  it('green on number 5 (green+violet) wins with oddsKey green_violet', () => {
    expect(evalColor('green', 5)).toEqual({
      won: true,
      oddsKey: 'green_violet',
    });
  });

  it('red on number 0 (red+violet) wins with oddsKey red_violet', () => {
    expect(evalColor('red', 0)).toEqual({
      won: true,
      oddsKey: 'red_violet',
    });
  });

  it('violet on number 0 wins with plain oddsKey violet (no overlap suffix)', () => {
    expect(evalColor('violet', 0)).toEqual({ won: true, oddsKey: 'violet' });
  });

  it('violet on number 5 wins with plain oddsKey violet (no overlap suffix)', () => {
    expect(evalColor('violet', 5)).toEqual({ won: true, oddsKey: 'violet' });
  });

  it('green/red on a non-overlap match keep the plain colour oddsKey', () => {
    expect(evalColor('green', 1)).toEqual({ won: true, oddsKey: 'green' });
    expect(evalColor('red', 2)).toEqual({ won: true, oddsKey: 'red' });
  });
});

describe('ColorMechanic — big / small size bets at the threshold boundary', () => {
  function evalSize(code: string, number: number) {
    return ColorMechanic.evaluate({
      betType: 'size',
      betContent: { betNum: code },
      result: result(number),
      cfg,
    });
  }

  it('number 4 is small: small WINS, big LOSES at the lower side of the boundary', () => {
    expect(evalSize('small', 4)).toEqual({ won: true, oddsKey: 'small' });
    expect(evalSize('big', 4).won).toBe(false);
  });

  it('number 5 is big: big WINS, small LOSES at the boundary (>= threshold 5)', () => {
    expect(evalSize('big', 5)).toEqual({ won: true, oddsKey: 'big' });
    expect(evalSize('small', 5).won).toBe(false);
  });

  it('small wins across the whole 0-4 lower band', () => {
    for (const n of [0, 1, 2, 3, 4]) {
      expect(evalSize('small', n).won).toBe(true);
      expect(evalSize('big', n).won).toBe(false);
    }
  });

  it('big wins across the whole 5-9 upper band', () => {
    for (const n of [5, 6, 7, 8, 9]) {
      expect(evalSize('big', n).won).toBe(true);
      expect(evalSize('small', n).won).toBe(false);
    }
  });
});

describe('ColorMechanic — exact-number bets 0-9 (oddsKey number)', () => {
  function evalNumber(code: string, number: number) {
    return ColorMechanic.evaluate({
      betType: 'number',
      betContent: { betNum: code },
      result: result(number),
      cfg,
    });
  }

  for (let target = 0; target <= 9; target++) {
    it(`number bet '${target}' wins when result equals ${target}`, () => {
      expect(evalNumber(String(target), target)).toEqual({
        won: true,
        oddsKey: 'number',
      });
    });

    it(`number bet '${target}' loses against every other digit`, () => {
      for (let drawn = 0; drawn <= 9; drawn++) {
        if (drawn === target) continue;
        expect(evalNumber(String(target), drawn).won).toBe(false);
      }
    });
  }
});
