import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ObjectLiteral } from 'typeorm';
import { GameProvider } from '../../../entities/game-provider.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import { PaymentGatewayMethod } from '../../../entities/payment-gateway-method.entity';
import { NotificationTemplate } from '../../../entities/notification-template.entity';
import { LobbySection } from '../../../entities/lobby-section.entity';
import { LobbyProvider } from '../../../entities/lobby-provider.entity';
import { LobbyConfig } from '../../../entities/lobby-config.entity';
import { UiConfig } from '../../../entities/ui-config.entity';
import { UiColorMap } from '../../../entities/ui-color-map.entity';
import { UiStatusMap } from '../../../entities/ui-status-map.entity';
import { UiState } from '../../../entities/ui-state.entity';
import { UiPosition } from '../../../entities/ui-position.entity';
import { UiPayRate } from '../../../entities/ui-pay-rate.entity';
import { UiMysteryBoxGradient } from '../../../entities/ui-mystery-box-gradient.entity';
import { UiResultTab } from '../../../entities/ui-result-tab.entity';
import { ShareChannel } from '../../../entities/share-channel.entity';
import { OddsAlias } from '../../../entities/odds-alias.entity';
import { AdminAuditService } from './admin-audit.service';

const DEFAULT_NOTIFICATION_CHANNEL = 'in_app';

@Injectable()
export class AdminPresentationService {
  constructor(
    @InjectRepository(GameProvider)
    private providerRepo: Repository<GameProvider>,
    @InjectRepository(PaymentGateway)
    private payGatewayRepo: Repository<PaymentGateway>,
    @InjectRepository(PaymentGatewayMethod)
    private gatewayMethodRepo: Repository<PaymentGatewayMethod>,
    @InjectRepository(NotificationTemplate)
    private notificationTemplateRepo: Repository<NotificationTemplate>,
    @InjectRepository(LobbySection)
    private lobbySectionRepo: Repository<LobbySection>,
    @InjectRepository(LobbyProvider)
    private lobbyProviderRepo: Repository<LobbyProvider>,
    @InjectRepository(LobbyConfig)
    private lobbyConfigRepo: Repository<LobbyConfig>,
    @InjectRepository(UiConfig) private uiConfigRepo: Repository<UiConfig>,
    @InjectRepository(UiColorMap)
    private uiColorMapRepo: Repository<UiColorMap>,
    @InjectRepository(UiStatusMap)
    private uiStatusMapRepo: Repository<UiStatusMap>,
    @InjectRepository(UiState) private uiStateRepo: Repository<UiState>,
    @InjectRepository(UiPosition)
    private uiPositionRepo: Repository<UiPosition>,
    @InjectRepository(UiPayRate) private uiPayRateRepo: Repository<UiPayRate>,
    @InjectRepository(UiMysteryBoxGradient)
    private uiMboxRepo: Repository<UiMysteryBoxGradient>,
    @InjectRepository(UiResultTab)
    private uiResultTabRepo: Repository<UiResultTab>,
    @InjectRepository(ShareChannel)
    private shareChannelRepo: Repository<ShareChannel>,
    @InjectRepository(OddsAlias) private oddsAliasRepo: Repository<OddsAlias>,
    private audit: AdminAuditService,
  ) {}

