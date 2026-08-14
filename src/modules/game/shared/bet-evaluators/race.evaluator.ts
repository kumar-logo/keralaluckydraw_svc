import { BetContent, RaceResult } from './bet-evaluator.types';

export function evaluateRaceBet(
  betType: string,
  betContent: BetContent,
  result: RaceResult,
): boolean {
  const positions: number[] = result.positions;
  if (!positions || positions.length < 3) return false;

  const champion = positions[0];
  const second = positions[1];
  const third = positions[2];
  const top3 = [champion, second, third];
  const code = betContent?.betCode || betContent?.betNum || betType || '';

  const runnerCount = result.runnerCount || positions.length;
  const bigSmallThreshold = Math.floor(runnerCount / 2);

  if (code.startsWith('champion_')) {
    const runner = parseInt(code.substring(9), 10);
    return champion === runner;
  }

  if (code.startsWith('second_')) {
    const runner = parseInt(code.substring(7), 10);
    return second === runner;
  }

  if (code.startsWith('third_')) {
    const runner = parseInt(code.substring(6), 10);
    return third === runner;
  }

  if (code.startsWith('top3_')) {
    const runner = parseInt(code.substring(5), 10);
    return top3.includes(runner);
  }

  if (code === 'big') return champion > bigSmallThreshold;
  if (code === 'small') return champion <= bigSmallThreshold;
  if (code === 'odd') return champion % 2 === 1;
  if (code === 'even') return champion % 2 === 0;

  if (code.startsWith('runner_') && code.includes('_pos_')) {
    const parts = code.split('_');
    const runner = parseInt(parts[1], 10);
    const pos = parseInt(parts[3], 10);
    return positions[pos - 1] === runner;
  }

  return false;
}

export function getRaceDefaultOdds(betCode: string): number {
  if (betCode.startsWith('champion_')) return 9.5;
  if (betCode.startsWith('second_')) return 9.5;
  if (betCode.startsWith('third_')) return 9.5;
  if (betCode.startsWith('top3_')) return 3;
  if (betCode === 'big' || betCode === 'small') return 2;
  if (betCode === 'odd' || betCode === 'even') return 2;
  return 0;
}
