import { DataSource } from 'typeorm';
import { LobbySection } from '../entities/lobby-section.entity';
import { LobbyProvider } from '../entities/lobby-provider.entity';
import { LobbyConfig } from '../entities/lobby-config.entity';

const lobbySections: {
  filterType: string;
  filterName: string;
  rows: number;
}[] = [
  { filterType: 'Recommend', filterName: 'Recommend', rows: 3 },
  { filterType: 'Popular', filterName: 'Popular', rows: 2 },
  { filterType: 'Originals', filterName: 'Originals', rows: 2 },
  { filterType: 'CasualGames', filterName: 'Casual Games', rows: 2 },
  { filterType: 'HotLive', filterName: 'Hot Live', rows: 2 },
  { filterType: 'HotFishing', filterName: 'Hot Fishing', rows: 2 },
  { filterType: 'ClassicSlot', filterName: 'Classic Slot', rows: 2 },
  { filterType: 'Highmultiplier', filterName: 'High multiplier', rows: 2 },
  { filterType: 'FeatureBuy-in', filterName: 'Feature Buy-in', rows: 2 },
];

const lotterySections: { filterType: string; filterName: string }[] = [
  { filterType: '3Digits', filterName: '3Digits' },
  { filterType: 'Digit4&5', filterName: 'Digit 4 & 5' },
  { filterType: 'Run&Guess', filterName: 'Run & Guess' },
  { filterType: 'DubaiLottery', filterName: 'Dubai Lottery' },
  { filterType: 'Kerala', filterName: 'Kerala' },
  { filterType: 'K3', filterName: 'K3' },
  { filterType: 'WinGo', filterName: 'WinGo' },
  { filterType: 'State', filterName: 'State' },
  { filterType: 'BonusGames', filterName: 'Bonus Games' },
];

type Prov = {
  filterType: string;
  filterName: string;
  bigIcon: { x: number; y: number };
  icon: { x: number; y: number };
};

