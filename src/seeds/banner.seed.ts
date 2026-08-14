import { DataSource, DeepPartial } from 'typeorm';
import { Banner } from '../entities/banner.entity';

const banners = [
  {
    title: 'Welcome Bonus',
    imageUrl: '/uploads/banners/welcome.jpg',
    linkUrl: '/promotions',
    position: 'home',
    sortOrder: 1,
    status: 1,
  },
  {
    title: 'Kerala Lottery',
    imageUrl: '/uploads/banners/lottery.jpg',
    linkUrl: '/lottery',
    position: 'home',
    sortOrder: 2,
    status: 1,
  },
];

export async function seedBanners(ds: DataSource) {
  const repo = ds.getRepository(Banner);

  console.log('[Banners] Clearing existing banner data...');
  await repo.clear();

  let created = 0;
  for (const b of banners) {
    await repo.save(repo.create(b as DeepPartial<Banner>));
    created++;
  }

  console.log(`[Banners] Created: ${created} banners`);
}
