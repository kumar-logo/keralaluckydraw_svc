import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { seedGameCategories } from './game-category.seed';
import { seedGameList } from './game-list.seed';
import { seedCasinoGames } from './casino-games.seed';
import { seedOddsConfig } from './odds-config.seed';
import { seedGameFeeConfig } from './game-fee-config.seed';

const dataSource = new DataSource(databaseConfig() as DataSourceOptions);

async function run() {
  console.log('Connecting to database...');
  await dataSource.initialize();
  console.log(
    'Connected. Re-seeding GAME config only (categories + game_list + casino/third-party + odds + fee).\n',
  );

  await seedGameCategories(dataSource);
  await seedGameList(dataSource);
  await seedCasinoGames(dataSource);
  await seedOddsConfig(dataSource);
  await seedGameFeeConfig(dataSource);

  console.log('\nGame config re-seed completed.');
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Game seed failed:', err);
  process.exit(1);
});
