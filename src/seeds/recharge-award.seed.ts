import { DataSource, DeepPartial } from 'typeorm';
import { RechargeAward } from '../entities/recharge-award.entity';

const awards = [
  {
    awardName: 'First Recharge Bonus',
    awardType: 'first_recharge',
    minAmount: 100,
    maxAmount: 999999,
    bonusRate: 0.05,
    bonusFixed: 0,
    maxBonus: 5000,
    sortOrder: 1,
    status: 1,
  },
  {
    awardName: 'Daily Recharge Bonus',
    awardType: 'daily_recharge',
    minAmount: 500,
    maxAmount: 999999,
    bonusRate: 0.02,
    bonusFixed: 0,
    maxBonus: 2000,
    sortOrder: 2,
    status: 1,
  },
  {
    awardName: 'VIP Recharge Bonus',
    awardType: 'vip_recharge',
    minAmount: 5000,
    maxAmount: 999999,
    bonusRate: 0.03,
    bonusFixed: 0,
    maxBonus: 10000,
    sortOrder: 3,
    status: 1,
  },
  {
    awardName: 'Weekend Special',
    awardType: 'weekend_bonus',
    minAmount: 1000,
    maxAmount: 999999,
    bonusRate: 0.05,
    bonusFixed: 0,
    maxBonus: 5000,
    sortOrder: 4,
    status: 0,
  },
];

export async function seedRechargeAwards(ds: DataSource) {
  const repo = ds.getRepository(RechargeAward);

  console.log('[RechargeAward] Clearing existing recharge awards...');
  await repo.clear();

  let created = 0;
  for (const a of awards) {
    await repo.save(repo.create(a as DeepPartial<RechargeAward>));
    created++;
  }

  console.log(`[RechargeAward] Created: ${created} recharge awards`);
}
