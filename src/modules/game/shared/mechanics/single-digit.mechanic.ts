import {
  GameMechanic,
  MechanicEvalInput,
  EvalOutcome,
  DrawResult,
  betCodeOf,
} from './mechanic.types';
import {
  GameMechanicsConfig,
  Rng,
  defaultRng,
  rngInt,
  FAMILY_DEFAULTS,
} from '../game-config.types';

function build(n: number): DrawResult {
  return { number: String(n), digits: [n], drawResult: String(n) };
}

export const SingleDigitMechanic: GameMechanic = {
  family: 'single_digit',
  defaults: FAMILY_DEFAULTS.single_digit,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    const [lo, hi] = cfg.numberRange ?? [1, 9];
    return build(rngInt(rng, lo, hi));
  },

  evaluate({ betType, betContent, result }: MechanicEvalInput): EvalOutcome {
    const resultNum = Number(result?.number ?? result?.drawResult);
    const code = String(betCodeOf(betContent, betType));
    const picked = parseInt(code, 10);
    if (Number.isNaN(resultNum) || Number.isNaN(picked)) return { won: false };
    return { won: resultNum === picked, oddsKey: `number_${picked}` };
  },

  enumerateCandidates(cfg: GameMechanicsConfig): DrawResult[] {
    const [lo, hi] = cfg.numberRange ?? [1, 9];
    const out: DrawResult[] = [];
    for (let i = lo; i <= hi; i++) out.push(build(i));
    return out;
  },
};
