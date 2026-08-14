import { BetContent, ColorResult } from './bet-evaluator.types';

const COLOR_MAP: Record<number, string[]> = {
  0: ['red', 'violet'],
  1: ['green'],
  2: ['red'],
  3: ['green'],
  4: ['red'],
  5: ['green', 'violet'],
  6: ['red'],
  7: ['green'],
  8: ['red'],
  9: ['green'],
};

export function evaluateColorBet(
  betType: string,
  betContent: BetContent,
  result: ColorResult,
  bigSmallThreshold = 5,
): boolean {
  const number = result.number as number;
  const colors = COLOR_MAP[number] || [];
  const sizeType = number >= bigSmallThreshold ? 'big' : 'small';
  const betNum = betContent?.betNum || betContent?.betCode || '';

  switch (betType) {
    case 'color':
      return colors.includes(betNum);

    case 'number':
      return number === parseInt(betNum, 10);

    case 'size':
      return sizeType === betNum;

    default:
      if (betNum === 'green' || betNum === 'red' || betNum === 'violet') {
        return colors.includes(betNum);
      }
      if (betNum === 'big' || betNum === 'small') {
        return sizeType === betNum;
      }
      if (!isNaN(parseInt(betNum, 10))) {
        return number === parseInt(betNum, 10);
      }
      return false;
  }
}

export function getColorOdds(
  betType: string,
  betContent: BetContent,
  result: ColorResult,
  oddsConfig?: Record<string, number>,
): number {
  const betNum = betContent?.betNum || betContent?.betCode || '';
  const oc = oddsConfig || {};

  if (betType === 'number' || !isNaN(parseInt(betNum, 10))) {
    return oc['number'] ?? oc['color_number'] ?? 9;
  }

  if (betNum === 'violet') {
    return oc['violet'] ?? oc['color_violet'] ?? 4.5;
  }

  if (betNum === 'green' || betNum === 'red') {
    const number = result.number as number;
    const colors = COLOR_MAP[number] || [];
    if (colors.includes('violet')) {
      return oc[`${betNum}_violet`] ?? oc[`color_${betNum}_violet`] ?? 1.5;
    }
    return oc[betNum] ?? oc[`color_${betNum}`] ?? 2;
  }

  if (betNum === 'big' || betNum === 'small') {
    return oc[betNum] ?? oc[`color_${betNum}`] ?? 2;
  }

  return 0;
}
