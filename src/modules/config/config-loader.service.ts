import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity';
import { FinanceConfig } from '../../entities/finance-config.entity';
import { RechargePreset } from '../../entities/recharge-preset.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { LobbySection } from '../../entities/lobby-section.entity';
import { LobbyProvider } from '../../entities/lobby-provider.entity';
import { LobbyConfig } from '../../entities/lobby-config.entity';
import { UiConfig } from '../../entities/ui-config.entity';
import { UiColorMap } from '../../entities/ui-color-map.entity';
import { UiStatusMap } from '../../entities/ui-status-map.entity';
import { UiState } from '../../entities/ui-state.entity';
import { UiPosition } from '../../entities/ui-position.entity';
import { UiPayRate } from '../../entities/ui-pay-rate.entity';
import { UiMysteryBoxGradient } from '../../entities/ui-mystery-box-gradient.entity';
import { UiResultTab } from '../../entities/ui-result-tab.entity';
import { ShareChannel } from '../../entities/share-channel.entity';
import { OddsAlias } from '../../entities/odds-alias.entity';

@Injectable()
export class ConfigLoaderService implements OnModuleInit {
  private readonly logger = new Logger(ConfigLoaderService.name);
  private cache = new Map<string, string>();
  private lastRefresh = 0;
  private readonly refreshIntervalMs = 60_000;
  private finance: FinanceConfig | null = null;
  private rechargePresets: RechargePreset[] = [];
  private app: AppConfig | null = null;
  private lobbySections: LobbySection[] = [];
  private lobbyProviders: LobbyProvider[] = [];
  private lobbyCfg: LobbyConfig | null = null;
  private uiConfig: UiConfig | null = null;
  private uiColorMap: UiColorMap[] = [];
  private uiStatusMap: UiStatusMap[] = [];
  private uiState: UiState[] = [];
  private uiPosition: UiPosition[] = [];
  private uiPayRate: UiPayRate[] = [];
  private uiMysteryBoxGradient: UiMysteryBoxGradient[] = [];
  private uiResultTab: UiResultTab[] = [];
  private shareChannels: ShareChannel[] = [];
  private oddsAlias: OddsAlias[] = [];

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(FinanceConfig)
    private readonly financeRepo: Repository<FinanceConfig>,
    @InjectRepository(RechargePreset)
    private readonly rechargePresetRepo: Repository<RechargePreset>,
    @InjectRepository(AppConfig)
    private readonly appRepo: Repository<AppConfig>,
    @InjectRepository(LobbySection)
    private readonly lobbySectionRepo: Repository<LobbySection>,
    @InjectRepository(LobbyProvider)
    private readonly lobbyProviderRepo: Repository<LobbyProvider>,
    @InjectRepository(LobbyConfig)
    private readonly lobbyConfigRepo: Repository<LobbyConfig>,
    @InjectRepository(UiConfig)
    private readonly uiConfigRepo: Repository<UiConfig>,
    @InjectRepository(UiColorMap)
    private readonly uiColorMapRepo: Repository<UiColorMap>,
    @InjectRepository(UiStatusMap)
    private readonly uiStatusMapRepo: Repository<UiStatusMap>,
    @InjectRepository(UiState)
    private readonly uiStateRepo: Repository<UiState>,
    @InjectRepository(UiPosition)
    private readonly uiPositionRepo: Repository<UiPosition>,
    @InjectRepository(UiPayRate)
    private readonly uiPayRateRepo: Repository<UiPayRate>,
    @InjectRepository(UiMysteryBoxGradient)
    private readonly uiMboxRepo: Repository<UiMysteryBoxGradient>,
    @InjectRepository(UiResultTab)
    private readonly uiResultTabRepo: Repository<UiResultTab>,
    @InjectRepository(ShareChannel)
    private readonly shareChannelRepo: Repository<ShareChannel>,
    @InjectRepository(OddsAlias)
    private readonly oddsAliasRepo: Repository<OddsAlias>,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  async getString(key: string, fallback = ''): Promise<string> {
    await this.ensureFresh();
    return this.cache.get(key) ?? fallback;
  }