const lobbyProviders: Prov[] = [
  {
    filterType: 'Inout',
    filterName: 'Inout',
    bigIcon: { x: 0, y: 100 },
    icon: { x: 0, y: 80 },
  },
  {
    filterType: 'KingMidas',
    filterName: 'KingMidas',
    bigIcon: { x: 130, y: 100 },
    icon: { x: 60, y: 20 },
  },
  {
    filterType: 'Evolution',
    filterName: 'Evolution',
    bigIcon: { x: 390, y: 100 },
    icon: { x: 20, y: 20 },
  },
  {
    filterType: 'Spribe',
    filterName: 'Spribe',
    bigIcon: { x: 0, y: 158 },
    icon: { x: 0, y: 40 },
  },
  {
    filterType: '2J',
    filterName: '2J',
    bigIcon: { x: 130, y: 158 },
    icon: { x: 100, y: 40 },
  },
  {
    filterType: 'Turbo Games',
    filterName: 'Turbo Games',
    bigIcon: { x: 260, y: 158 },
    icon: { x: 40, y: 0 },
  },
  {
    filterType: 'Lite',
    filterName: 'Lite',
    bigIcon: { x: 390, y: 158 },
    icon: { x: 100, y: 60 },
  },
  {
    filterType: 'Hacksaw',
    filterName: 'Hacksaw',
    bigIcon: { x: 0, y: 216 },
    icon: { x: 40, y: 20 },
  },
  {
    filterType: 'Bgaming',
    filterName: 'Bgaming',
    bigIcon: { x: 130, y: 216 },
    icon: { x: 0, y: 20 },
  },
  {
    filterType: 'KoolBet',
    filterName: 'KoolBet',
    bigIcon: { x: 260, y: 216 },
    icon: { x: 80, y: 20 },
  },
  {
    filterType: 'Aviatrix',
    filterName: 'Aviatrix',
    bigIcon: { x: 0, y: 274 },
    icon: { x: 20, y: 80 },
  },
  {
    filterType: 'JiLi',
    filterName: 'JiLi',
    bigIcon: { x: 260, y: 100 },
    icon: { x: 80, y: 0 },
  },
  {
    filterType: 'Amusnet',
    filterName: 'Amusnet',
    bigIcon: { x: 260, y: 564 },
    icon: { x: 420, y: 0 },
  },
  {
    filterType: 'CP Games',
    filterName: 'CP Games',
    bigIcon: { x: 390, y: 564 },
    icon: { x: 440, y: 0 },
  },
  {
    filterType: 'PG Soft',
    filterName: 'PG Soft',
    bigIcon: { x: 130, y: 274 },
    icon: { x: 60, y: 40 },
  },
  {
    filterType: 'CQ9',
    filterName: 'CQ9',
    bigIcon: { x: 390, y: 274 },
    icon: { x: 40, y: 80 },
  },
  {
    filterType: 'FaChai',
    filterName: 'FaChai',
    bigIcon: { x: 0, y: 332 },
    icon: { x: 60, y: 80 },
  },
  {
    filterType: 'Spade Gaming',
    filterName: 'Spade Gaming',
    bigIcon: { x: 130, y: 332 },
    icon: { x: 80, y: 80 },
  },
  {
    filterType: 'JDB',
    filterName: 'JDB',
    bigIcon: { x: 260, y: 274 },
    icon: { x: 20, y: 60 },
  },
  {
    filterType: 'Evoplay',
    filterName: 'Evoplay',
    bigIcon: { x: 390, y: 332 },
    icon: { x: 120, y: 0 },
  },
  {
    filterType: 'BNG',
    filterName: 'BNG',
    bigIcon: { x: 0, y: 390 },
    icon: { x: 140, y: 0 },
  },
  {
    filterType: 'Ezugi',
    filterName: 'Ezugi',
    bigIcon: { x: 130, y: 390 },
    icon: { x: 40, y: 40 },
  },
  {
    filterType: 'Winfinity',
    filterName: 'Winfinity',
    bigIcon: { x: 260, y: 390 },
    icon: { x: 160, y: 0 },
  },
  {
    filterType: 'Big Time Gaming',
    filterName: 'Big Time Gaming',
    bigIcon: { x: 390, y: 390 },
    icon: { x: 180, y: 0 },
  },
  {
    filterType: 'YellowBat',
    filterName: 'YellowBat',
    bigIcon: { x: 390, y: 448 },
    icon: { x: 280, y: 0 },
  },
  {
    filterType: 'YeeBet',
    filterName: 'YeeBet',
    bigIcon: { x: 130, y: 506 },
    icon: { x: 320, y: 0 },
  },
  {
    filterType: 'Saba Sports',
    filterName: 'Saba Sports',
    bigIcon: { x: 260, y: 506 },
    icon: { x: 340, y: 0 },
  },
  {
    filterType: 'AP Gaming',
    filterName: 'AP Gaming',
    bigIcon: { x: 390, y: 506 },
    icon: { x: 360, y: 0 },
  },
  {
    filterType: '7mojo',
    filterName: '7mojo',
    bigIcon: { x: 130, y: 564 },
    icon: { x: 400, y: 0 },
  },
  {
    filterType: 'EpicWin',
    filterName: 'EpicWin',
    bigIcon: { x: 0, y: 622 },
    icon: { x: 460, y: 0 },
  },
  {
    filterType: 'DB Slots',
    filterName: 'DB Slots',
    bigIcon: { x: 260, y: 622 },
    icon: { x: 120, y: 20 },
  },
  {
    filterType: 'Live22',
    filterName: 'Live22',
    bigIcon: { x: 390, y: 622 },
    icon: { x: 140, y: 20 },
  },
  {
    filterType: 'PushGaming',
    filterName: 'PushGaming',
    bigIcon: { x: 260, y: 680 },
    icon: { x: 200, y: 20 },
  },
  {
    filterType: 'DreamGaming',
    filterName: 'DreamGaming',
    bigIcon: { x: 390, y: 680 },
    icon: { x: 200, y: 20 },
  },
  {
    filterType: 'AvatarUX',
    filterName: 'AvatarUX',
    bigIcon: { x: 0, y: 738 },
    icon: { x: 240, y: 20 },
  },
  {
    filterType: 'Aviator Studio',
    filterName: 'Aviator Studio',
    bigIcon: { x: 260, y: 738 },
    icon: { x: 260, y: 20 },
  },
];

