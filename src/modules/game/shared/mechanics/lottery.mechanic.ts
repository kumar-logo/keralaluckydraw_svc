import {
  GameMechanic,
  MechanicEvalInput,
  EvalOutcome,
  DrawResult,
  DrawPrizes,
  EnumerateOptions,
} from './mechanic.types';
import {
  GameMechanicsConfig,
  Rng,
  defaultRng,
  rngInt,
  FAMILY_DEFAULTS,
} from '../game-config.types';

const TIERS = ['first', 'second', 'third', 'fourth', 'fifth', 'consolation'];

function tierCodes(prizes: DrawPrizes | undefined, tier: string): string[] {
  const v = prizes?.[tier];
  if (v == null) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'object') {
    if (Array.isArray(v.codes)) return v.codes.map(String);
    if (v.code != null) return [String(v.code)];
  }
  return [];
}

function randomNumber(len: number, rng: Rng): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String(rngInt(rng, 0, 9));
  return s;
}

function uniqueNumbers(count: number, len: number, rng: Rng): string[] {
  const set = new Set<string>();
  let guard = 0;
  while (set.size < count && guard < count * 20) {
    set.add(randomNumber(len, rng));
    guard++;
  }
  return Array.from(set);
}

function buildPrizes(cfg: GameMechanicsConfig, rng: Rng): DrawResult {
  const len = cfg.ticketLength ?? 6;
  const pc = cfg.prizeCounts ?? {};
  const first = randomNumber(len, rng);
  const prizes: Record<string, string | string[]> = {
    first,
    second: randomNumber(len, rng),
    third: uniqueNumbers(pc.third ?? 2, len, rng),
    fourth: uniqueNumbers(pc.fourth ?? 10, len, rng),
    fifth: uniqueNumbers(pc.fifth ?? 10, len, rng),
    consolation: uniqueNumbers(pc.consolation ?? 10, len, rng),
  };
  return { prizes, drawResult: first };
}

export const LotteryMechanic: GameMechanic = {
  family: 'lottery',
  defaults: FAMILY_DEFAULTS.lottery,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    return buildPrizes(cfg, rng);
  },

  evaluate({ betContent, result, cfg }: MechanicEvalInput): EvalOutcome {
    const ticket = String(
      betContent?.numbers ??
        betContent?.betCode ??
        betContent?.ticketCode ??
        '',
    );
    if (!ticket) return { won: false };

    const rules = cfg?.prizeMatchRules;
    const win = (tier: string): EvalOutcome => {
      const fixedWin = rules?.[tier];
      return fixedWin != null
        ? { won: true, prizeLevel: tier, oddsKey: tier, fixedWin }
        : { won: true, prizeLevel: tier, oddsKey: tier };
    };

    const prizes = result?.prizes;
    if (!prizes) {
      const rn = String(result?.number ?? result?.drawResult ?? '');
      if (!rn) return { won: false };
      if (rn === ticket) return win('first');
      for (const n of [4, 3, 2, 1]) {
        if (n < ticket.length && rn.slice(-n) === ticket.slice(-n)) {
          return win(`last${n}`);
        }
      }
      return { won: false };
    }

    for (const tier of TIERS) {
      if (tierCodes(prizes, tier).includes(ticket)) {
        return win(tier);
      }
    }

    const first = tierCodes(prizes, 'first')[0];
    if (first) {
      for (const n of [4, 3, 2, 1]) {
        if (n < ticket.length && first.slice(-n) === ticket.slice(-n)) {
          return win(`last${n}`);
        }
      }
    }
    return { won: false };
  },

  enumerateCandidates(
    cfg: GameMechanicsConfig,
    opts?: EnumerateOptions,
  ): DrawResult[] {
    const rng = opts?.rng ?? defaultRng;
    const len = cfg.ticketLength ?? 6;
    const sampleSize = opts?.sampleSize ?? 200;
    const out: DrawResult[] = [];
    for (const t of opts?.targets ?? []) {
      const padded = String(t).padStart(len, '0').slice(-len);
      const r = buildPrizes(cfg, rng);
      if (r.prizes) r.prizes.first = padded;
      r.drawResult = padded;
      out.push(r);
    }
    for (let i = 0; i < sampleSize; i++) out.push(buildPrizes(cfg, rng));
    return out;
  },
};
