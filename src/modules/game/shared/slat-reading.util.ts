import { SlatMatchMode } from '../../../common/enums';
import { SlatProductView, SlatTierView } from './game-config.types';

export interface SlatLabeledPosition {
  index: number;
  label: string;
  digit: string;
}

export interface SlatWinningGroup {
  productId: number;
  title: string;
  matchMode: SlatMatchMode;
  tierLabel: string;
  positions: number[];
  winningDigits: string;
  winAmount: number;
}

export interface SlatReading {
  drawn: string;
  labeled: SlatLabeledPosition[];
  readingText: string;
  groups: SlatWinningGroup[];
}

function findLongestTier(products: SlatProductView[]): SlatTierView | null {
  let longest: SlatTierView | null = null;
  for (const product of products) {
    for (const tier of product.tiers) {
      if (tier.positions.length > (longest?.positions.length ?? 0)) {
        longest = tier;
      }
    }
  }
  return longest;
}

export function derivePositionLabels(
  length: number,
  products: SlatProductView[],
): string[] {
  const labels: string[] = new Array<string>(length).fill('');
  const longest = findLongestTier(products);
  if (longest) {
    for (let k = 0; k < longest.positions.length; k++) {
      const index = longest.positions[k];
      if (index >= 0 && index < length) {
        labels[index] = longest.label[k] ?? '';
      }
    }
  }
  const used = new Set(labels.filter((label) => label));
  let next = 65;
  for (let i = 0; i < length; i++) {
    if (labels[i]) continue;
    while (used.has(String.fromCharCode(next))) next++;
    labels[i] = String.fromCharCode(next);
    used.add(labels[i]);
    next++;
  }
  return labels;
}

export function decodeSlatReading(
  drawn: string,
  products: SlatProductView[],
): SlatReading {
  const labels = derivePositionLabels(drawn.length, products);
  const labeled: SlatLabeledPosition[] = [];
  for (let index = 0; index < drawn.length; index++) {
    labeled.push({
      index,
      label: labels[index] ?? '',
      digit: drawn[index] ?? '',
    });
  }
  const groups: SlatWinningGroup[] = [];
  for (const product of products) {
    for (const tier of product.tiers) {
      const winningDigits = tier.positions
        .map((index) => drawn[index] ?? '')
        .join('');
      groups.push({
        productId: product.id ?? 0,
        title: product.title,
        matchMode: product.matchMode,
        tierLabel: tier.label,
        positions: tier.positions,
        winningDigits,
        winAmount: Number(tier.winAmount),
      });
    }
  }
  const longest = findLongestTier(products);
  const readingText = longest
    ? `${longest.positions.map((index) => drawn[index] ?? '').join('')}-${longest.label}`
    : drawn;
  return { drawn, labeled, readingText, groups };
}
