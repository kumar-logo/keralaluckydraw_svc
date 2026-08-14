import { SlatDigit3Mechanic, SlatDigit5Mechanic } from './slat.mechanic';
import { GameMechanicsConfig, SlatProductView } from '../game-config.types';
import { SlatMatchMode } from '../../../../common/enums';

const SLAT_1D: SlatProductView = {
  id: 1,
  digitCount: 3,
  price: 11,
  matchMode: SlatMatchMode.Group,
  title: 'Slat-1D',
  status: 1,
  tiers: [
    { label: 'A', positions: [0], winAmount: 100, tierRank: 0 },
    { label: 'B', positions: [1], winAmount: 100, tierRank: 0 },
    { label: 'C', positions: [2], winAmount: 100, tierRank: 0 },
  ],
};

const SLAT_2D: SlatProductView = {
  id: 2,
  digitCount: 3,
  price: 12,
  matchMode: SlatMatchMode.Group,
  title: 'Slat-2D',
  status: 1,
  tiers: [
    { label: 'AB', positions: [0, 1], winAmount: 1000, tierRank: 0 },
    { label: 'BC', positions: [1, 2], winAmount: 1000, tierRank: 0 },
    { label: 'AC', positions: [0, 2], winAmount: 1000, tierRank: 0 },
  ],
};

const SLAT_3D_R10: SlatProductView = {
  id: 3,
  digitCount: 3,
  price: 10,
  matchMode: SlatMatchMode.Ladder,
  title: 'Slat-3D',
  status: 1,
  tiers: [
    { label: 'C', positions: [2], winAmount: 0, tierRank: 1 },
    { label: 'BC', positions: [1, 2], winAmount: 100, tierRank: 2 },
    { label: 'ABC', positions: [0, 1, 2], winAmount: 5000, tierRank: 3 },
  ],
};

const SLAT_3D_R25: SlatProductView = {
  id: 4,
  digitCount: 3,
  price: 25,
  matchMode: SlatMatchMode.Ladder,
  title: 'Slat-3D',
  status: 1,
  tiers: [
    { label: 'C', positions: [2], winAmount: 50, tierRank: 1 },
    { label: 'BC', positions: [1, 2], winAmount: 500, tierRank: 2 },
    { label: 'ABC', positions: [0, 1, 2], winAmount: 10000, tierRank: 3 },
  ],
};

const SLAT_4D_R100: SlatProductView = {
  id: 5,
  digitCount: 4,
  price: 100,
  matchMode: SlatMatchMode.Ladder,
  title: 'Slat-4D',
  status: 1,
  tiers: [
    { label: 'C', positions: [3], winAmount: 100, tierRank: 1 },
    { label: 'BC', positions: [2, 3], winAmount: 1000, tierRank: 2 },
    { label: 'ABC', positions: [1, 2, 3], winAmount: 10000, tierRank: 3 },
    { label: 'xABC', positions: [0, 1, 2, 3], winAmount: 500000, tierRank: 4 },
  ],
};

function cfg3(products: SlatProductView[]): GameMechanicsConfig {
  return { family: 'digit3', digitCount: 3, slatProducts: products };
}

function cfg5(products: SlatProductView[]): GameMechanicsConfig {
  return { family: 'digit5', digitCount: 4, slatProducts: products };
}

function draw(number: string) {
  return { number, drawResult: number };
}

describe('SlatDigit3Mechanic — group Slat-1D', () => {
  const cfg = cfg3([SLAT_1D]);

  it('wins A=5 against 523 with fixed prize 100', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'A',
      betContent: { slatProductId: 1, numbers: '5', betType: 'A' },
      result: draw('523'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(100);
    expect(outcome.prizeLevel).toBe('A');
    expect(outcome.oddsKey).toBeUndefined();
  });

  it('loses A=9 against 523', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'A',
      betContent: { slatProductId: 1, numbers: '9', betType: 'A' },
      result: draw('523'),
      cfg,
    });
    expect(outcome.won).toBe(false);
  });
});

describe('SlatDigit3Mechanic — group Slat-2D', () => {
  const cfg = cfg3([SLAT_2D]);

  it('wins BC digits 23 against 123 with fixed prize 1000', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'BC',
      betContent: { slatProductId: 2, numbers: '23', betType: 'BC' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(1000);
    expect(outcome.prizeLevel).toBe('BC');
    expect(outcome.oddsKey).toBeUndefined();
  });

  it('wins AB digits 12 against 123 with fixed prize 1000', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'AB',
      betContent: { slatProductId: 2, numbers: '12', betType: 'AB' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(1000);
    expect(outcome.prizeLevel).toBe('AB');
  });

  it('loses BC digits 99 against 123', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'BC',
      betContent: { slatProductId: 2, numbers: '99', betType: 'BC' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(false);
  });
});

describe('SlatDigit3Mechanic — ladder Slat-3D Rs.25 (top-tier-only)', () => {
  const cfg = cfg3([SLAT_3D_R25]);

  it('awards ABC 10000 for an exact match and never sums tiers', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 4, numbers: '123' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(10000);
    expect(outcome.prizeLevel).toBe('ABC');
    expect(outcome.fixedWin).not.toBe(10000 + 500 + 50);
  });

  it('awards BC 500 when only B and C match', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 4, numbers: '923' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(500);
    expect(outcome.prizeLevel).toBe('BC');
  });

  it('awards C 50 when only C matches', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 4, numbers: '993' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(50);
    expect(outcome.prizeLevel).toBe('C');
  });

  it('loses 999 against 123', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 4, numbers: '999' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(false);
  });
});

describe('SlatDigit5Mechanic — ladder Slat-4D Rs.100 (top-tier-only)', () => {
  const cfg = cfg5([SLAT_4D_R100]);

  it('awards xABC 500000 for an exact 4-digit match', () => {
    const outcome = SlatDigit5Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 5, numbers: '1234' },
      result: draw('1234'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(500000);
    expect(outcome.prizeLevel).toBe('xABC');
  });

  it('awards ABC 10000 when leading digit misses', () => {
    const outcome = SlatDigit5Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 5, numbers: '9234' },
      result: draw('1234'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(10000);
    expect(outcome.prizeLevel).toBe('ABC');
  });

  it('awards BC 1000 when only last two match', () => {
    const outcome = SlatDigit5Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 5, numbers: '9934' },
      result: draw('1234'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(1000);
    expect(outcome.prizeLevel).toBe('BC');
  });

  it('awards C 100 when only the last digit matches', () => {
    const outcome = SlatDigit5Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 5, numbers: '9994' },
      result: draw('1234'),
      cfg,
    });
    expect(outcome.won).toBe(true);
    expect(outcome.fixedWin).toBe(100);
    expect(outcome.prizeLevel).toBe('C');
  });
});

describe('SlatDigit3Mechanic — zero-prize C tier on Slat-3D Rs.10', () => {
  const cfg = cfg3([SLAT_3D_R10]);

  it('reports prizeLevel C and fixedWin 0 but settles as a loss', () => {
    const outcome = SlatDigit3Mechanic.evaluate({
      betType: 'ladder',
      betContent: { slatProductId: 3, numbers: '993' },
      result: draw('123'),
      cfg,
    });
    expect(outcome.won).toBe(false);
    expect(outcome.fixedWin).toBe(0);
    expect(outcome.prizeLevel).toBe('C');
    expect(outcome.oddsKey).toBeUndefined();
  });
});
