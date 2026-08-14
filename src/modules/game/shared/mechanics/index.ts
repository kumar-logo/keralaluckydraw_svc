import { GameMechanic } from './mechanic.types';
import { ColorMechanic } from './color.mechanic';
import { DiceMechanic } from './dice.mechanic';
import { RaceMechanic } from './race.mechanic';
import { Digit3Mechanic, Digit5Mechanic } from './digit.mechanic';
import { SlatDigit3Mechanic, SlatDigit5Mechanic } from './slat.mechanic';
import { SingleDigitMechanic } from './single-digit.mechanic';
import { LotteryMechanic } from './lottery.mechanic';
import { CustomMechanic } from './custom.mechanic';

export * from './mechanic.types';
export { resolveFamily, GAME_TYPE_FAMILY } from './family-map';
export {
  ColorMechanic,
  DiceMechanic,
  RaceMechanic,
  Digit3Mechanic,
  Digit5Mechanic,
  SlatDigit3Mechanic,
  SlatDigit5Mechanic,
  SingleDigitMechanic,
  LotteryMechanic,
  CustomMechanic,
};

export const ALL_MECHANICS: GameMechanic[] = [
  ColorMechanic,
  DiceMechanic,
  RaceMechanic,
  SlatDigit3Mechanic,
  SlatDigit5Mechanic,
  SingleDigitMechanic,
  LotteryMechanic,
  CustomMechanic,
];

export function buildMechanicMap(
  mechanics: GameMechanic[] = ALL_MECHANICS,
): Map<string, GameMechanic> {
  return new Map(mechanics.map((m) => [m.family, m]));
}

export const MECHANIC_BY_FAMILY = buildMechanicMap();
