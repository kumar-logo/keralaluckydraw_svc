import { DataSource } from 'typeorm';
import { RankConfig } from '../entities/rank-config.entity';
import { RankConfigPrize } from '../entities/rank-config-prize.entity';

const ranks = [
  {
    rankId: 1,
    rankName: 'Daily Betting Rank',
    rankType: 'bet_amount',
    period: 'daily',
    status: 1,
    prizes: JSON.stringify([
      { rank: 1, prize: 5000 },
      { rank: 2, prize: 3000 },
      { rank: 3, prize: 2000 },
      { rank: 4, prize: 1000 },
      { rank: 5, prize: 500 },
      { rank: 6, prize: 300 },
      { rank: 7, prize: 300 },
      { rank: 8, prize: 300 },
      { rank: 9, prize: 300 },
      { rank: 10, prize: 300 },
    ]),
  },
  {
    rankId: 2,
    rankName: 'Weekly Betting Rank',
    rankType: 'bet_amount',
    period: 'weekly',
    status: 1,
    prizes: JSON.stringify([
      { rank: 1, prize: 20000 },
      { rank: 2, prize: 10000 },
      { rank: 3, prize: 5000 },
      { rank: 4, prize: 3000 },
      { rank: 5, prize: 2000 },
      { rank: 6, prize: 1000 },
      { rank: 7, prize: 1000 },
      { rank: 8, prize: 1000 },
      { rank: 9, prize: 1000 },
      { rank: 10, prize: 1000 },
    ]),
  },
  {
    rankId: 3,
    rankName: 'Daily Win Rank',
    rankType: 'win_amount',
    period: 'daily',
    status: 1,
    prizes: JSON.stringify([
      { rank: 1, prize: 3000 },
      { rank: 2, prize: 2000 },
      { rank: 3, prize: 1000 },
      { rank: 4, prize: 500 },
      { rank: 5, prize: 300 },
    ]),
  },
];

export async function seedRankConfig(ds: DataSource) {
  const repo = ds.getRepository(RankConfig);
  const prizeRepo = ds.getRepository(RankConfigPrize);

  console.log('[RankConfig] Clearing existing rank config...');
  await prizeRepo.clear();
  await repo.clear();

  let created = 0;
  for (const r of ranks) {
    const { prizes, ...rest } = r;
    const saved = await repo.save(repo.create(rest as Partial<RankConfig>));
    const prizeArr: Array<{ rank: number; prize: number }> = JSON.parse(prizes);
    await prizeRepo.save(
      prizeArr.map((p) =>
        prizeRepo.create({
          rankConfigId: saved.id,
          rankPosition: p.rank,
          prizeAmount: p.prize,
        }),
      ),
    );
    created++;
  }

  console.log(`[RankConfig] Created: ${created} rank configs`);
}
