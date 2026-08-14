import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Banner } from '../../entities/banner.entity';
import { SharePoster } from '../../entities/share-poster.entity';
import { Announcement } from '../../entities/announcement.entity';
import { Popup } from '../../entities/popup.entity';
import { GameList } from '../../entities/game-list.entity';
import { GameRound } from '../../entities/game-round.entity';
import { UserFavorite } from '../../entities/user-favorite.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CdkeyCode } from '../../entities/cdkey-code.entity';
import { CdkeyUsage } from '../../entities/cdkey-usage.entity';
import { ConfigLoaderService } from '../config/config-loader.service';
import { ThirdPartyService } from '../third-party/third-party.service';
import { FcmService } from '../fcm/fcm.service';
import { AppVersionService } from '../app-version/app-version.service';
import { LotteryDrawMode, TinyFlag, GameType } from '../../common/enums';
import { derivePositionLabels } from '../game/shared/slat-reading.util';
import {
  GameConfigService,
  LobbyPlacementView,
} from '../game/shared/game-config.service';
import {
  GameListDto,
  SearchGamesDto,
  ShareListDto,
  ToggleCollectDto,
} from './dto/operations.dto';

const GAME_TYPE_MAP: Record<string, string> = {
  color: 'WinGo',
  dice: 'K3',
  race: 'Run & Guess',
  kerala: 'Kerala',
  three_digit: '3Digits',
  four_five_digit: 'Digit 4 & 5',
  dubai: 'Dubai Lottery',
  mystery_box: 'Bonus Games',
  lucky_spin: 'Bonus Games',
  cash_rain: 'Bonus Games',
};

const LOBBY_CATEGORY_ID = 1020;
const LOTTERY_CATEGORY_ID = 1;
const LOBBY_DEFAULT_CATEGORY_ID = 1;
const DEFAULT_GAME_TYPE_EMOJI = '🎮';

interface GameTypeAggRow {
  gameType: string;
  label: string;
  emoji: string | null;
  themeColor: string | null;
  isLottery: string | number;
  isThirdParty: string | number;
}

interface RoundResultBlob {
  number?: number | string | null;
  dice?: unknown;
  winner?: number | string | null;
  drawResult?: string | null;
}

