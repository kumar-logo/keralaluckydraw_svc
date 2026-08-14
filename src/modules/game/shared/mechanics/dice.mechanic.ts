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
import { sumSize, parity } from '../result-mapping';

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

function build(dice: number[], cfg: GameMechanicsConfig): DrawResult {
  const sum = dice.reduce((a, b) => a + b, 0);
  const isTriple = dice.length > 0 && dice.every((d) => d === dice[0]);
  return {
    dice,
    sum,
    sizeType: sumSize(sum, cfg.bigSmallThreshold ?? 10),
    parityType: parity(sum),
    isTriple,
    drawResult: dice.join(','),
  };
}

export const DiceMechanic: GameMechanic = {
  family: 'dice',
  defaults: FAMILY_DEFAULTS.dice,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    const count = cfg.diceCount ?? 3;
    const faces = cfg.diceFaces ?? 6;
    const dice = Array.from({ length: count }, () => rngInt(rng, 1, faces));
    return build(dice, cfg);
  },

  evaluate({
    betContent,
    betType,
    result,
    cfg,
  }: MechanicEvalInput): EvalOutcome {
    const dice = result?.dice;
    if (!Array.isArray(dice) || dice.length === 0) return { won: false };

    const sum = dice.reduce((a, b) => a + b, 0);
    const isTriple = dice.every((d) => d === dice[0]);
    const threshold = cfg.bigSmallThreshold ?? 10;
    const code = String(betCodeOf(betContent, betType));

    let won = false;
    if (code.startsWith('sum_')) {
      const suffix = code.substring(4);
      if (suffix === 'big') won = !isTriple && sum > threshold;
      else if (suffix === 'small') won = !isTriple && sum <= threshold;
      else if (suffix === 'odd') won = !isTriple && sum % 2 === 1;
      else if (suffix === 'even') won = !isTriple && sum % 2 === 0;
      else {
        const target = nameToNum(suffix);
        if (target >= 3 && target <= 18) won = sum === target;
      }
    } else if (code.startsWith('single_')) {
      won = dice.includes(nameToNum(code.substring(7)));
    } else if (code.startsWith('double_')) {
      const die = nameToNum(code.substring(7));
      won = dice.filter((d) => d === die).length >= 2;
    } else if (code.startsWith('leopard_')) {
      const suffix = code.substring(8);
      if (suffix === 'any') won = isTriple;
      else won = isTriple && dice[0] === nameToNum(suffix);
    }

    return { won, oddsKey: code };
  },

  enumerateCandidates(cfg: GameMechanicsConfig): DrawResult[] {
    const count = cfg.diceCount ?? 3;
    const faces = cfg.diceFaces ?? 6;
    const out: DrawResult[] = [];
    if (count === 3) {
      for (let a = 1; a <= faces; a++) {
        for (let b = a; b <= faces; b++) {
          for (let c = b; c <= faces; c++) out.push(build([a, b, c], cfg));
        }
      }
      return out;
    }
    const combo: number[] = [];
    const rec = (start: number, depth: number) => {
      if (depth === count) {
        out.push(build([...combo], cfg));
        return;
      }
      for (let v = start; v <= faces; v++) {
        combo.push(v);
        rec(v, depth + 1);
        combo.pop();
      }
    };
    rec(1, 0);
    return out;
  },
};
