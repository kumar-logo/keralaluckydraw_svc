import { RaceMechanic } from './race.mechanic';
import { FAMILY_DEFAULTS, GameMechanicsConfig } from '../game-config.types';

const CFG_12: GameMechanicsConfig = {
  ...FAMILY_DEFAULTS.race,
  runnerCount: 12,
};
const CFG_6: GameMechanicsConfig = { ...FAMILY_DEFAULTS.race, runnerCount: 6 };

function result(positions: number[], runnerCount: number) {
  return {
    positions,
    runnerCount,
    champion: positions[0],
    second: positions[1],
    third: positions[2],
    drawResult: positions.join(','),
  };
}

function evalRace(
  typeNum: number,
  runnersCsv: string,
  res: ReturnType<typeof result>,
  cfg: GameMechanicsConfig,
) {
  return RaceMechanic.evaluate({
    betType: String(typeNum),
    betContent: { betType: String(typeNum), numbers: runnersCsv },
    result: res,
    cfg,
  });
}

// 12-runner finish order: champion=8, second=1, third=2.
const RES_12 = result([8, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12], 12);
// 6-runner finish order: champion=4, second=2, third=6.
const RES_6 = result([4, 2, 6, 1, 3, 5], 6);

describe('RaceMechanic class rules — 12-runner config', () => {
  describe('champion (class 1)', () => {
    it('wins when the bet runner is positions[0]', () => {
      const o = evalRace(1, '8', RES_12, CFG_12);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('champion');
    });

    it('loses when the bet runner is not the champion', () => {
      const o = evalRace(1, '3', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('champion');
    });
  });

  describe('top3_fixed (class 2)', () => {
    it('wins on the exact ordered 1st/2nd/3rd', () => {
      const o = evalRace(2, '8,1,2', RES_12, CFG_12);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_fixed');
    });

    it('loses when the three runners are in the wrong order', () => {
      const o = evalRace(2, '1,8,2', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_fixed');
    });
  });

  describe('winning_group (class 3 — 12-runner pairing map)', () => {
    it('wins when the bet group equals the champion group', () => {
      // raceGroupId(8, 12) = floor((8-1)/2)%12 + 1 = 3 + 1 = 4
      const o = evalRace(3, '4', RES_12, CFG_12);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('winning_group');
    });

    it('loses when the bet group is not the champion group', () => {
      const o = evalRace(3, '1', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('winning_group');
    });
  });

  describe('top3_any (class 4)', () => {
    it('wins when at least one selected runner is in the top3', () => {
      // champion top3 = [8,1,2]; runner 2 is third
      const o = evalRace(4, '11,2', RES_12, CFG_12);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_any');
    });

    it('loses when none of the selected runners are in the top3', () => {
      const o = evalRace(4, '3,4,5', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_any');
    });
  });

  describe('top3_random (class 5)', () => {
    it('wins on exactly 3 unique runners all in the top3 (any order)', () => {
      const o = evalRace(5, '2,8,1', RES_12, CFG_12);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_random');
    });

    it('loses when one of the three is outside the top3', () => {
      const o = evalRace(5, '8,1,9', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_random');
    });

    it('loses when the three picks contain a duplicate', () => {
      const o = evalRace(5, '8,8,1', RES_12, CFG_12);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_random');
    });
  });
});

describe('RaceMechanic class rules — 6-runner config', () => {
  describe('champion (class 1)', () => {
    it('wins when the bet runner is positions[0]', () => {
      const o = evalRace(1, '4', RES_6, CFG_6);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('champion');
    });

    it('loses when the bet runner is not the champion', () => {
      const o = evalRace(1, '5', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('champion');
    });
  });

  describe('top3_fixed (class 2)', () => {
    it('wins on the exact ordered 1st/2nd/3rd', () => {
      const o = evalRace(2, '4,2,6', RES_6, CFG_6);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_fixed');
    });

    it('loses when the three runners are in the wrong order', () => {
      const o = evalRace(2, '2,4,6', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_fixed');
    });
  });

  describe('winning_group (class 3 — 6-runner identity map)', () => {
    it('wins when the bet group equals the champion group', () => {
      // raceGroupId(4, 6) = (4-1) + 1 = 4
      const o = evalRace(3, '4', RES_6, CFG_6);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('winning_group');
    });

    it('loses when the bet group is not the champion group', () => {
      const o = evalRace(3, '2', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('winning_group');
    });
  });

  describe('top3_any (class 4)', () => {
    it('wins when at least one selected runner is in the top3', () => {
      // champion top3 = [4,2,6]; runner 6 is third
      const o = evalRace(4, '1,6', RES_6, CFG_6);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_any');
    });

    it('loses when none of the selected runners are in the top3', () => {
      const o = evalRace(4, '1,3,5', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_any');
    });
  });

  describe('top3_random (class 5)', () => {
    it('wins on exactly 3 unique runners all in the top3 (any order)', () => {
      const o = evalRace(5, '6,4,2', RES_6, CFG_6);
      expect(o.won).toBe(true);
      expect(o.oddsKey).toBe('top3_random');
    });

    it('loses when one of the three is outside the top3', () => {
      const o = evalRace(5, '4,2,1', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_random');
    });

    it('loses when the three picks contain a duplicate', () => {
      const o = evalRace(5, '4,4,2', RES_6, CFG_6);
      expect(o.won).toBe(false);
      expect(o.oddsKey).toBe('top3_random');
    });
  });
});
