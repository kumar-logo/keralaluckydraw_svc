import {
  GameMechanic,
  MechanicEvalInput,
  EvalOutcome,
  DrawResult,
} from './mechanic.types';
import {
  GameMechanicsConfig,
  Rng,
  defaultRng,
  FAMILY_DEFAULTS,
} from '../game-config.types';

const DEFAULT_TYPE_CLASS: Record<number, string> = {
  1: 'champion',
  2: 'top3_fixed',
  3: 'winning_group',
  4: 'top3_any',
  5: 'top3_random',
};

function raceGroupId(runner: number, runnerCount: number): number {
  const state =
    runnerCount === 6 ? runner - 1 : Math.floor((runner - 1) / 2) % runnerCount;
  return state + 1;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function build(positions: number[], runnerCount: number): DrawResult {
  return {
    positions,
    drawResult: positions.join(','),
    champion: positions[0],
    second: positions[1],
    third: positions[2],
    top3: `${positions[0]},${positions[1]},${positions[2]}`,
    runnerCount,
  };
}

function classFor(
  typeNum: number,
  betType: string,
  cfg: GameMechanicsConfig,
): string {
  const map: Record<number, string> = {
    ...DEFAULT_TYPE_CLASS,
    ...(cfg.raceTypeMap || {}),
  };
  if (!Number.isNaN(typeNum) && map[typeNum]) return map[typeNum];
  return betType;
}

export const RaceMechanic: GameMechanic = {
  family: 'race',
  defaults: FAMILY_DEFAULTS.race,

  generate(cfg: GameMechanicsConfig, rng: Rng = defaultRng): DrawResult {
    const count = cfg.runnerCount ?? 6;
    const runners = Array.from({ length: count }, (_, i) => i + 1);
    return build(shuffle(runners, rng), count);
  },

  evaluate({
    betType,
    betContent,
    result,
    cfg,
  }: MechanicEvalInput): EvalOutcome {
    const positions = result?.positions;
    if (!Array.isArray(positions) || positions.length < 1)
      return { won: false };

    const champion = positions[0];
    const second = positions[1];
    const third = positions[2];
    const runnerCount =
      result?.runnerCount || positions.length || cfg.runnerCount || 6;

    const rawCode = String(
      betContent?.betCode ??
        betContent?.betNum ??
        betContent?.numbers ??
        betType ??
        '',
    ).toLowerCase();

    const typeNum = Number(betContent?.betType ?? betType);
    const cls = classFor(typeNum, String(betContent?.betType ?? betType), cfg);
    const runners = rawCode
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n));
    const top3 = [champion, second, third];

    let won = false;
    switch (cls) {
      case 'champion':
        won = runners.includes(champion);
        break;
      case 'top3_fixed':
        won =
          runners.length >= 3 &&
          runners[0] === champion &&
          runners[1] === second &&
          runners[2] === third;
        break;
      case 'top3_any':
        won = runners.some((r) => top3.includes(r));
        break;
      case 'top3_random': {
        const picks = runners.slice(0, 3);
        won =
          picks.length === 3 &&
          new Set(picks).size === 3 &&
          picks.every((r) => top3.includes(r));
        break;
      }
      case 'winning_group':
        won = raceGroupId(champion, runnerCount) === runners[0];
        break;
      default:
        won = false;
    }
    return { won, oddsKey: cls };
  },

  enumerateCandidates(cfg: GameMechanicsConfig): DrawResult[] {
    const count = cfg.runnerCount ?? 6;
    const all = Array.from({ length: count }, (_, i) => i + 1);
    const out: DrawResult[] = [];
    for (const c of all) {
      for (const s of all) {
        if (s === c) continue;
        for (const t of all) {
          if (t === c || t === s) continue;
          const rest = all.filter((r) => r !== c && r !== s && r !== t);
          out.push(build([c, s, t, ...rest], count));
        }
      }
    }
    return out;
  },
};
