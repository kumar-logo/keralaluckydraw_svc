import { DataSource, DeepPartial } from 'typeorm';
import { VipConfig } from '../entities/vip-config.entity';

const levels = [
  {
    level: 0,
    levelName: 'VIP 0',
    minRecharge: 0,
    minBet: 0,
    dailyReward: 0,
    monthlyReward: 0,
    rebateRate: 0,
    withdrawLimit: 5000,
  },
  {
    level: 1,
    levelName: 'VIP 1',
    minRecharge: 500,
    minBet: 1000,
    dailyReward: 5,
    monthlyReward: 50,
    rebateRate: 0.001,
    withdrawLimit: 10000,
  },
  {
    level: 2,
    levelName: 'VIP 2',
    minRecharge: 2000,
    minBet: 5000,
    dailyReward: 10,
    monthlyReward: 100,
    rebateRate: 0.002,
    withdrawLimit: 20000,
  },
  {
    level: 3,
    levelName: 'VIP 3',
    minRecharge: 5000,
    minBet: 20000,
    dailyReward: 20,
    monthlyReward: 200,
    rebateRate: 0.003,
    withdrawLimit: 30000,
  },
  {
    level: 4,
    levelName: 'VIP 4',
    minRecharge: 10000,
    minBet: 50000,
    dailyReward: 50,
    monthlyReward: 500,
    rebateRate: 0.004,
    withdrawLimit: 50000,
  },
  {
    level: 5,
    levelName: 'VIP 5',
    minRecharge: 20000,
    minBet: 100000,
    dailyReward: 100,
    monthlyReward: 1000,
    rebateRate: 0.005,
    withdrawLimit: 80000,
  },
  {
    level: 6,
    levelName: 'VIP 6',
    minRecharge: 50000,
    minBet: 250000,
    dailyReward: 200,
    monthlyReward: 2000,
    rebateRate: 0.006,
    withdrawLimit: 100000,
  },
  {
    level: 7,
    levelName: 'VIP 7',
    minRecharge: 100000,
    minBet: 500000,
    dailyReward: 500,
    monthlyReward: 5000,
    rebateRate: 0.007,
    withdrawLimit: 150000,
  },
  {
    level: 8,
    levelName: 'VIP 8',
    minRecharge: 200000,
    minBet: 1000000,
    dailyReward: 1000,
    monthlyReward: 10000,
    rebateRate: 0.008,
    withdrawLimit: 200000,
  },
  {
    level: 9,
    levelName: 'VIP 9',
    minRecharge: 500000,
    minBet: 2500000,
    dailyReward: 2000,
    monthlyReward: 20000,
    rebateRate: 0.009,
    withdrawLimit: 300000,
  },
  {
    level: 10,
    levelName: 'VIP 10',
    minRecharge: 1000000,
    minBet: 5000000,
    dailyReward: 5000,
    monthlyReward: 50000,
    rebateRate: 0.01,
    withdrawLimit: 500000,
  },
];

export async function seedVipConfig(ds: DataSource) {
  const repo = ds.getRepository(VipConfig);

  console.log('[VipConfig] Clearing existing VIP data...');
  await repo.clear();

  let created = 0;
  for (const v of levels) {
    await repo.save(repo.create(v as DeepPartial<VipConfig>));
    created++;
  }

  console.log(`[VipConfig] Created: ${created} VIP levels`);
}
