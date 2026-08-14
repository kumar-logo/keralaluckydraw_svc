import { DataSource } from 'typeorm';
import { CashrainWindow } from '../entities/cashrain-window.entity';
import { GameList } from '../entities/game-list.entity';
import { GameType } from '../common/enums';

interface WindowSeed {
  dayStart: number;
  dayEnd: number;
  startMinute: number;
  endMinute: number;
}

const DEFAULT_WINDOWS: WindowSeed[] = [
  { dayStart: 1, dayEnd: 7, startMinute: 0, endMinute: 59 },
  { dayStart: 1, dayEnd: 7, startMinute: 540, endMinute: 599 },
  { dayStart: 1, dayEnd: 7, startMinute: 720, endMinute: 779 },
  { dayStart: 1, dayEnd: 7, startMinute: 840, endMinute: 899 },
  { dayStart: 1, dayEnd: 7, startMinute: 1080, endMinute: 1139 },
  { dayStart: 1, dayEnd: 7, startMinute: 1200, endMinute: 1259 },
  { dayStart: 8, dayEnd: 31, startMinute: 540, endMinute: 599 },
  { dayStart: 8, dayEnd: 31, startMinute: 720, endMinute: 779 },
  { dayStart: 8, dayEnd: 31, startMinute: 1200, endMinute: 1259 },
];

export async function seedCashrainWindows(ds: DataSource): Promise<void> {
  const gameRepo = ds.getRepository(GameList);
  const windowRepo = ds.getRepository(CashrainWindow);
  const games = await gameRepo.find({
    where: { gameType: GameType.CashRain },
  });

  let inserted = 0;
  for (const game of games) {
    const existing = await windowRepo.count({ where: { gameId: game.id } });
    if (existing > 0) continue;
    await windowRepo.save(
      DEFAULT_WINDOWS.map((w, index) =>
        windowRepo.create({
          gameId: game.id,
          dayStart: w.dayStart,
          dayEnd: w.dayEnd,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
          sortOrder: index,
          status: 1,
        }),
      ),
    );
    inserted += DEFAULT_WINDOWS.length;
  }

  console.log(`[CashrainWindow] Seeded ${inserted} window(s)`);
}