const cat5: Prov[] = [
  {
    filterType: 'Inout',
    filterName: 'Inout',
    bigIcon: { x: 0, y: 100 },
    icon: { x: 0, y: 80 },
  },
  {
    filterType: 'KingMidas',
    filterName: 'KingMidas',
    bigIcon: { x: 130, y: 100 },
    icon: { x: 60, y: 20 },
  },
  {
    filterType: 'Spribe',
    filterName: 'Spribe',
    bigIcon: { x: 0, y: 158 },
    icon: { x: 0, y: 40 },
  },
  {
    filterType: '2J',
    filterName: '2J',
    bigIcon: { x: 130, y: 158 },
    icon: { x: 100, y: 40 },
  },
  {
    filterType: 'Turbo Games',
    filterName: 'Turbo Games',
    bigIcon: { x: 260, y: 158 },
    icon: { x: 40, y: 0 },
  },
  {
    filterType: 'Lite',
    filterName: 'Lite',
    bigIcon: { x: 390, y: 158 },
    icon: { x: 100, y: 60 },
  },
  {
    filterType: 'Hacksaw',
    filterName: 'Hacksaw',
    bigIcon: { x: 0, y: 216 },
    icon: { x: 40, y: 20 },
  },
  {
    filterType: 'Bgaming',
    filterName: 'Bgaming',
    bigIcon: { x: 130, y: 216 },
    icon: { x: 0, y: 20 },
  },
  {
    filterType: 'KoolBet',
    filterName: 'KoolBet',
    bigIcon: { x: 260, y: 216 },
    icon: { x: 80, y: 20 },
  },
  {
    filterType: 'Aviatrix',
    filterName: 'Aviatrix',
    bigIcon: { x: 0, y: 274 },
    icon: { x: 20, y: 80 },
  },
  {
    filterType: 'JiLi',
    filterName: 'JiLi',
    bigIcon: { x: 260, y: 100 },
    icon: { x: 80, y: 0 },
  },
  {
    filterType: 'Amusnet',
    filterName: 'Amusnet',
    bigIcon: { x: 260, y: 564 },
    icon: { x: 420, y: 0 },
  },
  {
    filterType: 'CP Games',
    filterName: 'CP Games',
    bigIcon: { x: 390, y: 564 },
    icon: { x: 440, y: 0 },
  },
  {
    filterType: 'Saba Sports',
    filterName: 'Saba Sports',
    bigIcon: { x: 260, y: 506 },
    icon: { x: 340, y: 0 },
  },
  {
    filterType: 'AP Gaming',
    filterName: 'AP Gaming',
    bigIcon: { x: 390, y: 506 },
    icon: { x: 360, y: 0 },
  },
  {
    filterType: 'Aviator Studio',
    filterName: 'Aviator Studio',
    bigIcon: { x: 260, y: 738 },
    icon: { x: 260, y: 20 },
  },
];

const cat6: Prov[] = [
  {
    filterType: '2J',
    filterName: '2J',
    bigIcon: { x: 130, y: 158 },
    icon: { x: 100, y: 40 },
  },
  {
    filterType: 'Bgaming',
    filterName: 'Bgaming',
    bigIcon: { x: 130, y: 216 },
    icon: { x: 0, y: 20 },
  },
  {
    filterType: 'JiLi',
    filterName: 'JiLi',
    bigIcon: { x: 260, y: 100 },
    icon: { x: 80, y: 0 },
  },
  {
    filterType: 'PG Soft',
    filterName: 'PG Soft',
    bigIcon: { x: 130, y: 274 },
    icon: { x: 60, y: 40 },
  },
  {
    filterType: 'Spade Gaming',
    filterName: 'Spade Gaming',
    bigIcon: { x: 130, y: 332 },
    icon: { x: 80, y: 80 },
  },
  {
    filterType: 'JDB',
    filterName: 'JDB',
    bigIcon: { x: 260, y: 274 },
    icon: { x: 20, y: 60 },
  },
  {
    filterType: 'Evoplay',
    filterName: 'Evoplay',
    bigIcon: { x: 390, y: 332 },
    icon: { x: 120, y: 0 },
  },
  {
    filterType: 'BNG',
    filterName: 'BNG',
    bigIcon: { x: 0, y: 390 },
    icon: { x: 140, y: 0 },
  },
  {
    filterType: 'Big Time Gaming',
    filterName: 'Big Time Gaming',
    bigIcon: { x: 390, y: 390 },
    icon: { x: 180, y: 0 },
  },
  {
    filterType: 'YellowBat',
    filterName: 'YellowBat',
    bigIcon: { x: 390, y: 448 },
    icon: { x: 280, y: 0 },
  },
  {
    filterType: '7mojo',
    filterName: '7mojo',
    bigIcon: { x: 130, y: 564 },
    icon: { x: 400, y: 0 },
  },
  {
    filterType: 'CP Games',
    filterName: 'CP Games',
    bigIcon: { x: 390, y: 564 },
    icon: { x: 440, y: 0 },
  },
  {
    filterType: 'EpicWin',
    filterName: 'EpicWin',
    bigIcon: { x: 0, y: 622 },
    icon: { x: 460, y: 0 },
  },
  {
    filterType: 'DB Slots',
    filterName: 'DB Slots',
    bigIcon: { x: 260, y: 622 },
    icon: { x: 120, y: 20 },
  },
  {
    filterType: 'Live22',
    filterName: 'Live22',
    bigIcon: { x: 390, y: 622 },
    icon: { x: 140, y: 20 },
  },
  {
    filterType: 'PushGaming',
    filterName: 'PushGaming',
    bigIcon: { x: 260, y: 680 },
    icon: { x: 200, y: 20 },
  },
  {
    filterType: 'AvatarUX',
    filterName: 'AvatarUX',
    bigIcon: { x: 0, y: 738 },
    icon: { x: 240, y: 20 },
  },
];

