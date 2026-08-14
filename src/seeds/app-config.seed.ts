import { DataSource } from 'typeorm';
import { AppConfig } from '../entities/app-config.entity';
import { ResultMode } from '../common/enums/result-mode.enum';

export async function seedAppConfig(ds: DataSource) {
  const repo = ds.getRepository(AppConfig);

  console.log('[AppConfig] Clearing existing app config...');
  await repo.clear();

  await repo.save(
    repo.create({
      appName: 'Kerala Lucky Draw',
      siteUrl: 'https://keralaluckydraw.com',
      currency: '₹',
      referralPrefix: 'ARA',
      marqueeText:
        'Welcome to Kerala Lucky Draw! Play your favorite lottery and win big prizes. New users get special welcome bonus!',
      tgLink: 'https://t.me/+-dFIsesqBSNkODk9',
      waLink: 'https://chat.whatsapp.com/KBUNS8TogDqFzeM7QmbsY0',
      xLink: 'https://x.com/shrikan08605530',
      facebookLink: 'https://www.facebook.com/profile.php?id=61550226448422',
      instagramLink: 'https://www.instagram.com/ke.rr8965/',
      supportChatEnabled: 1,
      supportChatProvider: 'salesmartly',
      supportChatLicense: '',
      supportTelegramUrl: 'https://t.me/+-dFIsesqBSNkODk9',
      supportWhatsappEnabled: 0,
      supportWhatsappUrl: '',
      sportsGameCode: 'SABA_1',
      schedulerTickMs: 1000,
      gameinfoCacheTtlMs: 1000,
      roundCooldownMs: 3000,
      resultModeDefault: ResultMode.MaxProfit,
      resultHouseEdgeDefault: 0.15,
      resultSampleSize: 2000,
      resultDecisionBudgetMs: 250,
      oddsMissingPolicy: 'use_stored',
      bigwinMinAmount: 1000,
      bigwinTemplate: 'Congratulations {user}, you won ₹{amount} in {game}!',
      activePaymentGateway: 'manual',
      manualPayUrl: '/pay',
    }),
  );

  console.log('[AppConfig] Created app config');
}
