import { decodeSlatReading } from './slat-reading.util';
import { SlatMatchMode } from '../../../common/enums';
import { SlatProductView } from './game-config.types';

const FOUR_FIVE: SlatProductView[] = [
  {
    id: 1,
    digitCount: 4,
    price: 20,
    matchMode: SlatMatchMode.Ladder,
    title: 'Slat-4D Rs.20',
    status: 1,
    tiers: [
      {
        label: 'xABC',
        positions: [0, 1, 2, 3],
        winAmount: 100000,
        tierRank: 1,
      },
    ],
  },
  {
    id: 2,
    digitCount: 4,
    price: 100,
    matchMode: SlatMatchMode.Ladder,
    title: 'Slat-4D Rs.100',
    status: 1,
    tiers: [
      { label: 'C', positions: [3], winAmount: 100, tierRank: 1 },
      { label: 'BC', positions: [2, 3], winAmount: 1000, tierRank: 2 },
      { label: 'ABC', positions: [1, 2, 3], winAmount: 10000, tierRank: 3 },
      {
        label: 'xABC',
        positions: [0, 1, 2, 3],
        winAmount: 500000,
        tierRank: 4,
      },
    ],
  },
];

const THREE: SlatProductView[] = [
  {
    id: 10,
    digitCount: 3,
    price: 10,
    matchMode: SlatMatchMode.Ladder,
    title: 'Slat-3D Rs.10',
    status: 1,
    tiers: [
      { label: 'C', positions: [2], winAmount: 0, tierRank: 1 },
      { label: 'BC', positions: [1, 2], winAmount: 100, tierRank: 2 },
      { label: 'ABC', positions: [0, 1, 2], winAmount: 5000, tierRank: 3 },
    ],
  },
];

describe('decodeSlatReading', () => {
  it('decodes 1234 into x1 A2 B3 C4', () => {
    const reading = decodeSlatReading('1234', FOUR_FIVE);
    expect(reading.labeled).toEqual([
      { index: 0, label: 'x', digit: '1' },
      { index: 1, label: 'A', digit: '2' },
      { index: 2, label: 'B', digit: '3' },
      { index: 3, label: 'C', digit: '4' },
    ]);
    expect(reading.readingText).toBe('1234-xABC');
  });

  it('lists every winning group with its drawn digits and prize', () => {
    const reading = decodeSlatReading('1234', FOUR_FIVE);
    const abc = reading.groups.find(
      (g) => g.productId === 2 && g.tierLabel === 'ABC',
    );
    expect(abc?.winningDigits).toBe('234');
    expect(abc?.winAmount).toBe(10000);
    const c = reading.groups.find(
      (g) => g.productId === 2 && g.tierLabel === 'C',
    );
    expect(c?.winningDigits).toBe('4');
    expect(c?.winAmount).toBe(100);
    const jackpot = reading.groups.find((g) => g.productId === 1);
    expect(jackpot?.winningDigits).toBe('1234');
    expect(jackpot?.winAmount).toBe(100000);
  });

  it('decodes a 3-digit draw with A B C labels', () => {
    const reading = decodeSlatReading('123', THREE);
    expect(reading.labeled).toEqual([
      { index: 0, label: 'A', digit: '1' },
      { index: 1, label: 'B', digit: '2' },
      { index: 2, label: 'C', digit: '3' },
    ]);
    expect(reading.readingText).toBe('123-ABC');
    const bc = reading.groups.find((g) => g.tierLabel === 'BC');
    expect(bc?.winningDigits).toBe('23');
    expect(bc?.winAmount).toBe(100);
  });
});
