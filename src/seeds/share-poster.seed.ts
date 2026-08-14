import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { SharePoster } from '../entities/share-poster.entity';

const POSTER_COUNT = 4;

export async function seedSharePosters(ds: DataSource) {
  const repo = ds.getRepository(SharePoster);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(
      `[SharePosters] ${existing} posters already present — keeping them.`,
    );
    return;
  }

  const srcDir = join(__dirname, 'assets', 'posters');
  const destDir = join(process.cwd(), 'uploads', 'referral');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  let created = 0;
  for (let n = 1; n <= POSTER_COUNT; n++) {
    const file = `poster-default-${n}.webp`;
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    if (existsSync(src) && !existsSync(dest)) copyFileSync(src, dest);
    await repo.save(
      repo.create({
        imageUrl: `/uploads/referral/${file}`,
        sortOrder: n,
        status: 1,
      }),
    );
    created++;
  }

  console.log(`[SharePosters] Created: ${created} default posters`);
}
