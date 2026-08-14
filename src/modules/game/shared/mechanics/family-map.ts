export const GAME_TYPE_FAMILY: Record<string, string> = {
  color: 'color',
  dice: 'dice',
  race: 'race',
  three_digit: 'digit3',
  four_five_digit: 'digit5',
  dubai: 'single_digit',
  kerala: 'lottery',
  mystery_box: 'custom',
  lucky_spin: 'custom',
  cash_rain: 'custom',
};

export function resolveFamily(
  gameType: string,
  configJson?: { family?: string } | null,
): string {
  return GAME_TYPE_FAMILY[gameType] || configJson?.family || 'digit5';
}
