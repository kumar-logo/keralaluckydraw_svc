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
import { colorsForNumber, colorSize } from '../result-mapping';

function build(number: number, cfg: GameMechanicsConfig): DrawResult {
  const colors = colorsForNumber(number, cfg.colorMap);
  return {
    number,
    color: colors[0] ?? '',
    colors,
    sizeType: colorSize(number, cfg.bigSmallThreshold ?? 5),
    drawResult: String(number),
  };
}

export const ColorMechanic: GameMechanic = {
  family: 'color',
  defaults: FAMILY_DEFAULTS.color,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    if (cfg.numbers && cfg.numbers.length > 0) {
      return build(cfg.numbers[rngInt(rng, 0, cfg.numbers.length - 1)], cfg);
    }
    const [lo, hi] = cfg.numberRange ?? [0, 9];
    return build(rngInt(rng, lo, hi), cfg);
  },

  evaluate({
    betContent,
    betType,
    result,
    cfg,
  }: MechanicEvalInput): EvalOutcome {
    const number = Number(result?.number);
    if (Number.isNaN(number)) return { won: false };

    const colors = colorsForNumber(number, cfg.colorMap);
    const size = colorSize(number, cfg.bigSmallThreshold ?? 5);
    const code = String(betCodeOf(betContent, betType)).toLowerCase();

    if (code === 'green' || code === 'red' || code === 'violet') {
      const won = colors.includes(code);
      const oddsKey =
        (code === 'green' || code === 'red') && colors.includes('violet')
          ? `${code}_violet`
          : code;
      return { won, oddsKey };
    }
    if (code === 'big' || code === 'small') {
      return { won: size === code, oddsKey: code };
    }
    const n = parseInt(code, 10);
    if (!Number.isNaN(n)) {
      return { won: number === n, oddsKey: 'number' };
    }
    return { won: false };
  },

  enumerateCandidates(cfg: GameMechanicsConfig): DrawResult[] {
    if (cfg.numbers && cfg.numbers.length > 0) {
      return cfg.numbers.map((n) => build(n, cfg));
    }
    const [lo, hi] = cfg.numberRange ?? [0, 9];
    const out: DrawResult[] = [];
    for (let i = lo; i <= hi; i++) out.push(build(i, cfg));
    return out;
  },
};
