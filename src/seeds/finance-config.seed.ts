import { DataSource } from 'typeorm';
import { FinanceConfig } from '../entities/finance-config.entity';
import { RechargePreset } from '../entities/recharge-preset.entity';

const presets = [
  { sortOrder: 1, amount: 100, mark: '' },
  { sortOrder: 2, amount: 500, mark: '' },
  { sortOrder: 3, amount: 1000, mark: '' },
  { sortOrder: 4, amount: 2000, mark: '' },
  { sortOrder: 5, amount: 5000, mark: 'Popular' },
  { sortOrder: 6, amount: 10000, mark: '' },
];

export async function seedFinanceConfig(ds: DataSource) {
  const repo = ds.getRepository(FinanceConfig);
  const presetRepo = ds.getRepository(RechargePreset);

  console.log('[FinanceConfig] Clearing existing finance config...');
  await presetRepo.clear();
  await repo.clear();

  await repo.save(
    repo.create({
      withdrawFeeRate: 0.02,
      withdrawMinAmount: 100,
      withdrawMaxAmount: 50000,
      withdrawDailyCount: 3,
      withdrawMinBetMultiplier: 1,
      withdrawExplain: '',
      rechargeMinAmount: 100,
      rechargeMaxAmount: 100000,
      wageRate: 0.001,
      wageMinBet: 0,
      transferMinAmount: 10,
      transferMaxAmount: 100000,
      newUserBonus: 0,
      firstRechargeBonus: 0,
    }),
  );
  await presetRepo.save(presets.map((p) => presetRepo.create(p)));

  console.log('[FinanceConfig] Created finance config + recharge presets');
}
