import { GameMechanicsConfig, Rng } from '../game-config.types';

export type DrawPrizeEntry =
  | string
  | string[]
  | { code?: string | number; codes?: Array<string | number> };

export interface DrawPrizes {
  first?: DrawPrizeEntry;
  second?: DrawPrizeEntry;
  third?: DrawPrizeEntry;
  fourth?: DrawPrizeEntry;
  fifth?: DrawPrizeEntry;
  consolation?: DrawPrizeEntry;
  [tier: string]: DrawPrizeEntry | undefined;
}

export interface DrawResult {
  drawResult: string;
  number?: string | number;
  digits?: number[];
  dice?: number[];
  positions?: number[];
  runnerCount?: number;
  sum?: number;
  prize?: number;
  prizes?: DrawPrizes;
  [key: string]: unknown;
}

export type MechanicResult = Partial<DrawResult>;

export interface EvalOutcome {
  won: boolean;
  oddsKey?: string;
  prizeLevel?: string;
  fixedWin?: number;
}

export interface MechanicBetContent {
  betType?: string | number;
  betCode?: string;
  betNum?: string;
  betItem?: string;
  ticketCode?: string;
  numbers?: string;
  codes?: string[];
  positions?: number[];
  slatProductId?: string | number;
}

export interface MechanicEvalInput {
  betType: string;
  betContent: MechanicBetContent;
  result: MechanicResult;
  cfg: GameMechanicsConfig;
}

export interface EnumerateOptions {
  rng?: Rng;
  sampleSize?: number;
  targets?: string[];
}

export interface GameMechanic {
  family: string;

  generate(cfg: GameMechanicsConfig, rng?: Rng): DrawResult;

  evaluate(input: MechanicEvalInput): EvalOutcome;

  enumerateCandidates(
    cfg: GameMechanicsConfig,
    opts?: EnumerateOptions,
  ): DrawResult[];

  defaults: GameMechanicsConfig;
}

export const GAME_MECHANIC = 'GAME_MECHANIC';

export function betCodeOf(
  betContent: MechanicBetContent | null | undefined,
  betType: string,
): string {
  return (
    betContent?.betCode ||
    betContent?.betNum ||
    betContent?.betItem ||
    betType ||
    ''
  );
}
