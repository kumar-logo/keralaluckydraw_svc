import { DataSource } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';

const configs: {
  configKey: string;
  configVal: string;
  description: string;
  configGroup?: string;
  configType?: string;
  displayLabel?: string;
  sortOrder?: number;
}[] = [];

export async function seedSystemConfig(ds: DataSource) {
  const repo = ds.getRepository(SystemConfig);

  console.log('[SystemConfig] Clearing existing config data...');
  await repo.clear();

  let created = 0;
  for (const c of configs) {
    await repo.save(repo.create(c));
    created++;
  }

  console.log(`[SystemConfig] Created: ${created} config entries`);
}
