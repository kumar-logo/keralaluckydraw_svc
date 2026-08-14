import {
  GameMechanic,
  MechanicEvalInput,
  EvalOutcome,
  DrawResult,
  EnumerateOptions,
} from './mechanic.types';
import {
  GameMechanicsConfig,
  Rng,
  SlatProductView,
  SlatTierView,
} from '../game-config.types';
import { SlatMatchMode } from '../../../../common/enums';
import { makeDigitMechanic } from './digit.mechanic';

function drawnString(result: {
  number?: unknown;
  drawResult?: unknown;
}): string {
  return String(result?.number ?? result?.drawResult ?? '');
}

function positionsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildBetMap(
  positions: number[],
  numbers: string,
): Map<number, string> {
  const betMap = new Map<number, string>();
  for (let k = 0; k < positions.length; k++) {
    betMap.set(positions[k], numbers[k]);
  }
  return betMap;
}

function tierMatches(
  tier: SlatTierView,
  betMap: Map<number, string>,
  drawn: string,
): boolean {
  if (tier.positions.length === 0) return false;
  for (const position of tier.positions) {
    const betDigit = betMap.get(position);
    if (betDigit === undefined) return false;
    if (betDigit !== drawn[position]) return false;
  }
  return true;
}

function selectGroupTier(
  product: SlatProductView,
  betContent: { betType?: unknown; positions?: unknown },
): SlatTierView | undefined {
  const label = String(betContent?.betType ?? '');
  if (label) {
    const byLabel = product.tiers.find((tier) => tier.label === label);
    if (byLabel) return byLabel;
  }
  const positions = Array.isArray(betContent?.positions)
    ? (betContent.positions as number[]).map(Number)
    : null;
  if (positions) {
    return product.tiers.find((tier) =>
      positionsEqual(tier.positions, positions),
    );
  }
  return undefined;
}

function evaluateSlat({
  betContent,
  result,
  cfg,
}: MechanicEvalInput): EvalOutcome {
  const products: SlatProductView[] = cfg.slatProducts ?? [];
  const product = products.find((p) => p.id === betContent?.slatProductId);
  if (!product) return { won: false };

  const drawn = drawnString(result);
  const numbers = String(betContent?.numbers ?? '');
  if (!drawn || !numbers) return { won: false };

  if (product.matchMode === SlatMatchMode.Group) {
    const tier = selectGroupTier(product, betContent);
    if (!tier || tier.positions.length !== numbers.length) {
      return { won: false };
    }
    const betMap = buildBetMap(tier.positions, numbers);
    if (!tierMatches(tier, betMap, drawn)) return { won: false };
    return {
      won: tier.winAmount > 0,
      fixedWin: tier.winAmount,
      prizeLevel: tier.label,
    };
  }

  const ladder = [...product.tiers].sort((a, b) => b.tierRank - a.tierRank);
  const topTier = ladder[0];
  if (!topTier || topTier.positions.length !== numbers.length) {
    return { won: false };
  }
  const betMap = buildBetMap(topTier.positions, numbers);
  for (const tier of ladder) {
    if (tierMatches(tier, betMap, drawn)) {
      return {
        won: tier.winAmount > 0,
        fixedWin: tier.winAmount,
        prizeLevel: tier.label,
      };
    }
  }
  return { won: false };
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