  async getJson<T = any>(key: string, fallback?: T): Promise<T> {
    const val = await this.getString(key);
    if (!val) return fallback as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback as T;
    }
  }

  private async getFinanceConfig(): Promise<FinanceConfig> {
    await this.ensureFresh();
    if (!this.finance) {
      throw new Error(
        'finance_config is not seeded — run the finance seed before serving finance config',
      );
    }
    return this.finance;
  }

  async getWithdrawFeeRate(): Promise<number> {
    return Number((await this.getFinanceConfig()).withdrawFeeRate);
  }

  async getWithdrawMinAmount(): Promise<number> {
    return Number((await this.getFinanceConfig()).withdrawMinAmount);
  }

  async getWithdrawMaxAmount(): Promise<number> {
    return Number((await this.getFinanceConfig()).withdrawMaxAmount);
  }

  async getWageRate(): Promise<number> {
    return Number((await this.getFinanceConfig()).wageRate);
  }

  async getWageMinBet(): Promise<number> {
    return Number((await this.getFinanceConfig()).wageMinBet);
  }

  async getWithdrawDailyCount(): Promise<number> {
    return (await this.getFinanceConfig()).withdrawDailyCount;
  }

  async getWithdrawExplain(): Promise<string> {
    return (await this.getFinanceConfig()).withdrawExplain;
  }

  async getTransferMinAmount(): Promise<number> {
    return Number((await this.getFinanceConfig()).transferMinAmount);
  }

  async getTransferMaxAmount(): Promise<number> {
    return Number((await this.getFinanceConfig()).transferMaxAmount);
  }

  async getRechargePresets(): Promise<
    Array<{ amount: number; mark: string; bonusPct: number }>
  > {
    await this.ensureFresh();
    return this.rechargePresets.map((preset) => ({
      amount: Number(preset.amount),
      mark: preset.mark,
      bonusPct: Number(preset.bonusPct),
    }));
  }

  private async getAppConfigEntity(): Promise<AppConfig> {
    await this.ensureFresh();
    if (!this.app) {
      throw new Error(
        'app_config is not seeded — run the app seed before serving app config',
      );
    }
    return this.app;
  }

  async getSchedulerTickMs(): Promise<number> {
    return (await this.getAppConfigEntity()).schedulerTickMs;
  }

  async getGameinfoCacheTtlMs(): Promise<number> {
    return (await this.getAppConfigEntity()).gameinfoCacheTtlMs;
  }

  async getRoundCooldownMs(): Promise<number> {
    return (await this.getAppConfigEntity()).roundCooldownMs;
  }

  async getAppName(): Promise<string> {
    return (await this.getAppConfigEntity()).appName;
  }

  async getSiteUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).siteUrl;
  }

  async getCurrency(): Promise<string> {
    return (await this.getAppConfigEntity()).currency;
  }

  async getMarqueeText(): Promise<string> {
    return (await this.getAppConfigEntity()).marqueeText;
  }

  async getVipEnabled(): Promise<boolean> {
    return (await this.getAppConfigEntity()).vipEnabled !== 0;
  }

  async getRechargeBonusEnabled(): Promise<boolean> {
    return (await this.getAppConfigEntity()).rechargeBonusEnabled !== 0;
  }

  async getSupportChatEnabled(): Promise<boolean> {
    return (await this.getAppConfigEntity()).supportChatEnabled === 1;
  }

  async getSupportChatProvider(): Promise<string> {
    return (await this.getAppConfigEntity()).supportChatProvider;
  }

  async getSupportChatLicense(): Promise<string> {
    return (await this.getAppConfigEntity()).supportChatLicense;
  }

  async getGroupChatSettings(): Promise<{
    enabled: boolean;
    blockLinks: boolean;
    imageEnabled: boolean;
    voiceEnabled: boolean;
    dmEnabled: boolean;
    badWords: string;
  }> {
    const app = await this.getAppConfigEntity();
    return {
      enabled: app.groupChatEnabled === 1,
      blockLinks: app.groupChatBlockLinks === 1,
      imageEnabled: app.groupChatImageEnabled === 1,
      voiceEnabled: app.groupChatVoiceEnabled === 1,
      dmEnabled: app.groupChatDmEnabled === 1,
      badWords: app.groupChatBadWords === null ? '' : app.groupChatBadWords,
    };
  }

  async getSupportTelegramUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).supportTelegramUrl;
  }

  async getSupportWhatsappEnabled(): Promise<boolean> {
    return (await this.getAppConfigEntity()).supportWhatsappEnabled === 1;
  }

  async getSupportWhatsappUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).supportWhatsappUrl;
  }

  async getSportsGameCode(): Promise<string> {
    return (await this.getAppConfigEntity()).sportsGameCode;
  }

  async getSocialLinks(): Promise<{
    tg_link: string;
    wa_link: string;
    x_link: string;
    facebook_link: string;
    instagram_link: string;
  }> {
    const app = await this.getAppConfigEntity();
    return {
      tg_link: app.tgLink,
      wa_link: app.waLink,
      x_link: app.xLink,
      facebook_link: app.facebookLink,
      instagram_link: app.instagramLink,
    };
  }

  async getLoginBgLightUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).loginBgLightUrl;
  }

  async getLoginBgDarkUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).loginBgDarkUrl;
  }

  async getResultModeDefault(): Promise<string> {
    return (await this.getAppConfigEntity()).resultModeDefault;
  }

  async getResultHouseEdgeDefault(): Promise<number> {
    return Number((await this.getAppConfigEntity()).resultHouseEdgeDefault);
  }

  async getResultSampleSize(): Promise<number> {
    return (await this.getAppConfigEntity()).resultSampleSize;
  }

  async getResultDecisionBudgetMs(): Promise<number> {
    return (await this.getAppConfigEntity()).resultDecisionBudgetMs;
  }

  async getOddsMissingPolicy(): Promise<string> {
    return (await this.getAppConfigEntity()).oddsMissingPolicy;
  }

  async getBigwinMinAmount(): Promise<number> {
    return Number((await this.getAppConfigEntity()).bigwinMinAmount);
  }

  async getBigwinTemplate(): Promise<string> {
    return (await this.getAppConfigEntity()).bigwinTemplate;
  }

  async getActivePaymentGateway(): Promise<string> {
    return (await this.getAppConfigEntity()).activePaymentGateway;
  }

  async getManualPayUrl(): Promise<string> {
    return (await this.getAppConfigEntity()).manualPayUrl;
  }

  async getOtpClientConfig(): Promise<{
    enabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
  }> {
    const app = await this.getAppConfigEntity();
    return {
      enabled: app.otpEnabled === 1,
      smsEnabled: app.smsEnabled === 1,
      whatsappEnabled: app.whatsappEnabled === 1,
    };
  }

  async getSocialLoginConfig(): Promise<{ enabled: boolean }> {
    const app = await this.getAppConfigEntity();
    return { enabled: app.socialLoginEnabled === 1 };
  }

  async getLobbySections(
    scope: string,
  ): Promise<Array<{ filterType: string; filterName: string; rows?: number }>> {
    await this.ensureFresh();
    return this.lobbySections
      .filter((s) => s.scope === scope)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) =>
        s.rows != null
          ? { filterType: s.filterType, filterName: s.filterName, rows: s.rows }
          : { filterType: s.filterType, filterName: s.filterName },
      );
  }

  async getLobbyProviders(categoryId: number | null): Promise<
    Array<{
      filterType: string;
      filterName: string;
      bigIcon: { x: number; y: number };
      icon: { x: number; y: number };
    }>
  > {
    await this.ensureFresh();
    return this.lobbyProviders
      .filter((p) =>
        categoryId == null ? p.categoryId == null : p.categoryId === categoryId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        filterType: p.filterType,
        filterName: p.filterName,
        bigIcon: { x: p.bigIconX, y: p.bigIconY },
        icon: { x: p.iconX, y: p.iconY },
      }));
  }

  async getLobbyConfig(): Promise<{
    filterIcon: string;
    lightIcon: string;
    filterSize: { width: number; height: number };
  }> {
    await this.ensureFresh();
    if (!this.lobbyCfg) {
      throw new Error(
        'lobby_config is not seeded — run the lobby seed before serving lobby config',
      );
    }
    return {
      filterIcon: this.lobbyCfg.filterIcon,
      lightIcon: this.lobbyCfg.lightIcon,
      filterSize: {
        width: this.lobbyCfg.filterWidth,
        height: this.lobbyCfg.filterHeight,
      },
    };
  }

  async getUiBundle(): Promise<{
    colorMap: Record<string, string[]>;
    statusMaps: Record<string, Record<number, { text: string; color: string }>>;
    stateNames: string[];
    stateColors: string[];
    positionColors: string[];
    positionGradients: string[][];
    defaultPayRate: Array<{ odds: number; type: number }>;
    mysteryBoxGradients: string[];
    resultTabs: Array<{ key: string; label: string }>;
    gameCategories: {
      lottery: number;
      casino: number;
      slot: number;
      lobby: number;
      live: number;
      fishing: number;
    };
    spriteScale: number;
  }> {
    await this.ensureFresh();
    if (!this.uiConfig) {
      throw new Error(
        'ui_config is not seeded — run the ui seed before serving app config',
      );
    }
    const colorMap: Record<string, string[]> = {};
    for (const c of this.uiColorMap) {
      const key = String(c.digit);
      if (!colorMap[key]) colorMap[key] = [];
      colorMap[key].push(c.color);
    }
    const statusMaps: Record<
      string,
      Record<number, { text: string; color: string }>
    > = {};
    for (const s of this.uiStatusMap) {
      if (!statusMaps[s.domain]) statusMaps[s.domain] = {};
      statusMaps[s.domain][s.status] = { text: s.text, color: s.color };
    }
    return {
      colorMap,
      statusMaps,
      stateNames: this.uiState.map((s) => s.name),
      stateColors: this.uiState.map((s) => s.color),
      positionColors: this.uiPosition.map((p) => p.color),
      positionGradients: this.uiPosition.map((p) => [
        p.gradientFrom,
        p.gradientTo,
      ]),
      defaultPayRate: this.uiPayRate.map((p) => ({
        odds: Number(p.odds),
        type: p.type,
      })),
      mysteryBoxGradients: this.uiMysteryBoxGradient.map((g) => g.gradient),
      resultTabs: this.uiResultTab.map((t) => ({ key: t.key, label: t.label })),
      gameCategories: {
        lottery: this.uiConfig.catLottery,
        casino: this.uiConfig.catCasino,
        slot: this.uiConfig.catSlot,
        lobby: this.uiConfig.catLobby,
        live: this.uiConfig.catLive,
        fishing: this.uiConfig.catFishing,
      },
      spriteScale: Number(this.uiConfig.spriteScale),
    };
  }

  async getShareChannels(): Promise<
    Array<{ id: number; name: string; icon: string; url: string }>
  > {
    await this.ensureFresh();
    return this.shareChannels.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      url: c.url,
    }));
  }

  async getOddsAliasMap(): Promise<Record<string, string>> {
    await this.ensureFresh();
    const map: Record<string, string> = {};
    for (const a of this.oddsAlias) map[a.betCode] = a.oddsClass;
    return map;
  }

  async getGroupedConfigs(): Promise<Record<string, any[]>> {
    await this.ensureFresh();
    const rows = await this.configRepo.find({ order: { sortOrder: 'ASC' } });
    const groups: Record<string, any[]> = {};
    for (const row of rows) {
      const group = row.configGroup || 'general';
      if (!groups[group]) groups[group] = [];
      groups[group].push({
        id: row.id,
        key: row.configKey,
        value: row.configVal,
        description: row.description,
        type: row.configType || 'string',
        label: row.displayLabel || row.configKey,
        sortOrder: row.sortOrder,
      });
    }
    return groups;
  }

  async refresh(): Promise<void> {
    try {
      const rows = await this.configRepo.find();
      const newCache = new Map<string, string>();
      for (const row of rows) {
        newCache.set(row.configKey, row.configVal || '');
      }
      this.cache = newCache;
      this.finance = await this.financeRepo.findOne({ where: { id: 1 } });
      this.rechargePresets = await this.rechargePresetRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.app = await this.appRepo.findOne({ where: { id: 1 } });
      this.lobbySections = await this.lobbySectionRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.lobbyProviders = await this.lobbyProviderRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.lobbyCfg = await this.lobbyConfigRepo.findOne({ where: { id: 1 } });
      this.uiConfig = await this.uiConfigRepo.findOne({ where: { id: 1 } });
      this.uiColorMap = await this.uiColorMapRepo.find({
        order: { digit: 'ASC', sortOrder: 'ASC' },
      });
      this.uiStatusMap = await this.uiStatusMapRepo.find({
        order: { id: 'ASC' },
      });
      this.uiState = await this.uiStateRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.uiPosition = await this.uiPositionRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.uiPayRate = await this.uiPayRateRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.uiMysteryBoxGradient = await this.uiMboxRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.uiResultTab = await this.uiResultTabRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.shareChannels = await this.shareChannelRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.oddsAlias = await this.oddsAliasRepo.find({
        order: { sortOrder: 'ASC' },
      });
      this.lastRefresh = Date.now();
      this.logger.log(`Config cache refreshed: ${newCache.size} entries`);
    } catch (err) {
      this.logger.error(
        `Config cache refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastRefresh > this.refreshIntervalMs) {
      await this.refresh();
    }
  }
}
