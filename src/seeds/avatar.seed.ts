import { DataSource, DeepPartial } from 'typeorm';
import { Avatar } from '../entities/avatar.entity';

const avatars = Array.from({ length: 12 }, (_, i) => ({
  avatarUrl: `/uploads/avatars/avatar_${String(i + 1).padStart(2, '0')}.png`,
  sortOrder: i + 1,
  status: 1,
}));

export async function seedAvatars(ds: DataSource) {
  const repo = ds.getRepository(Avatar);

  console.log('[Avatar] Clearing existing avatars...');
  await repo.clear();

  let created = 0;
  for (const a of avatars) {
    await repo.save(repo.create(a as DeepPartial<Avatar>));
    created++;
  }

  console.log(`[Avatar] Created: ${created} avatars`);
}
