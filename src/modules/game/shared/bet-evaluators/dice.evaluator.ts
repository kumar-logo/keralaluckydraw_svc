import { BetContent, DiceResult } from './bet-evaluator.types';

const NUM_NAMES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
];

function nameToNum(name: string): number {
  const idx = NUM_NAMES.indexOf(name);
  return idx >= 0 ? idx : parseInt(name, 10) || 0;
}

export function evaluateDiceBet(
  betType: string,
  betContent: BetContent,
  result: DiceResult,
  bigSmallThreshold = 10,
): boolean {
  const dice: number[] = result.dice;
  const sum = dice[0] + dice[1] + dice[2];
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  const code = betContent?.betCode || betContent?.betNum || betType || '';

  if (code.startsWith('sum_')) {
    const suffix = code.substring(4);
    if (suffix === 'big') return !isTriple && sum > bigSmallThreshold;
    if (suffix === 'small') return !isTriple && sum <= bigSmallThreshold;
    if (suffix === 'odd') return !isTriple && sum % 2 === 1;
    if (suffix === 'even') return !isTriple && sum % 2 === 0;
    const targetSum = nameToNum(suffix);
    if (targetSum >= 3 && targetSum <= 18) return sum === targetSum;
  }

  if (code.startsWith('single_')) {
    const targetDie = nameToNum(code.substring(7));
    return dice.includes(targetDie);
  }

  if (code.startsWith('double_')) {
    const targetDie = nameToNum(code.substring(7));
    const count = dice.filter((d) => d === targetDie).length;
    return count >= 2;
  }

  if (code.startsWith('leopard_')) {
    const suffix = code.substring(8);
    if (suffix === 'any') return isTriple;
    const targetDie = nameToNum(suffix);
    return isTriple && dice[0] === targetDie;
  }

  return false;
}

const DEFAULT_DICE_ODDS: Record<string, number> = {
  sum_big: 2,
  sum_small: 2,
  sum_odd: 2,
  sum_even: 2,
  sum_three: 150,
  sum_four: 50,
  sum_five: 30,
  sum_six: 18,
  sum_seven: 12,
  sum_eight: 8,
  sum_nine: 7,
  sum_ten: 6,
  sum_eleven: 6,
  sum_twelve: 7,
  sum_thirteen: 8,
  sum_fourteen: 12,
  sum_fifteen: 18,
  sum_sixteen: 30,
  sum_seventeen: 50,
  sum_eighteen: 150,
  single_one: 1.5,
  single_two: 1.5,
  single_three: 1.5,
  single_four: 1.5,
  single_five: 1.5,
  single_six: 1.5,
  double_one: 11,
  double_two: 11,
  double_three: 11,
  double_four: 11,
  double_five: 11,
  double_six: 11,
  leopard_any: 30,
  leopard_one: 180,
  leopard_two: 180,
  leopard_three: 180,
  leopard_four: 180,
  leopard_five: 180,
  leopard_six: 180,
};

export function getDiceDefaultOdds(betCode: string): number {
  return DEFAULT_DICE_ODDS[betCode] || 0;
}
