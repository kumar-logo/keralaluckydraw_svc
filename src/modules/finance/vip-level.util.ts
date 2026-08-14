export interface VipThreshold {
  level: number;
  minRecharge: number | string;
  minBet: number | string;
}

export function resolveVipLevel(
  levels: VipThreshold[],
  totalRecharge: number,
  totalBet: number,
): number {
  let result = 0;
  for (const cfg of [...levels].sort((a, b) => b.level - a.level)) {
    if (
      totalRecharge >= Number(cfg.minRecharge) &&
      totalBet >= Number(cfg.minBet)
    ) {
      result = cfg.level;
      break;
    }
  }
  return result;
}
