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
  defaultRng,
  rngInt,
  FAMILY_DEFAULTS,
  BetMatchRule,
} from '../game-config.types';

type MatchRule = BetMatchRule;

function sortStr(s: string): string {
  return s.split('').sort().join('');
}

function requireDigitCount(cfg: GameMechanicsConfig): number {
  if (cfg.digitCount == null) {
    throw new Error('digitCount is required in GameMechanicsConfig');
  }
  return cfg.digitCount;
}

function defaultRules(digitCount: number): Record<string, MatchRule> {
  const rules: Record<string, MatchRule> = {
    exact: { match: 'exact' },
    straight: { match: 'exact' },
    box: { match: 'box' },
    any_order: { match: 'box' },
    front2: { match: 'prefix', len: 2 },
    front_pair: { match: 'prefix', len: 2 },
    first2: { match: 'prefix', len: 2 },
    first1: { match: 'prefix', len: 1 },
    first3: { match: 'prefix', len: 3 },
    first4: { match: 'prefix', len: 4 },
    back2: { match: 'suffix', len: 2 },
    back_pair: { match: 'suffix', len: 2 },
    last2: { match: 'suffix', len: 2 },
    last1: { match: 'suffix', len: 1 },
    last3: { match: 'suffix', len: 3 },
    last4: { match: 'suffix', len: 4 },
    sum: { match: 'sum' },
    big: { match: 'size', side: 'big' },
    sum_big: { match: 'size', side: 'big' },
    small: { match: 'size', side: 'small' },
    sum_small: { match: 'size', side: 'small' },
    odd: { match: 'parity', par: 'odd' },
    sum_odd: { match: 'parity', par: 'odd' },
    even: { match: 'parity', par: 'even' },
    sum_even: { match: 'parity', par: 'even' },
    first: { match: 'position', pos: 0 },
    second: { match: 'position', pos: 1 },
    third: { match: 'position', pos: 2 },
    fourth: { match: 'position', pos: 3 },
    fifth: { match: 'position', pos: 4 },
  };
  for (let len = 1; len <= digitCount; len++) {
    rules[`exact${len}`] =
      len === digitCount ? { match: 'exact' } : { match: 'suffix', len };
    rules[`first${len}`] =
      len === digitCount ? { match: 'exact' } : { match: 'prefix', len };
  }
  rules['1'] = { match: 'suffix', len: 1 };
  rules['2'] = { match: 'suffix', len: 2 };
  rules['3'] =
    digitCount === 3 ? { match: 'exact' } : { match: 'suffix', len: 3 };
  return rules;
}

function rulesFor(cfg: GameMechanicsConfig): Record<string, MatchRule> {
  const digitCount = requireDigitCount(cfg);
  return { ...defaultRules(digitCount), ...(cfg.betTypeRules || {}) };
}

function applyRule(
  rule: MatchRule,
  ticket: string,
  resultNumber: string,
  resultDigits: number[],
  sum: number,
  threshold: number,
): boolean {
  switch (rule.match) {
    case 'exact':
      return ticket === resultNumber;
    case 'box':
      return sortStr(ticket) === sortStr(resultNumber);
    case 'prefix': {
      const n = rule.len ?? ticket.length;
      return ticket.slice(0, n) === resultNumber.slice(0, n);
    }
    case 'suffix': {
      const n = rule.len ?? ticket.length;
      return ticket.slice(-n) === resultNumber.slice(-n);
    }
    case 'position': {
      const pos = rule.pos ?? 0;
      if (pos >= resultDigits.length || pos >= ticket.length) return false;
      return parseInt(ticket.charAt(pos), 10) === resultDigits[pos];
    }
    case 'sum':
      return parseInt(ticket, 10) === sum;
    case 'size':
      return rule.side === 'big' ? sum > threshold : sum <= threshold;
    case 'parity':
      return rule.par === 'odd' ? sum % 2 === 1 : sum % 2 === 0;
    default:
      return false;
  }
}

function build(numberStr: string): DrawResult {
  const digits = numberStr.split('').map((d) => parseInt(d, 10));
  return {
    number: numberStr,
    digits,
    drawResult: numberStr,
    sum: digits.reduce((a, b) => a + b, 0),
  };
}

function randomNumber(len: number, rng: Rng): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String(rngInt(rng, 0, 9));
  return s;
}

export function makeDigitMechanic(family: string): GameMechanic {
  return {
    family,
    defaults: FAMILY_DEFAULTS[family] ?? FAMILY_DEFAULTS.digit5,

    generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
      return build(randomNumber(requireDigitCount(cfg), rng));
    },

    evaluate({
      betType,
      betContent,
      result,
      cfg,
    }: MechanicEvalInput): EvalOutcome {
      const resultNumber = String(result?.number ?? result?.drawResult ?? '');
      if (!resultNumber) return { won: false };
      const resultDigits: number[] = Array.isArray(result?.digits)
        ? result.digits
        : resultNumber.split('').map((d) => parseInt(d, 10));
      const sum = resultDigits.reduce((a, b) => a + b, 0);
      const threshold = cfg.bigSmallThreshold ?? 13;

      const rules = rulesFor(cfg);
      const key = String(betContent?.betType ?? betType ?? '');
      const rule = rules[key] ??
        rules[key.toLowerCase()] ?? { match: 'exact' as const };

      const tickets: string[] = Array.isArray(betContent?.codes)
        ? betContent.codes.map(String)
        : [
            String(
              betContent?.numbers ??
                betContent?.betCode ??
                betContent?.betNum ??
                '',
            ),
          ].filter(Boolean);

      const ticketIndependent =
        rule.match === 'size' || rule.match === 'parity';

      const won = ticketIndependent
        ? applyRule(rule, '', resultNumber, resultDigits, sum, threshold)
        : tickets.some((t) =>
            applyRule(rule, t, resultNumber, resultDigits, sum, threshold),
          );
      return { won, oddsKey: key };
    },

    enumerateCandidates(
      cfg: GameMechanicsConfig,
      opts?: EnumerateOptions,
    ): DrawResult[] {
      const len = requireDigitCount(cfg);
      const space = Math.pow(10, len);
      if (space <= 1000) {
        return Array.from({ length: space }, (_, i) =>
          build(String(i).padStart(len, '0')),
        );
      }
      const rng = opts?.rng ?? defaultRng;
      const sampleSize = Math.min(opts?.sampleSize ?? 2000, space);
      const targetQuota = Math.floor(sampleSize / 4);
      const seen = new Set<string>();
      const out: DrawResult[] = [];
      for (const t of opts?.targets ?? []) {
        if (out.length >= targetQuota) break;
        const padded = String(t).padStart(len, '0').slice(-len);
        if (!seen.has(padded)) {
          seen.add(padded);
          out.push(build(padded));
        }
      }
      let guard = 0;
      while (out.length < sampleSize && guard < sampleSize * 5) {
        guard++;
        const n = randomNumber(len, rng);
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(build(n));
      }
      return out;
    },
  };
}

export const Digit3Mechanic: GameMechanic = makeDigitMechanic('digit3');
export const Digit5Mechanic: GameMechanic = makeDigitMechanic('digit5');
