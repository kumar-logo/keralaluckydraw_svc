export type ColorMap = Record<string, string[]>;

export const DEFAULT_COLOR_MAP: ColorMap = {
  '0': ['red', 'violet'],
  '1': ['green'],
  '2': ['red'],
  '3': ['green'],
  '4': ['red'],
  '5': ['green', 'violet'],
  '6': ['red'],
  '7': ['green'],
  '8': ['red'],
  '9': ['green'],
};

export function colorsForNumber(
  n: number,
  colorMap: ColorMap = DEFAULT_COLOR_MAP,
): string[] {
  return colorMap[String(n)] ?? [];
}

export function colorSize(n: number, threshold = 5): 'big' | 'small' {
  return n >= threshold ? 'big' : 'small';
}

export function sumSize(sum: number, threshold = 10): 'big' | 'small' {
  return sum > threshold ? 'big' : 'small';
}

export function parity(n: number): 'odd' | 'even' {
  return n % 2 === 1 ? 'odd' : 'even';
}
