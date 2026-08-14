import { DataSource, DeepPartial } from 'typeorm';
import { GameProvider } from '../entities/game-provider.entity';

const providers = [
  {
    providerCode: 'internal',
    providerName: 'Internal Games',
    apiUrl: '',
    sortOrder: 1,
    status: 1,
  },
  {
    providerCode: 'evolution',
    providerName: 'Evolution Gaming',
    apiUrl: 'https://api.evolution.com',
    sortOrder: 2,
    status: 1,
  },
  {
    providerCode: 'pragmatic',
    providerName: 'Pragmatic Play',
    apiUrl: 'https://api.pragmaticplay.net',
    sortOrder: 3,
    status: 0,
  },
];

export async function seedGameProviders(ds: DataSource) {
  const repo = ds.getRepository(GameProvider);

  console.log('[GameProvider] Clearing existing game providers...');
  await repo.clear();

  let created = 0;
  for (const p of providers) {
    await repo.save(repo.create(p as DeepPartial<GameProvider>));
    created++;
  }

  console.log(`[GameProvider] Created: ${created} game providers`);
}