  private sortOrderOr(value: unknown, index: number): number {
    return typeof value === 'number' ? value : index;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async getGameProviders() {
    return this.providerRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async upsertGameProvider(data: Partial<GameProvider>, adminId: number) {
    if (data.id) {
      await this.providerRepo.update(data.id, data);
      await this.audit.createAuditLog(
        adminId,
        'update_game_provider',
        'game_provider',
        String(data.id),
      );
      return this.providerRepo.findOne({ where: { id: data.id } });
    }
    const saved = await this.providerRepo.save(
      this.providerRepo.create(data),
    );
    await this.audit.createAuditLog(
      adminId,
      'create_game_provider',
      'game_provider',
      String(saved.id),
    );
    return saved;
  }

  async deleteGameProvider(id: number, adminId: number) {
    await this.providerRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_game_provider',
      'game_provider',
      String(id),
    );
  }

  async getPaymentGateways() {
    const gateways = await this.payGatewayRepo.find({
      order: { sortOrder: 'ASC' },
    });
    if (gateways.length === 0) return gateways;
    const methodRows = await this.gatewayMethodRepo.find({
      where: { gatewayId: In(gateways.map((g) => g.id)) },
      order: { sortOrder: 'ASC' },
    });
    const byGateway = new Map<number, string[]>();
    for (const method of methodRows) {
      const existing = byGateway.get(method.gatewayId);
      const list = existing !== undefined ? existing : [];
      list.push(method.methodCode);
      byGateway.set(method.gatewayId, list);
    }
    for (const gateway of gateways) {
      const methods = byGateway.get(gateway.id);
      (
        gateway as PaymentGateway & { supportedMethods: string[] }
      ).supportedMethods = methods !== undefined ? methods : [];
    }
    return gateways.map((g) => ({
      ...g,
      apiSecret: '',
      webhookSecret: '',
      hasApiSecret: !!g.apiSecret,
      hasWebhookSecret: !!g.webhookSecret,
    }));
  }

  async upsertPaymentGateway(data: Record<string, any>, adminId: number) {
    const methods: string[] = Array.isArray(data.supportedMethods)
      ? data.supportedMethods
      : [];
    const rest = { ...data };
    delete rest.supportedMethods;
    delete rest.hasApiSecret;
    delete rest.hasWebhookSecret;
    let gatewayId = data.id;
    if (gatewayId) {
      if (!rest.apiKey) delete rest.apiKey;
      if (!rest.apiSecret) delete rest.apiSecret;
      if (!rest.webhookSecret) delete rest.webhookSecret;
      await this.payGatewayRepo.update(gatewayId, rest);
    } else {
      const saved = await this.payGatewayRepo.save(
        this.payGatewayRepo.create(rest as Partial<PaymentGateway>),
      );
      gatewayId = (saved as PaymentGateway).id;
    }
    await this.gatewayMethodRepo.delete({ gatewayId });
    if (methods.length > 0) {
      await this.gatewayMethodRepo.save(
        methods.map((code, i) =>
          this.gatewayMethodRepo.create({
            gatewayId,
            methodCode: code,
            sortOrder: i,
          }),
        ),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      data.id ? 'update_payment_gateway' : 'create_payment_gateway',
      'payment_gateway',
      String(gatewayId),
    );
    return (await this.getPaymentGateways()).find((g) => g.id === gatewayId);
  }

  async deletePaymentGateway(id: number, adminId: number) {
    await this.payGatewayRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_payment_gateway',
      'payment_gateway',
      String(id),
    );
  }

  async getNotificationTemplates() {
    return this.notificationTemplateRepo.find({
      order: { code: 'ASC', channel: 'ASC' },
    });
  }

  async saveNotificationTemplate(data: Record<string, any>, adminId: number) {
    const id = data.id ? Number(data.id) : null;
    let existing: NotificationTemplate | null = null;
    if (id) {
      existing = await this.notificationTemplateRepo.findOne({ where: { id } });
    } else if (data.code && data.channel) {
      existing = await this.notificationTemplateRepo.findOne({
        where: { code: data.code, channel: data.channel },
      });
    }
    const patch = {
      title:
        data.title !== undefined && data.title !== null ? data.title : null,
      body: data.body !== undefined && data.body !== null ? data.body : null,
      status: data.status === undefined ? 1 : Number(data.status),
      updatedBy: String(adminId),
    };
    let saved: NotificationTemplate;
    if (existing) {
      await this.notificationTemplateRepo.update(existing.id, patch);
      saved = (await this.notificationTemplateRepo.findOne({
        where: { id: existing.id },
      })) as NotificationTemplate;
    } else {
      saved = await this.notificationTemplateRepo.save(
        this.notificationTemplateRepo.create({
          code: data.code,
          channel:
            data.channel !== undefined && data.channel !== null
              ? data.channel
              : DEFAULT_NOTIFICATION_CHANNEL,
          ...patch,
          createdBy: String(adminId),
        }),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'save_notification_template',
      'notification_templates',
      String(saved.id),
    );
    return saved;
  }

  async getLobbyConfig() {
    const config = await this.lobbyConfigRepo.findOne({ where: { id: 1 } });
    const sections = await this.lobbySectionRepo.find({
      order: { scope: 'ASC', sortOrder: 'ASC' },
    });
    const providers = await this.lobbyProviderRepo.find({
      order: { sortOrder: 'ASC' },
    });
    return { config, sections, providers };
  }

  async saveLobbyConfig(
    data: {
      config?: Record<string, any>;
      sections?: Array<Record<string, any>>;
      providers?: Array<Record<string, any>>;
    },
    adminId: number,
  ) {
    if (data.config) {
      const rest = { ...data.config };
      delete rest.id;
      delete rest.updatedAt;
      const existing = await this.lobbyConfigRepo.findOne({ where: { id: 1 } });
      if (existing) {
        await this.lobbyConfigRepo.update(existing.id, rest);
      } else {
        await this.lobbyConfigRepo.save(
          this.lobbyConfigRepo.create({ ...rest, id: 1 }),
        );
      }
    }
    if (Array.isArray(data.sections)) {
      await this.lobbySectionRepo.clear();
      if (data.sections.length > 0) {
        await this.lobbySectionRepo.save(
          data.sections.map((s, i) =>
            this.lobbySectionRepo.create({
              scope: s.scope,
              filterType: s.filterType,
              filterName: s.filterName,
              rows:
                s.rows === undefined || s.rows === null || s.rows === ''
                  ? null
                  : Number(s.rows),
              sortOrder: this.sortOrderOr(s.sortOrder, i),
            }),
          ),
        );
      }
    }
    if (Array.isArray(data.providers)) {
      await this.lobbyProviderRepo.clear();
      if (data.providers.length > 0) {
        await this.lobbyProviderRepo.save(
          data.providers.map((p, i) =>
            this.lobbyProviderRepo.create({
              categoryId:
                p.categoryId === undefined ||
                p.categoryId === null ||
                p.categoryId === ''
                  ? null
                  : Number(p.categoryId),
              filterType: p.filterType,
              filterName: p.filterName,
              bigIconX: this.toNumber(p.bigIconX),
              bigIconY: this.toNumber(p.bigIconY),
              iconX: this.toNumber(p.iconX),
              iconY: this.toNumber(p.iconY),
              sortOrder: this.sortOrderOr(p.sortOrder, i),
            }),
          ),
        );
      }
    }
    await this.audit.createAuditLog(
      adminId,
      'update_lobby_config',
      'lobby_config',
      '1',
    );
    return this.getLobbyConfig();
  }

  async getUiConfig() {
    const config = await this.uiConfigRepo.findOne({ where: { id: 1 } });
    const colorMap = await this.uiColorMapRepo.find({
      order: { digit: 'ASC', sortOrder: 'ASC' },
    });
    const statusMap = await this.uiStatusMapRepo.find({ order: { id: 'ASC' } });
    const states = await this.uiStateRepo.find({ order: { sortOrder: 'ASC' } });
    const positions = await this.uiPositionRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const payRates = await this.uiPayRateRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const gradients = await this.uiMboxRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const resultTabs = await this.uiResultTabRepo.find({
      order: { sortOrder: 'ASC' },
    });
    return {
      config,
      colorMap,
      statusMap,
      states,
      positions,
      payRates,
      gradients,
      resultTabs,
    };
  }

  async saveUiConfig(data: Record<string, any>, adminId: number) {
    if (data.config) {
      const rest = { ...data.config };
      delete rest.id;
      delete rest.updatedAt;
      const existing = await this.uiConfigRepo.findOne({ where: { id: 1 } });
      if (existing) {
        await this.uiConfigRepo.update(existing.id, rest);
      } else {
        await this.uiConfigRepo.save(
          this.uiConfigRepo.create({ ...rest, id: 1 }),
        );
      }
    }
    const replace = async <T extends ObjectLiteral>(
      repo: Repository<T>,
      rows: Array<Record<string, any>> | undefined,
      make: (r: Record<string, any>, i: number) => T,
    ): Promise<void> => {
      if (!Array.isArray(rows)) return;
      await repo.clear();
      if (rows.length > 0) await repo.save(rows.map(make) as any);
    };
    await replace(this.uiColorMapRepo, data.colorMap, (r, i) =>
      this.uiColorMapRepo.create({
        digit: this.toNumber(r.digit),
        color: r.color,
        sortOrder: this.sortOrderOr(r.sortOrder, i),
      }),
    );
    await replace(this.uiStatusMapRepo, data.statusMap, (r) =>
      this.uiStatusMapRepo.create({
        domain: r.domain,
        status: this.toNumber(r.status),
        text: r.text,
        color: r.color,
      }),
    );
    await replace(this.uiStateRepo, data.states, (r, i) =>
      this.uiStateRepo.create({
        sortOrder: this.sortOrderOr(r.sortOrder, i),
        name: r.name,
        color: r.color,
      }),
    );
    await replace(this.uiPositionRepo, data.positions, (r, i) =>
      this.uiPositionRepo.create({
        sortOrder: this.sortOrderOr(r.sortOrder, i),
        color: r.color,
        gradientFrom: r.gradientFrom,
        gradientTo: r.gradientTo,
      }),
    );
    await replace(this.uiPayRateRepo, data.payRates, (r, i) =>
      this.uiPayRateRepo.create({
        sortOrder: this.sortOrderOr(r.sortOrder, i),
        odds: this.toNumber(r.odds),
        type: this.toNumber(r.type),
      }),
    );
    await replace(this.uiMboxRepo, data.gradients, (r, i) =>
      this.uiMboxRepo.create({
        sortOrder: this.sortOrderOr(r.sortOrder, i),
        gradient: r.gradient,
      }),
    );
    await replace(this.uiResultTabRepo, data.resultTabs, (r, i) =>
      this.uiResultTabRepo.create({
        sortOrder: this.sortOrderOr(r.sortOrder, i),
        key: r.key,
        label: r.label,
      }),
    );
    await this.audit.createAuditLog(
      adminId,
      'update_ui_config',
      'ui_config',
      '1',
    );
    return this.getUiConfig();
  }

  getMysteryBoxGradients(): Promise<UiMysteryBoxGradient[]> {
    return this.uiMboxRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async replaceMysteryBoxGradients(
    rows: { gradient: string; sortOrder?: number }[],
    adminId: number,
  ): Promise<void> {
    await this.uiMboxRepo.clear();
    if (rows.length > 0) {
      await this.uiMboxRepo.save(
        rows.map((r, i) =>
          this.uiMboxRepo.create({
            gradient: r.gradient,
            sortOrder: this.sortOrderOr(r.sortOrder, i),
          }),
        ),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'update_mystery_box_gradients',
      'ui_mystery_box_gradient',
      String(rows.length),
    );
  }

  async getShareOddsConfig() {
    const shareChannels = await this.shareChannelRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const oddsAliases = await this.oddsAliasRepo.find({
      order: { sortOrder: 'ASC' },
    });
    return { shareChannels, oddsAliases };
  }

  async saveShareOddsConfig(data: Record<string, any>, adminId: number) {
    if (Array.isArray(data.shareChannels)) {
      await this.shareChannelRepo.clear();
      if (data.shareChannels.length > 0) {
        await this.shareChannelRepo.save(
          data.shareChannels.map((c: Record<string, any>, i: number) =>
            this.shareChannelRepo.create({
              name: c.name,
              icon: c.icon,
              url: c.url,
              sortOrder: this.sortOrderOr(c.sortOrder, i),
            }),
          ),
        );
      }
    }
    if (Array.isArray(data.oddsAliases)) {
      await this.oddsAliasRepo.clear();
      if (data.oddsAliases.length > 0) {
        await this.oddsAliasRepo.save(
          data.oddsAliases.map((o: Record<string, any>, i: number) =>
            this.oddsAliasRepo.create({
              betCode: o.betCode,
              oddsClass: o.oddsClass,
              sortOrder: this.sortOrderOr(o.sortOrder, i),
            }),
          ),
        );
      }
    }
    await this.audit.createAuditLog(
      adminId,
      'update_share_odds',
      'share_channel',
      '0',
    );
    return this.getShareOddsConfig();
  }
}
