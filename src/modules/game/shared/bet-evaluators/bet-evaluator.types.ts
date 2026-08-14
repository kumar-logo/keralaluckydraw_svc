export interface BetContent {
  betCode?: string;
  betNum?: string;
  betItem?: string;
  codes?: string[];
}

export interface ColorResult {
  number: number;
}

export interface DiceResult {
  dice: number[];
}

export interface RaceResult {
  positions: number[];
  runnerCount?: number;
}

export interface DigitResult {
  digits: number[];
  number: string;
}

export interface LotteryPrizes {
  first?: string;
  second?: string;
  third?: string[];
  fourth?: string[];
  fifth?: string[];
  consolation?: string[];
}

export interface LotteryResult {
  number?: string;
  prizes?: LotteryPrizes;
}
