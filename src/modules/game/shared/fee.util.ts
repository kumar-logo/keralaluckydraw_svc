export function computeNetWin(
  grossWin: number,
  feeRate: number,
  fixedFee: number,
): number {
  const deduction = Number((grossWin * feeRate + fixedFee).toFixed(2));
  const bounded = Math.min(grossWin, Math.max(0, deduction));
  return Number((grossWin - bounded).toFixed(2));
}
