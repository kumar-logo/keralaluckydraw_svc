import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../../entities/system-config.entity';
import { TransactionType } from '../../../entities/transaction-type.entity';
import { FinanceConfig } from '../../../entities/finance-config.entity';
import { RechargePreset } from '../../../entities/recharge-preset.entity';
import { TransferTier } from '../../../entities/transfer-tier.entity';
import { AppConfig } from '../../../entities/app-config.entity';
import { ThirdPartyConfig } from '../../../entities/third-party-config.entity';
import { UiPosition } from '../../../entities/ui-position.entity';
import { GameList } from '../../../entities/game-list.entity';
import { AdminAuditService } from './admin-audit.service';
import { ConfigLoaderService } from '../../config/config-loader.service';

const DEFAULT_GAME_EMOJI = '🎮';
const DEFAULT_CONFIG_GROUP = 'general';
const DEFAULT_CONFIG_TYPE = 'string';

export interface GroupedConfigItem {
  id: number;
  key: string;
  value: string;
  description: string;
  type: string;
  label: string;
  sortOrder: number;
}

interface RechargePresetInput {
  sortOrder?: number;
  amount: number;
  mark?: string;
  bonusPct?: number;
}

interface TransferTierInput {
  minAmount: number;
  maxAmount: number;
  pct: number;
  sortOrder?: number;
}

type SaveFinanceConfigDto = Partial<FinanceConfig> & {
  rechargePresets?: RechargePresetInput[];
  transferTiers?: TransferTierInput[];
};

export interface StatusLabel {
  text: string;
  color: string;
}

export type StatusMap = Record<string, StatusLabel>;

export interface StatusMaps {
  round: StatusMap;
  order: StatusMap;
  recharge: StatusMap;
  withdraw: StatusMap;
  message: StatusMap;
}

