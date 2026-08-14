import { DataSource } from 'typeorm';
import { ShareChannel } from '../entities/share-channel.entity';
import { OddsAlias } from '../entities/odds-alias.entity';

const shareChannels = [
  {
    name: 'Telegram',
    icon: 'telegram',
    url: 'https://t.me/share/url?url={url}&text={text}',
  },
  { name: 'WhatsApp', icon: 'whatsapp', url: 'https://wa.me/?text={url}' },
];

const oddsAliases: { betCode: string; oddsClass: string }[] = [];

export async function seedShareOdds(ds: DataSource) {
  const shareRepo = ds.getRepository(ShareChannel);
  const oddsRepo = ds.getRepository(OddsAlias);

  console.log('[ShareOdds] Clearing existing share/odds config...');
  await shareRepo.clear();
  await oddsRepo.clear();

  await shareRepo.save(
    shareChannels.map((c, i) =>
      shareRepo.create({
        name: c.name,
        icon: c.icon,
        url: c.url,
        sortOrder: i,
      }),
    ),
  );
  if (oddsAliases.length > 0) {
    await oddsRepo.save(
      oddsAliases.map((o, i) =>
        oddsRepo.create({
          betCode: o.betCode,
          oddsClass: o.oddsClass,
          sortOrder: i,
        }),
      ),
    );
  }

  console.log(
    `[ShareOdds] shareChannels=${shareChannels.length} oddsAliases=${oddsAliases.length}`,
  );
}
