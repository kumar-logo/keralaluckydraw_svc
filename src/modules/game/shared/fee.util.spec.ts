import { computeNetWin } from './fee.util';

describe('computeNetWin', () => {
  it('returns gross when no fee', () => {
    expect(computeNetWin(1000, 0, 0)).toBe(1000);
  });

  it('applies a percentage fee', () => {
    expect(computeNetWin(1000, 0.05, 0)).toBe(950);
  });

  it('applies a fixed fee', () => {
    expect(computeNetWin(1000, 0, 50)).toBe(950);
  });

  it('applies percentage plus fixed fee', () => {
    expect(computeNetWin(1000, 0.05, 10)).toBe(940);
  });

  it('never deducts more than the win', () => {
    expect(computeNetWin(100, 2, 0)).toBe(0);
    expect(computeNetWin(100, 0, 500)).toBe(0);
  });

  it('ignores negative deductions', () => {
    expect(computeNetWin(100, -0.5, 0)).toBe(100);
  });

  it('rounds to 2 decimals', () => {
    expect(computeNetWin(333.33, 0.1, 0)).toBe(300);
  });
});
