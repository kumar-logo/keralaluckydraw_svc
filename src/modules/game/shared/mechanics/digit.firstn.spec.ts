import { MECHANIC_BY_FAMILY } from './index';
import type { GameMechanicsConfig } from '../game-config.types';

const mech = MECHANIC_BY_FAMILY.get('digit5');

const cfg5 = { family: 'digit5', digitCount: 5 } as GameMechanicsConfig;
const cfg3 = { family: 'digit3', digitCount: 3 } as GameMechanicsConfig;

const result = (n: string) => ({
  number: n,
  digits: n.split('').map(Number),
  drawResult: n,
  sum: n.split('').reduce((a, b) => a + Number(b), 0),
});

const evalBet = (
  betType: string,
  numbers: string,
  drawn: string,
  cfg: GameMechanicsConfig,
) =>
  mech!.evaluate({
    betType,
    betContent: { numbers, betType },
    result: result(drawn),
    cfg,
  });

describe('digit mechanic: first{n} = PREFIX match (odds 9/90/900/9000)', () => {
  it('first1 matches the FIRST digit only', () => {
    expect(evalBet('first1', '0', '05789', cfg5).won).toBe(true);
    expect(evalBet('first1', '5', '05789', cfg5).won).toBe(false);
  });

  it('first2 matches the first TWO digits', () => {
    expect(evalBet('first2', '05', '05789', cfg5).won).toBe(true);
    expect(evalBet('first2', '57', '05789', cfg5).won).toBe(false);
  });

  it('first3 matches the first THREE digits', () => {
    expect(evalBet('first3', '057', '05789', cfg5).won).toBe(true);
    expect(evalBet('first3', '578', '05789', cfg5).won).toBe(false);
  });

  it('first4 matches the first FOUR digits', () => {
    expect(evalBet('first4', '0578', '05789', cfg5).won).toBe(true);
    expect(evalBet('first4', '5789', '05789', cfg5).won).toBe(false);
  });

  it('first5 on a 5-digit game is a full exact match', () => {
    expect(evalBet('first5', '05789', '05789', cfg5).won).toBe(true);
    expect(evalBet('first5', '05780', '05789', cfg5).won).toBe(false);
  });

  it('first{n} and exact{n} are mirror images (prefix vs suffix)', () => {
    expect(evalBet('first4', '0578', '05789', cfg5).won).toBe(true);
    expect(evalBet('exact4', '0578', '05789', cfg5).won).toBe(false);
    expect(evalBet('exact4', '5789', '05789', cfg5).won).toBe(true);
    expect(evalBet('first4', '5789', '05789', cfg5).won).toBe(false);
  });

  it('REGRESSION: first2 no longer needs the whole number to match', () => {
    const out = evalBet('first2', '05', '05789', cfg5);
    expect(out.won).toBe(true);
  });

  it('works on 3-digit games too', () => {
    expect(evalBet('first1', '4', '447', cfg3).won).toBe(true);
    expect(evalBet('first2', '44', '447', cfg3).won).toBe(true);
    expect(evalBet('first3', '447', '447', cfg3).won).toBe(true);
    expect(evalBet('first2', '47', '447', cfg3).won).toBe(false);
  });

  it('leaves the positional "first" bet type unchanged', () => {
    expect(evalBet('first', '0', '05789', cfg5).won).toBe(true);
    expect(evalBet('first', '5', '05789', cfg5).won).toBe(false);
  });

  it('leaves suffix exact{n} behaviour unchanged', () => {
    expect(evalBet('exact4', '5789', '05789', cfg5).won).toBe(true);
    expect(evalBet('exact5', '05789', '05789', cfg5).won).toBe(true);
  });
});
