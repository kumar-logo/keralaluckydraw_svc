import { GameMechanic, EvalOutcome, DrawResult } from './mechanic.types';
import {
  GameMechanicsConfig,
  Rng,
  defaultRng,
  rngInt,
  FAMILY_DEFAULTS,
} from '../game-config.types';

function numericPrizeBounds(cfg: GameMechanicsConfig): [number, number] {
  const min = Number(cfg.minPrize);
  const max = Number(cfg.maxPrize);
  return [Number.isNaN(min) ? 1 : min, Number.isNaN(max) ? 100 : max];
}

export const CustomMechanic: GameMechanic = {
  family: 'custom',
  defaults: FAMILY_DEFAULTS.custom,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    const [min, max] = numericPrizeBounds(cfg);
    const prize = rngInt(rng, min, max);
    return { drawResult: String(prize), prize };
  },

  evaluate(): EvalOutcome {
    return { won: false };
  },

  enumerateCandidates(cfg: GameMechanicsConfig): DrawResult[] {
    const [min, max] = numericPrizeBounds(cfg);
    return [
      { drawResult: String(min), prize: min },
      { drawResult: String(max), prize: max },
    ];
  },
};