interface GameTypeAggRow {
  gameType: string;
  label: string | null;
  iconUrl: string | null;
  isLottery: string;
  isThirdParty: string;
  emoji: string | null;
  themeColor: string | null;
  gameCount: string;
}

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(TransactionType)
    private txnTypeRepo: Repository<TransactionType>,
    @InjectRepository(FinanceConfig)
    private financeRepo: Repository<FinanceConfig>,
    @InjectRepository(RechargePreset)
    private rechargePresetRepo: Repository<RechargePreset>,
    @InjectRepository(TransferTier)
    private transferTierRepo: Repository<TransferTier>,
    @InjectRepository(AppConfig) private appConfigRepo: Repository<AppConfig>,
    @InjectRepository(ThirdPartyConfig)
    private thirdPartyConfigRepo: Repository<ThirdPartyConfig>,
    @InjectRepository(UiPosition)
    private uiPositionRepo: Repository<UiPosition>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    private audit: AdminAuditService,
    private configLoader: ConfigLoaderService,
  ) {}

  async getConfigs() {
    return this.configRepo.find();
  }

  async setConfig(
    key: string,
    value: string,
    description: string | undefined,
    adminId: number,
  ) {
    const existing = await this.configRepo.findOne({
      where: { configKey: key },
    });
    if (existing) {
      const updateData: Partial<SystemConfig> = { configVal: value };
      if (description !== undefined) updateData.description = description;
      await this.configRepo.update(existing.id, updateData);
    } else {
      await this.configRepo.save(
        this.configRepo.create({
          configKey: key,
          configVal: value,
          description,
        }),
      );
    }
    await this.audit.createAuditLog(adminId, 'set_config', 'config', key, {
      value,
    });
    await this.configLoader.refresh();
  }

  async deleteConfig(id: number, adminId: number) {
    const existing = await this.configRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Config not found');
    await this.configRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_config',
      'config',
      existing.configKey,
    );
  }

  async getGroupedConfigs() {
    const configs = await this.configRepo.find({
      order: { configGroup: 'ASC', sortOrder: 'ASC' },
    });
    const groups: Record<string, GroupedConfigItem[]> = {};
    for (const cfg of configs) {
      const group = cfg.configGroup ? cfg.configGroup : DEFAULT_CONFIG_GROUP;
      if (!groups[group]) groups[group] = [];
      groups[group].push({
        id: cfg.id,
        key: cfg.configKey,
        value: cfg.configVal,
        description: cfg.description,
        type: cfg.configType ? cfg.configType : DEFAULT_CONFIG_TYPE,
        label: cfg.displayLabel ? cfg.displayLabel : cfg.configKey,
        sortOrder: cfg.sortOrder,
      });
    }
    return groups;
  }

  async bulkUpdateConfigs(
    updates: { key: string; value: string }[],
    adminId: number,
  ) {
    for (const u of updates) {
      await this.configRepo.update(
        { configKey: u.key },
        { configVal: u.value },
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'bulk_update_config',
      'system_config',
      'bulk',
      { count: updates.length },
    );
    return { success: true, updated: updates.length };
  }

  async getTransactionTypes() {
    return this.txnTypeRepo.find({ order: { id: 'ASC' } });
  }

  async upsertTransactionType(data: Partial<TransactionType>, adminId: number) {
    if (data.id) {
      await this.txnTypeRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_txn_type',
        'transaction_type',
        String(data.id),
      );
      return this.txnTypeRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.txnTypeRepo.save(this.txnTypeRepo.create(data));
    await this.audit.createAuditLog(
      adminId,
      'create_txn_type',
      'transaction_type',
      String(saved.id),
    );
    return saved;
  }

  async deleteTransactionType(id: number, adminId: number) {
    await this.txnTypeRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_txn_type',
      'transaction_type',
      String(id),
    );
  }

  async getFinanceConfig() {
    const config = await this.financeRepo.findOne({ where: { id: 1 } });
    const rechargePresets = await this.rechargePresetRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const transferTiers = await this.transferTierRepo.find({
      order: { sortOrder: 'ASC' },
    });
    return { ...config, rechargePresets, transferTiers };
  }

  async saveFinanceConfig(data: SaveFinanceConfigDto, adminId: number) {
    const rechargePresets = data.rechargePresets;
    const transferTiers = data.transferTiers;
    const rest: Partial<FinanceConfig> & {
      rechargePresets?: unknown;
      transferTiers?: unknown;
    } = { ...data };
    delete rest.rechargePresets;
    delete rest.transferTiers;
    delete rest.id;
    const existing = await this.financeRepo.findOne({ where: { id: 1 } });
    if (existing) {
      await this.financeRepo.update(existing.id, rest);
    } else {
      await this.financeRepo.save(this.financeRepo.create({ ...rest, id: 1 }));
    }
    if (Array.isArray(rechargePresets)) {
      await this.rechargePresetRepo.clear();
      if (rechargePresets.length > 0) {
        await this.rechargePresetRepo.save(
          rechargePresets.map(
            (
              p: {
                sortOrder?: number;
                amount: number;
                mark?: string;
                bonusPct?: number;
              },
              i: number,
            ) =>
              this.rechargePresetRepo.create({
                sortOrder: p.sortOrder !== undefined ? p.sortOrder : i,
                amount: p.amount,
                mark: p.mark !== undefined ? p.mark : '',
                bonusPct: p.bonusPct !== undefined ? p.bonusPct : 0,
              }),
          ),
        );
      }
    }
    if (Array.isArray(transferTiers)) {
      await this.transferTierRepo.clear();
      if (transferTiers.length > 0) {
        await this.transferTierRepo.save(
          transferTiers.map(
            (
              tier: {
                minAmount: number;
                maxAmount: number;
                pct: number;
                sortOrder?: number;
              },
              i: number,
            ) =>
              this.transferTierRepo.create({
                minAmount: tier.minAmount,
                maxAmount: tier.maxAmount,
                pct: tier.pct,
                sortOrder: tier.sortOrder !== undefined ? tier.sortOrder : i,
              }),
          ),
        );
      }
    }
    await this.audit.createAuditLog(
      adminId,
      'update_finance_config',
      'finance_config',
      '1',
    );
    await this.configLoader.refresh();
    return this.getFinanceConfig();
  }

  async getAppConfig() {
    return this.appConfigRepo.findOne({ where: { id: 1 } });
  }

  async saveAppConfig(data: Partial<AppConfig>, adminId: number) {
    const rest: Partial<AppConfig> = { ...data };
    delete rest.id;
    delete rest.updatedAt;
    const existing = await this.appConfigRepo.findOne({ where: { id: 1 } });
    if (existing) {
      await this.appConfigRepo.update(existing.id, rest);
    } else {
      await this.appConfigRepo.save(
        this.appConfigRepo.create({ ...rest, id: 1 }),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'update_app_config',
      'app_config',
      '1',
    );
    // Bust the 60s ConfigLoader cache so OTP/app-config toggles take effect
    // immediately (otherwise the SPA's client config lags up to a minute and
    // appeared to require a restart).
    await this.configLoader.refresh();
    return this.getAppConfig();
  }

  async getThirdPartyConfig() {
    let config = await this.thirdPartyConfigRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!config) {
      config = await this.thirdPartyConfigRepo.save(
        this.thirdPartyConfigRepo.create({
          id: 1,
          agencyUid: '',
          memberPrefix: '',
          memberSuffix: '',
          currency: 'INR',
          language: 'en',
          platform: 1,
          launchUrl: '',
          callbackSecret: null,
          enabled: 1,
        }),
      );
    }
    return config;
  }

  async saveThirdPartyConfig(data: Partial<ThirdPartyConfig>, adminId: number) {
    const rest: Partial<ThirdPartyConfig> = { ...data };
    delete rest.id;
    const existing = await this.thirdPartyConfigRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (existing) {
      await this.thirdPartyConfigRepo.update(existing.id, rest);
    } else {
      await this.thirdPartyConfigRepo.save(
        this.thirdPartyConfigRepo.create({ ...rest, id: 1 }),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'update_third_party_config',
      'third_party_config',
      '1',
    );
    return this.getThirdPartyConfig();
  }

  async getGameTypes() {
    const games = await this.gameRepo
      .createQueryBuilder('g')
      .select('DISTINCT g.gameType', 'gameType')
      .addSelect('MIN(g.gameName)', 'label')
      .addSelect('MIN(g.iconUrl)', 'iconUrl')
      .addSelect('MAX(g.is_lottery)', 'isLottery')
      .addSelect('MAX(g.is_third_party)', 'isThirdParty')
      .addSelect('MIN(g.emoji)', 'emoji')
      .addSelect('MIN(g.theme_color)', 'themeColor')
      .addSelect('COUNT(*)', 'gameCount')
      .groupBy('g.gameType')
      .orderBy('g.gameType', 'ASC')
      .getRawMany<GameTypeAggRow>();

    return games.map((g) => ({
      value: g.gameType,
      label: this.gameTypeLabel(g.label, g.gameType),
      isLottery: Number(g.isLottery) === 1,
      isThirdParty: Number(g.isThirdParty) === 1,
      iconUrl: g.iconUrl,
      emoji: this.gameTypeEmoji(g.emoji),
      themeColor: g.themeColor,
      gameCount: Number(g.gameCount),
    }));
  }

  private gameTypeLabel(label: string | null, gameType: string): string {
    if (label) return label;
    return gameType.toUpperCase();
  }

  private gameTypeEmoji(emoji: string | null): string {
    if (emoji) return emoji;
    return DEFAULT_GAME_EMOJI;
  }

  async getConfigMeta() {
    const games = await this.gameRepo
      .createQueryBuilder('g')
      .select('DISTINCT g.gameType', 'gameType')
      .addSelect('MIN(g.gameName)', 'label')
      .addSelect('MIN(g.iconUrl)', 'iconUrl')
      .addSelect('MAX(g.is_lottery)', 'isLottery')
      .addSelect('MIN(g.emoji)', 'emoji')
      .addSelect('MIN(g.theme_color)', 'themeColor')
      .groupBy('g.gameType')
      .orderBy('g.gameType', 'ASC')
      .getRawMany<GameTypeAggRow>();

    const gameTypes = games.map((g) => ({
      value: g.gameType,
      label: this.gameTypeLabel(g.label, g.gameType),
      isLottery: Number(g.isLottery) === 1,
      iconUrl: g.iconUrl,
      emoji: this.gameTypeEmoji(g.emoji),
      themeColor: g.themeColor,
    }));

    const lotteryGames = await this.gameRepo.find({
      where: { isLottery: 1 },
      select: ['id', 'gameName', 'gameCode', 'groupName', 'themeColor'],
    });
    const lotteryColors: Record<string, string> = {};
    for (const lg of lotteryGames) {
      const key = lg.groupName ? lg.groupName : lg.gameName;
      if (key && lg.themeColor) lotteryColors[key] = lg.themeColor;
    }

    const lotteryColorConfig = await this.configRepo.findOne({
      where: { configKey: 'lottery_colors' },
    });
    if (lotteryColorConfig?.configVal) {
      try {
        const dbColors = JSON.parse(lotteryColorConfig.configVal) as Record<
          string,
          string
        >;
        for (const [k, v] of Object.entries(dbColors)) {
          if (!lotteryColors[k]) lotteryColors[k] = v;
        }
      } catch (err) {
        this.logger.debug(
          `Invalid lottery_colors JSON, using defaults: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const statusMapsConfig = await this.configRepo.findOne({
      where: { configKey: 'status_maps' },
    });
    let statusMaps: StatusMaps | undefined;
    if (statusMapsConfig?.configVal) {
      try {
        statusMaps = JSON.parse(statusMapsConfig.configVal) as StatusMaps;
      } catch (err) {
        this.logger.debug(
          `Invalid status_maps JSON, using defaults: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    if (!statusMaps) {
      statusMaps = {
        round: {
          0: { text: 'Betting Open', color: 'green' },
          1: { text: 'Betting Closed', color: 'orange' },
          2: { text: 'Settled', color: 'blue' },
          3: { text: 'Cancelled', color: 'default' },
        },
        order: {
          0: { text: 'Pending', color: 'orange' },
          1: { text: 'Won', color: 'green' },
          2: { text: 'Lost', color: 'default' },
          3: { text: 'Cancelled', color: 'red' },
          4: { text: 'Settled', color: 'blue' },
          5: { text: 'Refunded', color: 'purple' },
        },
        recharge: {
          0: { text: 'Pending', color: 'orange' },
          1: { text: 'Approved', color: 'green' },
          2: { text: 'Rejected', color: 'red' },
          3: { text: 'Cancelled', color: 'default' },
        },
        withdraw: {
          0: { text: 'Pending', color: 'orange' },
          1: { text: 'Approved', color: 'green' },
          2: { text: 'Rejected', color: 'red' },
        },
        message: {
          0: { text: 'Unread', color: 'orange' },
          1: { text: 'Read', color: 'green' },
        },
      };
    }

    const intervalConfig = await this.configRepo.findOne({
      where: { configKey: 'interval_presets' },
    });
    let intervalPresets: { value: number; label: string }[] = [
      { value: 30, label: '30 Seconds' },
      { value: 60, label: '1 Minute' },
      { value: 90, label: '1.5 Minutes' },
      { value: 120, label: '2 Minutes' },
      { value: 180, label: '3 Minutes' },
      { value: 300, label: '5 Minutes' },
      { value: 600, label: '10 Minutes' },
      { value: 3600, label: '1 Hour' },
      { value: 86400, label: 'Daily' },
      { value: 604800, label: 'Weekly' },
    ];
    if (intervalConfig?.configVal) {
      try {
        intervalPresets = JSON.parse(intervalConfig.configVal) as {
          value: number;
          label: string;
        }[];
      } catch (err) {
        this.logger.debug(
          `Invalid interval_presets JSON, using defaults: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const prizeTierConfig = await this.configRepo.findOne({
      where: { configKey: 'prize_tier_options' },
    });
    let prizeTierOptions: string[] = [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'consolation',
    ];
    if (prizeTierConfig?.configVal) {
      try {
        prizeTierOptions = JSON.parse(prizeTierConfig.configVal) as string[];
      } catch (err) {
        this.logger.debug(
          `Invalid prize_tier_options JSON, using defaults: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const uiPositions = await this.uiPositionRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const positionColors = uiPositions.map((p) => p.color);
    const positionGradients = uiPositions.map((p) => ({
      from: p.gradientFrom,
      to: p.gradientTo,
    }));

    const appConfig = await this.appConfigRepo.findOne({ where: { id: 1 } });
    const appName = appConfig && appConfig.appName ? appConfig.appName : '';

    return {
      appName,
      gameTypes,
      lotteryColors,
      statusMaps,
      intervalPresets,
      prizeTierOptions,
      positionColors,
      positionGradients,
    };
  }
}
