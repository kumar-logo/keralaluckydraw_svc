import { DataSource, DeepPartial } from 'typeorm';
import { GameCategory } from '../entities/game-category.entity';

const categories = [
  { categoryName: 'Lottery', categoryCode: 'lottery', sortOrder: 1, status: 1 },
  { categoryName: 'Casino', categoryCode: 'casino', sortOrder: 2, status: 1 },
  { categoryName: 'Slots', categoryCode: 'slots', sortOrder: 3, status: 1 },
  { categoryName: 'Sports', categoryCode: 'sports', sortOrder: 4, status: 1 },
  {
    categoryName: 'Originals',
    categoryCode: 'originals',
    sortOrder: 5,
    status: 1,
  },
  { categoryName: 'Live', categoryCode: 'live', sortOrder: 6, status: 1 },
  { categoryName: 'Fishing', categoryCode: 'fishing', sortOrder: 7, status: 1 },
  { categoryName: 'Popular', categoryCode: 'popular', sortOrder: 8, status: 1 },
];

export async function seedGameCategories(ds: DataSource) {
  const repo = ds.getRepository(GameCategory);

  console.log('[GameCategory] Clearing existing categories...');
  await repo.clear();

  let created = 0;
  for (const c of categories) {
    await repo.save(repo.create(c as DeepPartial<GameCategory>));
    created++;
  }

  console.log(`[GameCategory] Created: ${created} game categories`);
}
