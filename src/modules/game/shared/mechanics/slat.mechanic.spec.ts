import { SlatDigit3Mechanic, SlatDigit5Mechanic } from './slat.mechanic';
import { GameMechanicsConfig, SlatProductView } from '../game-config.types';
import { MechanicBetContent, EvalOutcome } from './mechanic.types';
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

const SLAT_3D_R25: SlatProductView = {
  id: 3,
  digitCount: 3,
  price: 25,
  matchMode: SlatMatchMode.Ladder,
  title: 'Slat-3D',
  status: 1,
  tiers: [
    { label: 'ABC', positions: [0, 1, 2], winAmount: 12500, tierRank: 3 },
    { label: 'BC', positions: [1, 2], winAmount: 500, tierRank: 2 },
    { label: 'C', positions: [2], winAmount: 50, tierRank: 1 },
  ],
};

const SLAT_4D_R110: SlatProductView = {
  id: 4,
  digitCount: 4,
  price: 110,
  matchMode: SlatMatchMode.Ladder,
  title: 'Slat-10',
  status: 1,
  tiers: [
    { label: 'xABC', positions: [0, 1, 2, 3], winAmount: 500000, tierRank: 4 },
    { label: 'ABC', positions: [1, 2, 3], winAmount: 10000, tierRank: 3 },
    { label: 'BC', positions: [2, 3], winAmount: 1000, tierRank: 2 },
    { label: 'C', positions: [3], winAmount: 100, tierRank: 1 },
  ],
};

const SLAT_ZERO: SlatProductView = {
  id: 5,
  digitCount: 3,
  price: 10,
  matchMode: SlatMatchMode.Group,
  title: 'Slat-Zero',
  status: 1,
  tiers: [{ label: 'C', positions: [2], winAmount: 0, tierRank: 0 }],
};

const CFG3: GameMechanicsConfig = {
  family: 'digit3',
  digitCount: 3,
  slatProducts: [SLAT_1D, SLAT_2D, SLAT_3D_R25, SLAT_ZERO],
};

const CFG4: GameMechanicsConfig = {
  family: 'digit5',
  digitCount: 4,
  slatProducts: [SLAT_4D_R110],
};

const ticket = (
  slatProductId: number,
  betType: string,
  numbers: string,
): MechanicBetContent => ({ slatProductId, betType, numbers });

const play3 = (bet: MechanicBetContent, drawn: string): EvalOutcome =>
  SlatDigit3Mechanic.evaluate({
    betType: String(bet.betType),
    betContent: bet,
    result: { drawResult: drawn },
    cfg: CFG3,
  });

const play4 = (bet: MechanicBetContent, drawn: string): EvalOutcome =>
  SlatDigit5Mechanic.evaluate({
    betType: String(bet.betType),
    betContent: bet,
    result: { drawResult: drawn },
    cfg: CFG4,
  });

describe('slat ladder pays only an exact full-slot match', () => {
  it('pays ABC 12500 when all three digits match', () => {
    expect(play3(ticket(3, 'ABC', '123'), '123')).toEqual({
      won: true,
      fixedWin: 12500,
      prizeLevel: 'ABC',
    });
  });

  it('pays nothing when only B and C match', () => {
    expect(play3(ticket(3, 'ABC', '923'), '123')).toEqual({ won: false });
  });

  it('pays nothing when only C matches', () => {
    expect(play3(ticket(3, 'ABC', '993'), '123')).toEqual({ won: false });
  });

  it('pays nothing when no digit matches', () => {
    expect(play3(ticket(3, 'ABC', '999'), '123')).toEqual({ won: false });
  });

  it('rejects a lower ladder tier label as a ticket', () => {
    expect(play3(ticket(3, 'BC', '23'), '123')).toEqual({ won: false });
    expect(play3(ticket(3, 'C', '3'), '123')).toEqual({ won: false });
  });

  it('rejects an unknown label', () => {
    expect(play3(ticket(3, 'XYZ', '123'), '123')).toEqual({ won: false });
  });

  it('rejects numbers whose length differs from the slot', () => {
    expect(play3(ticket(3, 'ABC', '23'), '123')).toEqual({ won: false });
    expect(play3(ticket(3, 'ABC', '0123'), '123')).toEqual({ won: false });
  });

  it('pays xABC 500000 on a 4-digit exact match', () => {
    expect(play4(ticket(4, 'xABC', '1234'), '1234')).toEqual({
      won: true,
      fixedWin: 500000,
      prizeLevel: 'xABC',
    });
  });

  it('pays nothing on a 4-digit slot when only ABC, BC or C match', () => {
    expect(play4(ticket(4, 'xABC', '9234'), '1234')).toEqual({ won: false });
    expect(play4(ticket(4, 'xABC', '9934'), '1234')).toEqual({ won: false });
    expect(play4(ticket(4, 'xABC', '9994'), '1234')).toEqual({ won: false });
  });
});

describe('slat group pays only its own tier positions', () => {
  it('pays A 100 when the first digit matches', () => {
    expect(play3(ticket(1, 'A', '5'), '523')).toEqual({
      won: true,
      fixedWin: 100,
      prizeLevel: 'A',
    });
  });

  it('pays nothing when the digit appears only at another position', () => {
    expect(play3(ticket(1, 'A', '2'), '523')).toEqual({ won: false });
  });

  it('pays BC and AC 1000 on their exact positions', () => {
    expect(play3(ticket(2, 'BC', '23'), '123')).toEqual({
      won: true,
      fixedWin: 1000,
      prizeLevel: 'BC',
    });
    expect(play3(ticket(2, 'AC', '13'), '123')).toEqual({
      won: true,
      fixedWin: 1000,
      prizeLevel: 'AC',
    });
  });

  it('pays nothing for reversed or half-matching pairs', () => {
    expect(play3(ticket(2, 'BC', '32'), '123')).toEqual({ won: false });
    expect(play3(ticket(2, 'AB', '13'), '123')).toEqual({ won: false });
  });

  it('pays nothing on an exact match of a zero-prize tier', () => {
    expect(play3(ticket(5, 'C', '3'), '123')).toEqual({ won: false });
  });
});

describe('slat ticket integrity', () => {
  it('pays nothing for a slot that is not configured', () => {
    expect(play3(ticket(999, 'ABC', '123'), '123')).toEqual({ won: false });
  });

  it('throws when the draw has no drawResult', () => {
    expect(() =>
      SlatDigit3Mechanic.evaluate({
        betType: 'ABC',
        betContent: ticket(3, 'ABC', '123'),
        result: {},
        cfg: CFG3,
      }),
    ).toThrow('Slat evaluation requires a drawResult');
  });

  it('throws when the game config has no slat products', () => {
    expect(() =>
      SlatDigit3Mechanic.evaluate({
        betType: 'ABC',
        betContent: ticket(3, 'ABC', '123'),
        result: { drawResult: '123' },
        cfg: { family: 'digit3', digitCount: 3 },
      }),
    ).toThrow('Slat evaluation requires the game slat products');
  });
});
