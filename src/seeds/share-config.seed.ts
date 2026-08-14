import { DataSource, DeepPartial } from 'typeorm';
import { ShareConfig } from '../entities/share-config.entity';

const configs = [
  {
    title: 'Win Big with Kerala Lottery!',
    description: 'Play lottery games and win massive prizes. Join now!',
    imageUrl: '/uploads/share/default.png',
    linkUrl: '/',
    status: 1,
  },
  {
    title: 'Invite & Earn Commission',
    description: 'Invite friends and earn commission on every bet they place.',
    imageUrl: '/uploads/share/invite.png',
    linkUrl: '/invite',
    gameType: 'all',
    status: 1,
  },
];

export async function seedShareConfigs(ds: DataSource) {
  const repo = ds.getRepository(ShareConfig);

  console.log('[ShareConfig] Clearing existing share configs...');
  await repo.clear();

  let created = 0;
  for (const c of configs) {
    await repo.save(repo.create(c as DeepPartial<ShareConfig>));
    created++;
  }

  console.log(`[ShareConfig] Created: ${created} share configs`);
}