const cat1025: Prov[] = [
  {
    filterType: 'Evolution',
    filterName: 'Evolution',
    bigIcon: { x: 390, y: 100 },
    icon: { x: 20, y: 20 },
  },
  {
    filterType: '2J',
    filterName: '2J',
    bigIcon: { x: 130, y: 158 },
    icon: { x: 100, y: 40 },
  },
  {
    filterType: 'Ezugi',
    filterName: 'Ezugi',
    bigIcon: { x: 130, y: 390 },
    icon: { x: 40, y: 40 },
  },
  {
    filterType: 'Winfinity',
    filterName: 'Winfinity',
    bigIcon: { x: 260, y: 390 },
    icon: { x: 160, y: 0 },
  },
  {
    filterType: 'YeeBet',
    filterName: 'YeeBet',
    bigIcon: { x: 130, y: 506 },
    icon: { x: 320, y: 0 },
  },
  {
    filterType: '7mojo',
    filterName: '7mojo',
    bigIcon: { x: 130, y: 564 },
    icon: { x: 400, y: 0 },
  },
  {
    filterType: 'Amusnet',
    filterName: 'Amusnet',
    bigIcon: { x: 260, y: 564 },
    icon: { x: 420, y: 0 },
  },
  {
    filterType: 'DreamGaming',
    filterName: 'DreamGaming',
    bigIcon: { x: 390, y: 680 },
    icon: { x: 200, y: 20 },
  },
];

const cat1026: Prov[] = [
  {
    filterType: '2J',
    filterName: '2J',
    bigIcon: { x: 130, y: 158 },
    icon: { x: 100, y: 40 },
  },
  {
    filterType: 'JiLi',
    filterName: 'JiLi',
    bigIcon: { x: 260, y: 100 },
    icon: { x: 80, y: 0 },
  },
  {
    filterType: 'CQ9',
    filterName: 'CQ9',
    bigIcon: { x: 390, y: 274 },
    icon: { x: 40, y: 80 },
  },
  {
    filterType: 'FaChai',
    filterName: 'FaChai',
    bigIcon: { x: 0, y: 332 },
    icon: { x: 60, y: 80 },
  },
  {
    filterType: 'JDB',
    filterName: 'JDB',
    bigIcon: { x: 260, y: 274 },
    icon: { x: 20, y: 60 },
  },
  {
    filterType: 'YellowBat',
    filterName: 'YellowBat',
    bigIcon: { x: 390, y: 448 },
    icon: { x: 280, y: 0 },
  },
];

export async function seedLobbyConfig(ds: DataSource) {
  const sectionRepo = ds.getRepository(LobbySection);
  const providerRepo = ds.getRepository(LobbyProvider);
  const configRepo = ds.getRepository(LobbyConfig);

  console.log('[LobbyConfig] Clearing existing lobby config...');
  await sectionRepo.clear();
  await providerRepo.clear();
  await configRepo.clear();

  const sections: LobbySection[] = [];
  lobbySections.forEach((s, i) =>
    sections.push(
      sectionRepo.create({
        scope: 'lobby',
        filterType: s.filterType,
        filterName: s.filterName,
        rows: s.rows,
        sortOrder: i,
      }),
    ),
  );
  lotterySections.forEach((s, i) =>
    sections.push(
      sectionRepo.create({
        scope: 'lottery',
        filterType: s.filterType,
        filterName: s.filterName,
        rows: null,
        sortOrder: i,
      }),
    ),
  );
  await sectionRepo.save(sections);

  const providers: LobbyProvider[] = [];
  const pushProv = (categoryId: number | null, arr: Prov[]) =>
    arr.forEach((p, i) =>
      providers.push(
        providerRepo.create({
          categoryId,
          filterType: p.filterType,
          filterName: p.filterName,
          bigIconX: p.bigIcon.x,
          bigIconY: p.bigIcon.y,
          iconX: p.icon.x,
          iconY: p.icon.y,
          sortOrder: i,
        }),
      ),
    );
  pushProv(null, lobbyProviders);
  pushProv(5, cat5);
  pushProv(6, cat6);
  pushProv(1025, cat1025);
  pushProv(1026, cat1026);
  await providerRepo.save(providers);

  await configRepo.save(
    configRepo.create({
      filterIcon: 'https://pic.betzo7.com/hadis/casino/slots_sprite_v11.webp',
      lightIcon: 'https://pic.betzo7.com/hadis/casino/slots_light_v1.webp',
      filterWidth: 518,
      filterHeight: 794,
    }),
  );

  console.log(
    `[LobbyConfig] sections=${sections.length} providers=${providers.length} config=1`,
  );
}
