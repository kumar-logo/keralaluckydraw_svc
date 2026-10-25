import {
  GameMechanic,
  MechanicEvalInput,
  EvalOutcome,
  DrawResult,
  EnumerateOptions,
} from './mechanic.types';
import { GameMechanicsConfig, Rng } from '../game-config.types';
import { slatBetTier } from '../slat-reading.util';
import { makeDigitMechanic } from './digit.mechanic';

function evaluateSlat({
  betContent,
  result,
  cfg,
}: MechanicEvalInput): EvalOutcome {
  const drawn = result.drawResult;
  if (drawn === undefined) {
    throw new Error('Slat evaluation requires a drawResult');
  }
  const products = cfg.slatProducts;
  if (products === undefined) {
    throw new Error('Slat evaluation requires the game slat products');
  }
  const product = products.find(
    (p) => p.id === Number(betContent.slatProductId),
  );
  if (product === undefined) return { won: false };

  const tier = slatBetTier(product, String(betContent.betType));
  if (tier === undefined) return { won: false };

  const numbers = betContent.numbers;
  if (numbers === undefined || numbers.length !== tier.positions.length) {
    return { won: false };
  }
  const exact = tier.positions.every(
    (position, index) => drawn[position] === numbers[index],
  );
  if (!exact || tier.winAmount <= 0) return { won: false };
  return { won: true, fixedWin: tier.winAmount, prizeLevel: tier.label };
}

function makeSlatMechanic(family: string): GameMechanic {
  const base = makeDigitMechanic(family);
  return {
    family,
    defaults: base.defaults,
    generate(cfg: GameMechanicsConfig, rng?: Rng): DrawResult {
      return base.generate(cfg, rng);
    },
    enumerateCandidates(
      cfg: GameMechanicsConfig,
      opts?: EnumerateOptions,
    ): DrawResult[] {
      return base.enumerateCandidates(cfg, opts);
    },
    evaluate(input: MechanicEvalInput): EvalOutcome {
      const isSlatBet = input.betContent?.slatProductId != null;
      return isSlatBet ? evaluateSlat(input) : base.evaluate(input);
    },
  };
}

export const SlatDigit3Mechanic: GameMechanic = makeSlatMechanic('digit3');
export const SlatDigit5Mechanic: GameMechanic = makeSlatMechanic('digit5');
