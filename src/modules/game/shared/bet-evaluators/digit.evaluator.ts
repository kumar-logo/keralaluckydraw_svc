import {
  BetContent,
  DigitResult,
  LotteryResult,
} from './bet-evaluator.types';

export function evaluateDigitBet(
  betType: string,
  betContent: BetContent,
  result: DigitResult,
): boolean {
  const resultDigits: number[] = result.digits;
  const resultNumber: string = result.number;
  if (!resultDigits || !resultNumber) return false;

  const code = betContent?.betCode || betContent?.betNum || betType || '';
  const betCodes: string[] =
    betContent?.codes ||
    (typeof code === 'string' && code.length > 0 ? [code] : []);

  for (const ticket of betCodes) {
    if (
      evaluateSingleDigitTicket(ticket, resultDigits, resultNumber, betType)
    ) {
      return true;
    }
  }

  if (betCodes.length === 0) {
    return evaluateSingleDigitTicket(code, resultDigits, resultNumber, betType);
  }

  return false;
}

function evaluateSingleDigitTicket(
  ticket: string,
  resultDigits: number[],
  resultNumber: string,
  betType: string,
): boolean {
  if (betType === 'straight' || betType === 'exact') {
    return ticket === resultNumber;
  }

  if (betType === 'box' || betType === 'any_order') {
    const sortedTicket = ticket.split('').sort().join('');
    const sortedResult = resultNumber.split('').sort().join('');
    return sortedTicket === sortedResult;
  }

  if (betType === 'front_pair' || betType === 'first2') {
    return ticket === resultNumber.substring(0, 2);
  }

  if (betType === 'back_pair' || betType === 'last2') {
    return ticket === resultNumber.substring(resultNumber.length - 2);
  }

  if (betType === 'single_digit') {
    const pos = parseInt(ticket.charAt(0), 10);
    const digit = parseInt(ticket.charAt(1), 10);
    if (pos >= 0 && pos < resultDigits.length) {
      return resultDigits[pos] === digit;
    }
  }

  if (betType === 'sum') {
    const targetSum = parseInt(ticket, 10);
    const actualSum = resultDigits.reduce((a, b) => a + b, 0);
    return targetSum === actualSum;
  }

  if (ticket === resultNumber) return true;

  return false;
}

export function evaluateLotteryTicket(
  ticketCode: string,
  result: LotteryResult,
): { won: boolean; prizeLevel?: string; multiplier?: number } {
  const prizes = result.prizes;
  if (!prizes) {
    if (result.number === ticketCode) {
      return { won: true, prizeLevel: 'first', multiplier: 1 };
    }
    return { won: false };
  }

  if (prizes.first === ticketCode) {
    return { won: true, prizeLevel: 'first', multiplier: 1 };
  }
  if (prizes.second === ticketCode) {
    return { won: true, prizeLevel: 'second', multiplier: 1 };
  }
  if (Array.isArray(prizes.third) && prizes.third.includes(ticketCode)) {
    return { won: true, prizeLevel: 'third', multiplier: 1 };
  }
  if (Array.isArray(prizes.fourth) && prizes.fourth.includes(ticketCode)) {
    return { won: true, prizeLevel: 'fourth', multiplier: 1 };
  }
  if (Array.isArray(prizes.fifth) && prizes.fifth.includes(ticketCode)) {
    return { won: true, prizeLevel: 'fifth', multiplier: 1 };
  }
  if (
    Array.isArray(prizes.consolation) &&
    prizes.consolation.includes(ticketCode)
  ) {
    return { won: true, prizeLevel: 'consolation', multiplier: 1 };
  }

  const lastN = [4, 3, 2, 1];
  for (const n of lastN) {
    const resultLast = (prizes.first as string).slice(-n);
    const ticketLast = ticketCode.slice(-n);
    if (resultLast === ticketLast && n < ticketCode.length) {
      return { won: true, prizeLevel: `last${n}`, multiplier: 1 };
    }
  }

  return { won: false };
}
