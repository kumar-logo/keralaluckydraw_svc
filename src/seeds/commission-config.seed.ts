import { DataSource, DeepPartial } from 'typeorm';
import { CommissionConfig } from '../entities/commission-config.entity';

const commissions = [
  { level: 1, rate: 0.05, levelName: 'Agent L1' },
  { level: 2, rate: 0.02, levelName: 'Agent L2' },
  { level: 3, rate: 0.01, levelName: 'Agent L3' },
];

export async function seedCommissionConfig(ds: DataSource) {
  const repo = ds.getRepository(CommissionConfig);

  console.log('[CommissionConfig] Clearing existing commission data...');
  await repo.clear();

  let created = 0;
  for (const c of commissions) {
    await repo.save(repo.create(c as DeepPartial<CommissionConfig>));
    created++;
  }

  console.log(`[CommissionConfig] Created: ${created} commission configs`);
}
