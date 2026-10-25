import {
  decodeSlatReading,
  slatBetTier,
  slatPayableTiers,
  slatTopTier,
} from './slat-reading.util';
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

  it('lists only the payable tier of each ladder slot', () => {
    const reading = decodeSlatReading('1234', FOUR_FIVE);
    expect(
      reading.groups.map((g) => [
        g.productId,
        g.tierLabel,
        g.winningDigits,
        g.winAmount,
      ]),
    ).toEqual([
      [1, 'xABC', '1234', 100000],
      [2, 'xABC', '1234', 500000],
    ]);
  });

  it('decodes a 3-digit draw with A B C labels', () => {
    const reading = decodeSlatReading('123', THREE);
    expect(reading.labeled).toEqual([
      { index: 0, label: 'A', digit: '1' },
      { index: 1, label: 'B', digit: '2' },
      { index: 2, label: 'C', digit: '3' },
    ]);
    expect(reading.readingText).toBe('123-ABC');
    expect(reading.groups).toEqual([
      {
        productId: 10,
        title: 'Slat-3D Rs.10',
        matchMode: SlatMatchMode.Ladder,
        tierLabel: 'ABC',
        positions: [0, 1, 2],
        winningDigits: '123',
        winAmount: 5000,
      },
    ]);
  });
});

const GROUP: SlatProductView = {
  id: 20,
  digitCount: 3,
  price: 12,
  matchMode: SlatMatchMode.Group,
  title: 'Slat-2D',
  status: 1,
  tiers: [
    { label: 'AB', positions: [0, 1], winAmount: 1000, tierRank: 0 },
    { label: 'BC', positions: [1, 2], winAmount: 1000, tierRank: 0 },
  ],
};

describe('slat payable tiers', () => {
  it('a ladder slot pays only its highest-rank tier', () => {
    expect(slatTopTier(THREE[0])?.label).toBe('ABC');
    expect(slatPayableTiers(THREE[0]).map((tier) => tier.label)).toEqual([
      'ABC',
    ]);
    expect(slatBetTier(THREE[0], 'ABC')?.winAmount).toBe(5000);
    expect(slatBetTier(THREE[0], 'BC')).toBeUndefined();
    expect(slatBetTier(THREE[0], 'C')).toBeUndefined();
  });

  it('a group slot pays each of its tiers by label', () => {
    expect(slatPayableTiers(GROUP).map((tier) => tier.label)).toEqual([
      'AB',
      'BC',
    ]);
    expect(slatBetTier(GROUP, 'BC')?.positions).toEqual([1, 2]);
    expect(slatBetTier(GROUP, 'AC')).toBeUndefined();
  });

  it('a slot without tiers has nothing payable', () => {
    const empty: SlatProductView = {
      ...GROUP,
      matchMode: SlatMatchMode.Ladder,
      tiers: [],
    };
    expect(slatTopTier(empty)).toBeUndefined();
    expect(slatPayableTiers(empty)).toEqual([]);
    expect(slatBetTier(empty, 'AB')).toBeUndefined();
  });
});
