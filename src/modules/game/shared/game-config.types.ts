import { ColorMap, DEFAULT_COLOR_MAP } from './result-mapping';
import { SlatMatchMode } from '../../../common/enums';

export interface Rng {
  next(): number;
}

export interface SlatTierView {
  label: string;
  positions: number[];
  winAmount: number;
  tierRank: number;
}

export interface SlatProductView {
  id?: number;
  digitCount: number;
  price: number;
  matchMode: SlatMatchMode;
  title: string;
  status: number;
  tiers: SlatTierView[];
}

export const defaultRng: Rng = { next: () => Math.random() };

export function rngInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export interface RacePhysicsConfig {
  fps: number;
  finishLineBase: number;
  finishLineJitter: number;
  winnerTargetFrameBase: number;
  winnerTargetFrameJitter: number;
  maxFrames: number;
  itemTwoProbability: number;
  speedModMin: number;
  speedModRange: number;
}

export interface PrizeCounts {
  second?: number;
  third?: number;
  fourth?: number;
  fifth?: number;
  consolation?: number;
}

export interface BetMatchRule {
  match:
    | 'exact'
    | 'box'
    | 'prefix'
    | 'suffix'
    | 'position'
    | 'sum'
    | 'size'
    | 'parity';
  len?: number;
  pos?: number;
  side?: 'big' | 'small';
  par?: 'odd' | 'even';
}

export interface GameMechanicsConfig {
  family: string;
  colorMap?: ColorMap;
  bigSmallThreshold?: number;
  numberRange?: [number, number];
  numbers?: number[];
  diceCount?: number;
  diceFaces?: number;
  runnerCount?: number;
  racePhysics?: RacePhysicsConfig;
  digitCount?: number;
  ticketLength?: number;
  prizeCounts?: PrizeCounts;
  payRate?: { type: number | string; key?: string; odds: number }[];
  slatProducts?: SlatProductView[];
  prizeMatchRules?: Record<string, number>;
  raceTypeMap?: Record<number, string>;
  betTypeRules?: Record<string, BetMatchRule>;
  minPrize?: number;
  maxPrize?: number;
  [key: string]: unknown;
}

export const DEFAULT_RACE_PHYSICS: RacePhysicsConfig = {
  fps: 30,
  finishLineBase: 1100,
  finishLineJitter: 120,
  winnerTargetFrameBase: 390,
  winnerTargetFrameJitter: 15,
  maxFrames: 600,
  itemTwoProbability: 0.4,
  speedModMin: 0.65,
  speedModRange: 0.7,
};

export const FAMILY_DEFAULTS: Record<string, GameMechanicsConfig> = {
  color: {
    family: 'color',
    colorMap: DEFAULT_COLOR_MAP,
    bigSmallThreshold: 5,
    numberRange: [0, 9],
  },
  dice: { family: 'dice', diceCount: 3, diceFaces: 6, bigSmallThreshold: 10 },
  race: { family: 'race', runnerCount: 6, racePhysics: DEFAULT_RACE_PHYSICS },
  digit3: { family: 'digit3', digitCount: 3, bigSmallThreshold: 13 },
  digit5: { family: 'digit5', digitCount: 5, bigSmallThreshold: 23 },
  single_digit: { family: 'single_digit', numberRange: [1, 36] },
  lottery: {
    family: 'lottery',
    ticketLength: 6,
    prizeCounts: { third: 2, fourth: 10, fifth: 10, consolation: 10 },
  },
  lottery_punjab: { family: 'lottery_punjab', digitCount: 6 },
  custom: { family: 'custom' },
};
