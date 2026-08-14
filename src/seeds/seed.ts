import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { seedAdminUser } from './admin-user.seed';
import { seedGameList } from './game-list.seed';
import { seedSystemConfig } from './system-config.seed';
import { seedVipConfig } from './vip-config.seed';
import { seedOddsConfig } from './odds-config.seed';
import { seedCommissionConfig } from './commission-config.seed';
import { seedCasinoGames } from './casino-games.seed';
import { seedCheckinConfig } from './checkin-config.seed';
import { seedGameCategories } from './game-category.seed';
import { seedRechargeAwards } from './recharge-award.seed';
import { seedRankConfig } from './rank-config.seed';
import { seedTransactionTypes } from './transaction-type.seed';
import { seedAvatars } from './avatar.seed';
import { seedPaymentGateways } from './payment-gateway.seed';
import { seedGameProviders } from './game-provider.seed';
import { seedShareConfigs } from './share-config.seed';
import { seedSharePosters } from './share-poster.seed';
import { seedBanners } from './banner.seed';
import { seedPopups } from './popup.seed';
import { seedAnnouncements } from './announcement.seed';
import { seedGameFeeConfig } from './game-fee-config.seed';
import { seedFinanceConfig } from './finance-config.seed';
import { seedAppConfig } from './app-config.seed';
import { seedLobbyConfig } from './lobby-config.seed';
import { seedUiConfig } from './ui-config.seed';
import { seedShareOdds } from './share-odds.seed';
import { seedCashrainWindows } from './cashrain-window.seed';

const dataSource = new DataSource(databaseConfig() as DataSourceOptions);

async function run() {
  console.log('Connecting to database...');
  await dataSource.initialize();
  console.log('Connected.\n');

  await seedAdminUser(dataSource);
  await seedGameCategories(dataSource);
  await seedGameList(dataSource);
  await seedCasinoGames(dataSource);
  await seedSystemConfig(dataSource);
  await seedFinanceConfig(dataSource);
  await seedAppConfig(dataSource);
  await seedLobbyConfig(dataSource);
  await seedUiConfig(dataSource);
  await seedShareOdds(dataSource);
  await seedVipConfig(dataSource);
  await seedOddsConfig(dataSource);
  await seedCommissionConfig(dataSource);
  await seedCheckinConfig(dataSource);
  await seedRechargeAwards(dataSource);
  await seedRankConfig(dataSource);
  await seedTransactionTypes(dataSource);
  await seedAvatars(dataSource);
  await seedPaymentGateways(dataSource);
  await seedGameProviders(dataSource);
  await seedShareConfigs(dataSource);
  await seedSharePosters(dataSource);
  await seedBanners(dataSource);
  await seedPopups(dataSource);
  await seedAnnouncements(dataSource);
  await seedGameFeeConfig(dataSource);
  await seedCashrainWindows(dataSource);

  console.log('\nAll seeds completed.');
  await dataSource.destroy();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