const LOBBY_SECTIONS_ORDER = [
  'Recommend',
  'Popular',
  'Originals',
  'CasualGames',
  'HotLive',
  'HotFishing',
  'ClassicSlot',
  'Highmultiplier',
  'FeatureBuy-in',
];

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(Banner) private bannerRepo: Repository<Banner>,
    @InjectRepository(SharePoster)
    private sharePosterRepo: Repository<SharePoster>,
    @InjectRepository(Announcement)
    private announcementRepo: Repository<Announcement>,
    @InjectRepository(Popup) private popupRepo: Repository<Popup>,
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(UserFavorite)
    private favoriteRepo: Repository<UserFavorite>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private configLoader: ConfigLoaderService,
    private gameConfig: GameConfigService,
    private dataSource: DataSource,
    private thirdParty: ThirdPartyService,
    private fcm: FcmService,
    private appVersion: AppVersionService,
  ) {}

  async getAppVersion() {
    return this.appVersion.getConfig();
  }

  async getDigitPositionConfig(): Promise<
    Record<number, { colors: string[]; labels: string[] }>
  > {
    const games = await this.gameListRepo.find({
      where: { gameType: In([GameType.ThreeDigit, GameType.FourFiveDigit]) },
    });
    const map: Record<number, { colors: string[]; labels: string[] }> = {};
    for (const g of games) {
      const { colors } = await this.gameConfig.getPositionColors(g.id);
      const products = await this.gameConfig.getSlatProducts(g.id);
      map[g.id] = {
        colors,
        labels: derivePositionLabels(g.digitCount ?? 0, products),
      };
    }
    return map;
  }

  async getAppConfig() {
    const [appName, currency, siteUrl, loginBgLightUrl, loginBgDarkUrl] =
      await Promise.all([
        this.configLoader.getAppName(),
        this.configLoader.getCurrency(),
        this.configLoader.getSiteUrl(),
        this.configLoader.getLoginBgLightUrl(),
        this.configLoader.getLoginBgDarkUrl(),
      ]);

    const gameTypes = await this.gameListRepo
      .createQueryBuilder('g')
      .select('DISTINCT g.gameType', 'gameType')
      .addSelect('MIN(g.gameName)', 'label')
      .addSelect('MIN(g.emoji)', 'emoji')
      .addSelect('MIN(g.theme_color)', 'themeColor')
      .addSelect('MAX(g.is_lottery)', 'isLottery')
      .addSelect('MAX(g.is_third_party)', 'isThirdParty')
      .where('g.status = 1')
      .groupBy('g.gameType')
      .getRawMany<GameTypeAggRow>();

    const ui = await this.configLoader.getUiBundle();

    const support = {
      chatEnabled: await this.configLoader.getSupportChatEnabled(),
      chatProvider: await this.configLoader.getSupportChatProvider(),
      chatLicense: await this.configLoader.getSupportChatLicense(),
      telegramUrl: await this.configLoader.getSupportTelegramUrl(),
      whatsappEnabled: await this.configLoader.getSupportWhatsappEnabled(),
      whatsappUrl: await this.configLoader.getSupportWhatsappUrl(),
    };

    const sportsGameCode = await this.configLoader.getSportsGameCode();

    const firebaseConfig = await this.fcm.getConfig();
    const firebase = this.fcm.getWebConfig(firebaseConfig);

    const appVersion = await this.appVersion.getConfig();

    const groupChatSettings = await this.configLoader.getGroupChatSettings();

    return {
      appName,
      appVersion,
      currency,
      siteUrl,
      loginBgLightUrl,
      loginBgDarkUrl,
      sportsGameCode,
      marqueeText: await this.configLoader.getMarqueeText(),
      gameTypes: gameTypes.map((g) => ({
        type: g.gameType,
        label: g.label,
        emoji: g.emoji ? g.emoji : DEFAULT_GAME_TYPE_EMOJI,
        themeColor: g.themeColor ? g.themeColor : null,
        isLottery: Number(g.isLottery) === 1,
        isThirdParty: Number(g.isThirdParty) === 1,
      })),
      colorMap: ui.colorMap,
      statusMaps: ui.statusMaps,
      support,
      otp: await this.configLoader.getOtpClientConfig(),
      socialLogin: await this.configLoader.getSocialLoginConfig(),
      vipEnabled: await this.configLoader.getVipEnabled(),
      rechargeBonusEnabled: await this.configLoader.getRechargeBonusEnabled(),
      groupChatEnabled: groupChatSettings.enabled,
      groupChatImageEnabled: groupChatSettings.imageEnabled,
      firebase,
      ui: {
        stateNames: ui.stateNames,
        stateColors: ui.stateColors,
        positionColors: ui.positionColors,
        positionGradients: ui.positionGradients,
        defaultPayRate: ui.defaultPayRate,
        mysteryBoxGradients: ui.mysteryBoxGradients,
        resultTabs: ui.resultTabs,
        gameCategories: ui.gameCategories,
        spriteScale: ui.spriteScale,
      },
    };
  }

  async getBannerList() {
    const now = new Date();
    const banners = await this.bannerRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'DESC' },
    });

    return banners
      .filter((b) => {
        if (b.startTime && b.startTime > now) return false;
        if (b.endTime && b.endTime < now) return false;
        return true;
      })
      .map((b) => ({
        id: b.id,
        img: b.imageUrl,
        imgId: '',
        skipUrl: b.linkUrl ?? '',
        sort: b.sortOrder,
      }));
  }

  async getSharePosterList() {
    const posters = await this.sharePosterRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC' },
    });
    return posters.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      sortOrder: p.sortOrder,
    }));
  }

  async getPopList() {
    const now = new Date();
    const popups = await this.popupRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'DESC' },
    });

    return popups
      .filter((p) => {
        if (p.startTime && p.startTime > now) return false;
        if (p.endTime && p.endTime < now) return false;
        return true;
      })
      .map((p) => ({
        id: p.id,
        img: p.imageUrl ?? '',
        imgId: '',
        skipUrl: p.linkUrl ?? '',
        sort: p.sortOrder ?? 0,
      }));
  }

  async getGameList(userId: string | null, dto: GameListDto) {
    const categoryId = dto.categoryId;
    const pageSize = dto.pageSize;
    const pageNum = dto.pageNum;

    const allGamesRaw = await this.gameListRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: 1 })
      .andWhere('g.is_hidden = :hidden', { hidden: 0 })
      .andWhere('g.emergency_stop = :stopped', { stopped: 0 })
      .andWhere(
        '(g.is_third_party = 0 OR (g.game_uid IS NOT NULL AND g.game_uid <> :emptyUid))',
        { emptyUid: '' },
      )
      .orderBy('g.sort_order', 'ASC')
      .getMany();

    const seenQuickType = new Set<string>();
    const allGames = allGamesRaw.filter((g) => {
      if (g.isQuick !== 1) return true;
      if (seenQuickType.has(g.gameType)) return false;
      seenQuickType.add(g.gameType);
      return true;
    });

    const nowSec = Math.floor(Date.now() / 1000);

    const tkGameIds = allGames
      .filter((g) => g.source === 'TK')
      .map((g) => g.id);
    const currentRounds =
      tkGameIds.length > 0
        ? await this.roundRepo
            .createQueryBuilder('r')
            .where('r.game_id IN (:...ids)', { ids: tkGameIds })
            .andWhere('r.status = :status', { status: 0 })
            .orderBy('r.draw_time', 'ASC')
            .getMany()
        : [];

    const roundMap: Record<number, GameRound> = {};
    for (const r of currentRounds) {
      if (!roundMap[r.gameId]) roundMap[r.gameId] = r;
    }

    const lastCompletedRounds =
      tkGameIds.length > 0
        ? await this.roundRepo
            .createQueryBuilder('r')
            .where('r.game_id IN (:...ids)', { ids: tkGameIds })
            .andWhere('r.status = :status', { status: 2 })
            .orderBy('r.draw_time', 'DESC')
            .getMany()
        : [];

    const lastRoundMap: Record<number, GameRound> = {};
    for (const r of lastCompletedRounds) {
      if (!lastRoundMap[r.gameId]) lastRoundMap[r.gameId] = r;
    }

    const manualLotteryIds = allGames
      .filter(
        (g) =>
          g.source === 'TK' &&
          g.isLottery === TinyFlag.Yes &&
          g.lotteryType === LotteryDrawMode.Manual,
      )
      .map((g) => g.id);
    const manualLiveRounds =
      manualLotteryIds.length > 0
        ? await this.roundRepo
            .createQueryBuilder('r')
            .where('r.game_id IN (:...ids)', { ids: manualLotteryIds })
            .andWhere('r.status IN (:...st)', { st: [0, 1] })
            .orderBy('r.draw_time', 'ASC')
            .getMany()
        : [];
    const nowMs = Date.now();
    const manualLiveSet = new Set<number>();
    const manualOpenSet = new Set<number>();
    const manualNextMap: Record<number, GameRound> = {};
    for (const r of manualLiveRounds) {
      manualLiveSet.add(r.gameId);
      const drawMs = r.drawTime ? new Date(r.drawTime).getTime() : 0;
      if (r.status === 0 && drawMs > nowMs) manualOpenSet.add(r.gameId);
      if (!manualNextMap[r.gameId] && drawMs > nowMs) {
        manualNextMap[r.gameId] = r;
      }
    }
    const inactiveManualIds = new Set(
      manualLotteryIds.filter((id) => {
        if (manualLiveSet.has(id)) return false;
        const g = allGames.find((x) => x.id === id);
        const schedSec = g?.scheduledDrawTime
          ? Math.floor(new Date(g.scheduledDrawTime).getTime() / 1000)
          : 0;
        return schedSec <= nowSec;
      }),
    );

    const notStartedIds = new Set(
      allGames
        .filter(
          (g) =>
            g.isLottery === TinyFlag.Yes &&
            g.autoGenerate === TinyFlag.No &&
            g.startDate !== null &&
            new Date(g.startDate).getTime() > nowMs,
        )
        .map((g) => g.id),
    );

    let collectSet = new Set<string>();
    if (userId) {
      const favorites = await this.favoriteRepo.find({ where: { userId } });
      collectSet = new Set(favorites.map((f) => f.gameCode));
    }

    const mapGame = (g: GameList) => {
      const round = roundMap[g.id];
      const isTK = g.source === 'TK';
      let drawTimeSec = 0;
      let startTimeSec = 0;
      let countDown = 0;
      let result = '';

      const isManualLottery =
        g.isLottery === TinyFlag.Yes &&
        g.lotteryType === LotteryDrawMode.Manual;

      if (isTK && isManualLottery) {
        const next = manualNextMap[g.id];
        const scheduledSec = g.scheduledDrawTime
          ? Math.floor(new Date(g.scheduledDrawTime).getTime() / 1000)
          : 0;
        drawTimeSec = next?.drawTime
          ? Math.floor(new Date(next.drawTime).getTime() / 1000)
          : scheduledSec > nowSec
            ? scheduledSec
            : 0;
        startTimeSec = 0;
        countDown = drawTimeSec > nowSec ? drawTimeSec - nowSec : 0;
      } else if (isTK && g.drawInterval > 0) {
        drawTimeSec = round?.drawTime
          ? Math.floor(new Date(round.drawTime).getTime() / 1000)
          : nowSec + g.drawInterval;
        startTimeSec = drawTimeSec - g.drawInterval;
        countDown = Math.max(0, drawTimeSec - nowSec);
      }

      const lastRound = lastRoundMap[g.id];
      if (lastRound?.result) {
        result = this.extractResultString(g.gameType, lastRound.result);
      }

      return {
        source: g.source,
        provider: g.provider,
        gameCode: g.gameCode,
        gameName: g.gameName,
        gamePic: g.iconUrl ?? '',
        verticalPic: g.bannerUrl ?? '',
        thumbnailPic: g.thumbnailUrl ?? '',
        categoryId: g.categoryId ?? LOBBY_DEFAULT_CATEGORY_ID,
        countDown,
        startTime: startTimeSec,
        drawTime: drawTimeSec,
        gameId: isTK ? String(g.id) : '',
        maxPrize: g.maxPrize ?? '',
        result,
        sellingPrice: Number(g.sellingPrice),
        isQuick: g.quickCycleSec ? 1 : 0,
        cycle: g.quickCycleSec ? g.drawInterval / 60 : 0,
        gameType: this.displayGameType(g.gameType),
        nickname: '',
        bigWin: 0,
        isCollect: collectSet.has(g.gameCode),
        imgId: g.imgId ?? '',
        isLottery: g.isLottery,
        drawInProgress:
          isManualLottery && manualLiveSet.has(g.id) && !manualOpenSet.has(g.id)
            ? 1
            : 0,
        themeColor: g.themeColor ?? '',
        emoji: g.emoji ?? '',
        groupName: g.groupName ?? '',
        lotteryType: g.lotteryType,
        scheduledDrawTime: g.scheduledDrawTime
          ? Math.floor(new Date(g.scheduledDrawTime).getTime() / 1000)
          : 0,
        emergencyStop: g.emergencyStop,
      };
    };

    const socialLinks = await this.getSocialLinks();

    const hiddenGameIds = new Set<number>([
      ...inactiveManualIds,
      ...notStartedIds,
    ]);
    const visibleGames = hiddenGameIds.size
      ? allGames.filter((g) => !hiddenGameIds.has(g.id))
      : allGames;

    if (categoryId === LOBBY_CATEGORY_ID) {
      const placementMap = await this.gameConfig.getLobbyPlacementMap(
        visibleGames.map((g) => g.id),
      );
      return this.buildLobbyResponse(
        visibleGames,
        mapGame,
        collectSet,
        socialLinks,
        placementMap,
      );
    }

    if (categoryId === LOTTERY_CATEGORY_ID) {
      return this.buildLotteryResponse(
        visibleGames,
        mapGame,
        collectSet,
        socialLinks,
        dto.filterType,
      );
    }

    return this.buildCategoryResponse(
      visibleGames,
      categoryId,
      mapGame,
      collectSet,
      socialLinks,
      pageSize,
      pageNum,
      dto.filterType,
    );
  }

  private async buildLobbyResponse(
    allGames: GameList[],
    mapGame: (g: GameList) => any,
    collectSet: Set<string>,
    socialLinks: any,
    placementMap: Map<number, LobbyPlacementView[]>,
  ) {
    const sectionGames: Record<string, { game: any; order: number }[]> = {};
    for (const sectionType of LOBBY_SECTIONS_ORDER) {
      sectionGames[sectionType] = [];
    }

    for (const g of allGames) {
      const placements = placementMap.get(g.id);
      if (!placements || placements.length === 0) continue;
      const mapped = { ...mapGame(g) };
      if (g.lobbyIconUrl) {
        mapped.gamePic = g.lobbyIconUrl;
        mapped.verticalPic = '';
      }

      for (const placement of placements) {
        if (!sectionGames[placement.section]) {
          sectionGames[placement.section] = [];
        }
        sectionGames[placement.section].push({
          game: mapped,
          order: placement.sortOrder,
        });
      }
    }

    const filterList = await this.configLoader.getLobbySections('lobby');
    const lobbyCfg = await this.configLoader.getLobbyConfig();
    const filterIcon = lobbyCfg.filterIcon;
    const lightIcon = lobbyCfg.lightIcon;
    const filterSize = lobbyCfg.filterSize;

    const list: any[] = [];
    for (const sectionType of LOBBY_SECTIONS_ORDER) {
      const items = sectionGames[sectionType];
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.order - b.order);

      const filterEntry = filterList.find((f) => f.filterType === sectionType);
      list.push({
        filterType: sectionType,
        filterName: filterEntry ? filterEntry.filterName : sectionType,
        games: items.map((i) => i.game),
        rows:
          filterEntry && filterEntry.rows !== undefined ? filterEntry.rows : 2,
        totalPages: 1,
        totalSize: items.length,
      });
    }

    const homeGame = allGames.find((g) => g.gameCode === 'BRC');
    const home: any[] = [];
    if (homeGame) {
      home.push(mapGame(homeGame));
    }

    const allMapped = allGames.map(mapGame);
    const collectGames = allMapped.filter((g) => g.isCollect);

    return {
      collect: collectGames,
      filterIcon,
      filterList,
      filterSize,
      group: socialLinks,
      home,
      lightIcon,
      list,
      providers: await this.getProviderList(),
      recent: [],
    };
  }

  private async buildLotteryResponse(
    allGames: GameList[],
    mapGame: (g: GameList) => any,
    collectSet: Set<string>,
    socialLinks: any,
    filterType?: string,
  ) {
    const lotteryGames = allGames.filter(
      (g) => g.categoryId === LOTTERY_CATEGORY_ID,
    );
    const filterList = await this.configLoader.getLobbySections('lottery');
    const lobbyCfg = await this.configLoader.getLobbyConfig();
    const filterIcon = lobbyCfg.filterIcon;
    const lightIcon = lobbyCfg.lightIcon;
    const filterSize = lobbyCfg.filterSize;

    const typeGroups: Record<string, any[]> = {};
    for (const g of lotteryGames) {
      const displayType =
        g.gameType === 'pjb'
          ? Number(g.digitCount) === 3
            ? '3Digits'
            : 'Digit 4 & 5'
          : this.displayGameType(g.gameType);
      if (!displayType) continue;
      if (!typeGroups[displayType]) typeGroups[displayType] = [];
      typeGroups[displayType].push(mapGame(g));
    }

    let list: any[] = [];
    for (const entry of filterList) {
      const typeName = entry.filterName;
      const games = Object.prototype.hasOwnProperty.call(typeGroups, typeName)
        ? typeGroups[typeName]
        : [];
      if (games.length === 0) continue;
      list.push({
        filterType: entry.filterType,
        filterName: typeName,
        games,
        rows: entry.rows ? entry.rows : undefined,
        totalPages: 1,
        totalSize: games.length,
      });
    }

    if (filterType && filterType !== 'All') {
      list = list.filter((s) => s.filterType === filterType);
    }

    const visibleFilterList = filterList.filter((entry) => {
      const group = typeGroups[entry.filterName];
      return group !== undefined && group.length > 0;
    });

    const homeGame = allGames.find((g) => g.gameCode === 'BRC');
    const home: any[] = [];
    if (homeGame) {
      home.push(mapGame(homeGame));
    }

    const allMapped = lotteryGames.map(mapGame);
    const collectGames = allMapped.filter((g) => g.isCollect);

    return {
      collect: collectGames,
      filterIcon,
      filterList: visibleFilterList,
      filterSize,
      group: socialLinks,
      home,
      lightIcon,
      list,
      providers: await this.getProviderList(),
      recent: [],
    };
  }

  private async buildCategoryResponse(
    allGames: GameList[],
    categoryId: number,
    mapGame: (g: GameList) => any,
    collectSet: Set<string>,
    socialLinks: any,
    pageSize: number,
    pageNum: number,
    filterType?: string,
  ) {
    const categoryGames = allGames.filter((g) => g.categoryId === categoryId);

    const lobbyCfg = await this.configLoader.getLobbyConfig();
    const filterIcon = lobbyCfg.filterIcon;
    const lightIcon = lobbyCfg.lightIcon;
    const filterSize = lobbyCfg.filterSize;

    const filterList = await this.configLoader.getLobbyProviders(categoryId);

    const providerGroups: Record<string, any[]> = {};
    for (const g of categoryGames) {
      const prov = g.provider !== '' ? g.provider : 'Other';
      if (!providerGroups[prov]) providerGroups[prov] = [];
      providerGroups[prov].push(mapGame(g));
    }

    let list: any[];
    if (filterType && filterType !== 'Hot') {
      const games = Object.prototype.hasOwnProperty.call(
        providerGroups,
        filterType,
      )
        ? providerGroups[filterType]
        : [];
      const start = (pageNum - 1) * pageSize;
      const paged = games.slice(start, start + pageSize);
      list = [
        {
          filterType,
          filterName: filterType,
          games: paged,
          totalPages: Math.ceil(games.length / pageSize),
          totalSize: games.length,
        },
      ];
    } else {
      list = [];
      const order =
        filterList.length > 0
          ? filterList.map((f) => f.filterType)
          : Object.keys(providerGroups);
      for (const prov of order) {
        const games = providerGroups[prov];
        if (!games || games.length === 0) continue;
        const entry = filterList.find((f) => f.filterType === prov);
        list.push({
          filterType: prov,
          filterName: entry ? entry.filterName : prov,
          games,
          totalPages: 1,
          totalSize: games.length,
        });
      }
    }

    const allMapped = categoryGames.map(mapGame);
    const collectGames = allMapped.filter((g) => g.isCollect);

    const homeGame = allGames.find((g) => g.gameCode === 'BRC');
    const home: any[] = homeGame ? [mapGame(homeGame)] : [];

    return {
      collect: collectGames,
      filterIcon,
      filterList,
      filterSize,
      group: socialLinks,
      home,
      lightIcon,
      list,
      providers: await this.getProviderList(),
      recent: [],
    };
  }

  async searchGames(dto: SearchGamesDto) {
    const pageSize = dto.pageSize;
    const pageNum = dto.pageNum;

    const qb = this.gameListRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: 1 })
      .andWhere('g.is_hidden = :hidden', { hidden: 0 })
      .andWhere('g.emergency_stop = :stopped', { stopped: 0 })
      .andWhere(
        '(g.is_third_party = 0 OR (g.game_uid IS NOT NULL AND g.game_uid <> :emptyUid))',
        { emptyUid: '' },
      );

    if (dto.keyword) {
      qb.andWhere('g.game_name LIKE :kw', { kw: `%${dto.keyword}%` });
    }

    if (dto.categoryId && dto.categoryId !== LOBBY_CATEGORY_ID) {
      qb.andWhere('g.category_id = :catId', { catId: dto.categoryId });
    }

    const [games, total] = await qb
      .orderBy('g.sort_order', 'ASC')
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      list: games.map((g) => ({
        source: g.source,
        provider: g.provider,
        gameCode: g.gameCode,
        gameName: g.gameName,
        gamePic: g.iconUrl ?? '',
        verticalPic: g.bannerUrl ?? '',
        thumbnailPic: g.thumbnailUrl ?? '',
        categoryId: g.categoryId ?? LOBBY_DEFAULT_CATEGORY_ID,
        gameId: g.source === 'TK' ? String(g.id) : '',
        gameType: this.displayGameType(g.gameType),
        imgId: g.imgId ?? '',
        sellingPrice: Number(g.sellingPrice),
        isHot: g.isHot,
        maxPrize: g.maxPrize ?? '',
        nickname: '',
        bigWin: 0,
        isCollect: false,
        isQuick: g.quickCycleSec ? 1 : 0,
        cycle: g.quickCycleSec ? g.drawInterval / 60 : 0,
        countDown: 0,
        startTime: 0,
        drawTime: 0,
        result: '',
        isLottery: g.isLottery,
        themeColor: g.themeColor ?? '',
        emoji: g.emoji ?? '',
        groupName: g.groupName ?? '',
        lotteryType: g.lotteryType,
      })),
      total,
      pageSize,
      pageNum,
    };
  }

  async toggleCollect(userId: string, dto: ToggleCollectDto) {
    if (dto.collect) {
      const existing = await this.favoriteRepo.findOne({
        where: { userId, gameCode: dto.gameCode },
      });
      if (!existing) {
        await this.favoriteRepo.save(
          this.favoriteRepo.create({ userId, gameCode: dto.gameCode }),
        );
      }
    } else {
      await this.favoriteRepo.delete({ userId, gameCode: dto.gameCode });
    }

    return true;
  }

  async getCasinoGameUrl(
    userId: string,
    dto: { gameCode: string; lobbyUrl?: string },
    homeUrl?: string,
  ) {
    return this.thirdParty.getLaunchUrl(userId, dto.gameCode, homeUrl);
  }

  async redeemCdKey(userId: string, cdKey: string) {
    if (!cdKey || cdKey.length < 6) {
      throw new BadRequestException('This gift code is invalid or has expired');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const code = await queryRunner.manager
        .getRepository(CdkeyCode)
        .findOne({ where: { cdKey } });

      if (!code || code.status !== 1) {
        throw new BadRequestException(
          'This gift code is invalid or has expired',
        );
      }

      if (code.expiredAt && new Date(code.expiredAt) < new Date()) {
        throw new BadRequestException(
          'This gift code is invalid or has expired',
        );
      }

      const maxUses = code.maxUses;
      if (code.usedCount >= maxUses) {
        throw new BadRequestException(
          'This gift code has reached its usage limit',
        );
      }

      const existingUsage = await queryRunner.manager
        .getRepository(CdkeyUsage)
        .findOne({ where: { cdkeyId: code.id, userId } });

      if (existingUsage) {
        throw new BadRequestException('This gift code has already been used');
      }

      const consume = await queryRunner.manager
        .createQueryBuilder()
        .update(CdkeyCode)
        .set({ usedCount: () => 'used_count + 1' })
        .where('id = :id AND used_count < :maxUses', { id: code.id, maxUses })
        .execute();

      if (consume.affected !== 1) {
        throw new BadRequestException(
          'This gift code has reached its usage limit',
        );
      }

      try {
        await queryRunner.manager.getRepository(CdkeyUsage).insert({
          cdkeyId: code.id,
          userId,
        });
      } catch (insertErr) {
        if (insertErr instanceof BadRequestException) throw insertErr;
        throw new BadRequestException('This gift code has already been used');
      }

      const amount = Number(code.awardAmount);
      const awardType = code.awardType;

      if (amount > 0) {
        const credit = await queryRunner.manager
          .createQueryBuilder()
          .update(User)
          .set({
            balance: () => `balance + ${amount}`,
            version: () => 'version + 1',
          })
          .where('user_id = :userId', { userId })
          .execute();

        if (credit.affected !== 1) {
          throw new BadRequestException('User not found');
        }

        const user = await queryRunner.manager
          .getRepository(User)
          .findOne({ where: { userId } });

        if (!user) {
          throw new BadRequestException('User not found');
        }

        await queryRunner.manager.getRepository(Transaction).save(
          queryRunner.manager.getRepository(Transaction).create({
            userId,
            sourceType: 'cdkey',
            amount,
            balance: Number(user.balance),
            refId: cdKey,
            description: `CD Key redeem: ${cdKey}`,
          }),
        );
      }

      await queryRunner.commitTransaction();

      return {
        amount,
        type: awardType,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getShareList(dto: ShareListDto) {
    const limit = dto.limit;
    const channels = await this.configLoader.getShareChannels();
    return channels.slice(0, limit);
  }

  async trackShareClick(dto: { id: number }) {
    void dto;
    return true;
  }

  async getGameRules(gameId: number) {
    const game = await this.gameListRepo.findOne({ where: { id: gameId } });
    if (!game) return { gameId, gameType: null, sections: [] };
    const sections = await this.gameConfig.getRuleSections(gameId);
    return { gameId, gameType: game.gameType, sections };
  }

  async getNoticeList() {
    const now = new Date();
    const announcements = await this.announcementRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'DESC', id: 'DESC' },
    });

    const active = announcements.filter((a) => {
      if (a.startTime && a.startTime > now) return false;
      if (a.endTime && a.endTime < now) return false;
      return true;
    });

    if (active.length > 0) {
      return active.map((a) => ({
        type: 'system',
        content: a.content,
      }));
    }

    const marquee = await this.configLoader.getMarqueeText();
    if (marquee) {
      return [{ type: 'system', content: marquee }];
    }

    return [];
  }

  private async getSocialLinks() {
    return this.configLoader.getSocialLinks();
  }

  private displayGameType(gameType: string): string {
    return Object.prototype.hasOwnProperty.call(GAME_TYPE_MAP, gameType)
      ? GAME_TYPE_MAP[gameType]
      : gameType;
  }

  private extractResultString(
    gameType: string,
    result: RoundResultBlob,
  ): string {
    if (!result) return '';
    switch (gameType) {
      case 'color':
        return result.number != null ? String(result.number) : '';
      case 'dice':
        return Array.isArray(result.dice) ? result.dice.join(',') : '';
      case 'race':
        if (result.winner != null) return String(result.winner);
        return result.drawResult ? result.drawResult : '';
      default:
        return result.drawResult ? result.drawResult : '';
    }
  }

  private async getProviderList() {
    return this.configLoader.getLobbyProviders(null);
  }
}
