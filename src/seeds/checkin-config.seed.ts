import { DataSource, DeepPartial } from 'typeorm';
import { CheckinConfig } from '../entities/checkin-config.entity';

const days = [
  { dayNum: 1, awardType: 'chip', awardNum: 10, status: 1 },
  { dayNum: 2, awardType: 'chip', awardNum: 20, status: 1 },
  { dayNum: 3, awardType: 'chip', awardNum: 30, status: 1 },
  { dayNum: 4, awardType: 'chip', awardNum: 50, status: 1 },
  { dayNum: 5, awardType: 'chip', awardNum: 100, status: 1 },
  { dayNum: 6, awardType: 'chip', awardNum: 200, status: 1 },
  { dayNum: 7, awardType: 'chip', awardNum: 200, status: 1 },
];

export async function seedCheckinConfig(ds: DataSource) {
  const repo = ds.getRepository(CheckinConfig);

  console.log('[CheckinConfig] Clearing existing check-in data...');
  await repo.clear();

  let created = 0;
  for (const d of days) {
    await repo.save(repo.create(d as DeepPartial<CheckinConfig>));
    created++;
  }

  console.log(`[CheckinConfig] Created: ${created} day configs`);
}
