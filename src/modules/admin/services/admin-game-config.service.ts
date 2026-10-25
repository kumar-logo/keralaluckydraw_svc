import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { CashrainWindow } from '../../../entities/cashrain-window.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameInfoCacheStore } from '../../../common/game-info-cache.store';
import { Order } from '../../../entities/order.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { GameFeeConfig } from '../../../entities/game-fee-config.entity';
import {
  GameType,
  TinyFlag,
  RoundStatus,
  LotteryDrawMode,
  OrderStatus,
} from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';
import { AdminPresentationService } from './admin-presentation.service';
import {
  GameConfigService,
  SlatProductView,
} from '../../game/shared/game-config.service';
import {
  decodeSlatReading,
  SlatReading,
} from '../../game/shared/slat-reading.util';
import {
  MECHANIC_BY_FAMILY,
  resolveFamily,
  MechanicBetContent,
} from '../../game/shared/mechanics';
import { GameMechanicsConfig } from '../../game/shared/game-config.types';
import { AdminGameService } from './admin-game.service';
import { OddsUpdateInput, UpdateGameResultConfigDto } from '../dto/admin.dto';

interface SlatConfigPayload {
  slatProducts?: SlatProductView[];
}

interface SlatReadingOrderContent {
  slatProductId?: number;
  betType?: string;
  position?: string;
  numbers?: string;
  betCode?: string;
  betNum?: string;
}

export interface SlatProductPnl {
  productId: number;
  title: string;
  salesQty: number;
  salesAmount: number;
  winnersQty: number;
  payout: number;
  profitLoss: number;
}

export interface SlatTierPnl {
  productId: number;
  tierLabel: string;
  winningDigits: string;
  winAmount: number;
  winnersQty: number;
  payout: number;
}

export interface SlatUserPnl {
  userId: string;
  stake: number;
  payout: number;
  net: number;
}

export interface SlatReadingTotals {
  totalSales: number;
  totalPayout: number;
  totalProfitLoss: number;
}

export interface SlatTicketPnl {
  orderNo: string;
  userId: string;
  productId: number;
  productTitle: string;
  betNumber: string;
  position: string;
  stake: number;
  payout: number;
  net: number;
  won: boolean;
}

export interface SlatResultReading {
  gameId: number;
  roundId: number;
  roundNo: string;
  drawn: string;
  isPreview: boolean;
  reading: SlatReading;
  perProduct: SlatProductPnl[];
  perTier: SlatTierPnl[];
  perUser: SlatUserPnl[];
  tickets: SlatTicketPnl[];
  totals: SlatReadingTotals;
}

@Injectable()
export class AdminGameConfigService {
  constructor(
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    @InjectRepository(GameFeeConfig) private feeRepo: Repository<GameFeeConfig>,
    @InjectRepository(CashrainWindow)
    private cashrainWindowRepo: Repository<CashrainWindow>,
    private audit: AdminAuditService,
    private gameConfig: GameConfigService,
    private presentation: AdminPresentationService,
    private dataSource: DataSource,
    private gameInfoCache: GameInfoCacheStore,
    private gameService: AdminGameService,
  ) {}

  private productKey(id: number | undefined): number {
    return id !== undefined ? id : 0;
  }

  private readDrawnNumber(result: unknown): string {
    if (result === null || typeof result !== 'object') return '';
    const record = result as Record<string, unknown>;
    if (record.drawResult !== undefined && record.drawResult !== null) {
      return String(record.drawResult);
    }
    if (record.number !== undefined && record.number !== null) {
      return String(record.number);
    }
    return '';
  }

  private readSlatContent(betContent: unknown): SlatReadingOrderContent {
    if (betContent === null || typeof betContent !== 'object') return {};
    return betContent as SlatReadingOrderContent;
  }

  private readSlatBetNumber(content: SlatReadingOrderContent): string {
    if (content.numbers !== undefined && content.numbers !== null) {
      return String(content.numbers);
    }
    if (content.betCode !== undefined && content.betCode !== null) {
      return String(content.betCode);
    }
    if (content.betNum !== undefined && content.betNum !== null) {
      return String(content.betNum);
    }
    return '';
  }

  async getSlatResultReading(
    gameId: number,
    roundId: number,
    drawnOverride?: string,
  ): Promise<SlatResultReading> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId, gameId },
    });
    if (!round) throw new NotFoundException('Round not found');

    const isPreview = drawnOverride != null && drawnOverride !== '';
    const drawn = isPreview
      ? String(drawnOverride)
      : this.readDrawnNumber(round.result);
    const products = await this.gameConfig.getSlatProducts(gameId);
    const reading = decodeSlatReading(drawn, products);

    const orders = await this.orderRepo.find({
      where: { gameId, roundNo: round.roundNo },
    });

    const titleById = new Map<number, string>(
      products.map((p) => [this.productKey(p.id), p.title]),
    );
    const family = resolveFamily(round.gameType);
    const mechanic = isPreview ? MECHANIC_BY_FAMILY.get(family) : undefined;
    const previewDigits = drawn.split('').map((d) => parseInt(d, 10));
    const previewResult = {
      number: drawn,
      drawResult: drawn,
      digits: previewDigits,
      sum: previewDigits.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    };
    const previewCfg: GameMechanicsConfig = { family, slatProducts: products };
    const tickets: SlatTicketPnl[] = [];

    const productPnl = new Map<number, SlatProductPnl>();
    for (const product of products) {
      const productId = this.productKey(product.id);
      productPnl.set(productId, {
        productId,
        title: product.title,
        salesQty: 0,
        salesAmount: 0,
        winnersQty: 0,
        payout: 0,
        profitLoss: 0,
      });
    }

    const userPnl = new Map<string, SlatUserPnl>();
    const tierWinners = new Map<
      string,
      { winnersQty: number; payout: number }
    >();
    const tierKey = (productId: number, tierLabel: string): string =>
      `${productId}::${tierLabel}`;

    let totalSales = 0;
    let totalPayout = 0;

    for (const order of orders) {
      const content = this.readSlatContent(order.betContent);
      const stake = Number(order.totalAmount);
      let payout = Number(order.winAmount);
      let isWin = order.status === OrderStatus.Won;
      let position = content.position ? String(content.position) : '';

      if (isPreview && mechanic) {
        const outcome = mechanic.evaluate({
          betType: order.betType ? order.betType : '',
          betContent:
            order.betContent !== null && order.betContent !== undefined
              ? (order.betContent as MechanicBetContent)
              : {},
          result: previewResult,
          cfg: previewCfg,
        });
        isWin = !!outcome.won;
        const fixedWin = outcome.fixedWin ? outcome.fixedWin : 0;
        const quantity = order.quantity ? order.quantity : 1;
        payout = isWin ? Number(fixedWin) * quantity : 0;
        position =
          outcome.prizeLevel != null ? String(outcome.prizeLevel) : position;
      }

      totalSales += stake;
      totalPayout += payout;

      const productId = Number(
        content.slatProductId !== undefined ? content.slatProductId : 0,
      );
      const product = productPnl.get(productId);
      if (product) {
        product.salesQty += 1;
        product.salesAmount += stake;
        if (isWin) {
          product.winnersQty += 1;
          product.payout += payout;
        }
      }

      const existingUser = userPnl.get(order.userId);
      const user: SlatUserPnl =
        existingUser !== undefined
          ? existingUser
          : { userId: order.userId, stake: 0, payout: 0, net: 0 };
      user.stake += stake;
      user.payout += payout;
      userPnl.set(order.userId, user);

      if (isWin && position) {
        const key = tierKey(productId, position);
        const existingTier = tierWinners.get(key);
        const tier =
          existingTier !== undefined
            ? existingTier
            : { winnersQty: 0, payout: 0 };
        tier.winnersQty += 1;
        tier.payout += payout;
        tierWinners.set(key, tier);
      }

      const ticketTitle = titleById.get(productId);
      tickets.push({
        orderNo: order.orderNo,
        userId: order.userId,
        productId,
        productTitle: ticketTitle !== undefined ? ticketTitle : '',
        betNumber: this.readSlatBetNumber(content),
        position,
        stake,
        payout,
        net: payout - stake,
        won: isWin,
      });
    }

    const perProduct: SlatProductPnl[] = [];
    for (const product of productPnl.values()) {
      product.profitLoss = product.salesAmount - product.payout;
      perProduct.push(product);
    }

    const perTier: SlatTierPnl[] = reading.groups.map((group) => {
      const matchedTier = tierWinners.get(
        tierKey(group.productId, group.tierLabel),
      );
      const tier =
        matchedTier !== undefined ? matchedTier : { winnersQty: 0, payout: 0 };
      return {
        productId: group.productId,
        tierLabel: group.tierLabel,
        winningDigits: group.winningDigits,
        winAmount: group.winAmount,
        winnersQty: tier.winnersQty,
        payout: tier.payout,
      };
    });

    const perUser: SlatUserPnl[] = [];
    for (const user of userPnl.values()) {
      user.net = user.payout - user.stake;
      perUser.push(user);
    }
    perUser.sort((a, b) => b.stake - a.stake);

    return {
      gameId,
      roundId,
      roundNo: round.roundNo,
      drawn,
      isPreview,
      reading,
      perProduct,
      perTier,
      perUser,
      tickets,
      totals: {
        totalSales,
        totalPayout,
        totalProfitLoss: totalSales - totalPayout,
      },
    };
  }

  async getOddsConfig(gameId: number) {
    const list = await this.oddsRepo.find({
      where: { gameId },
      order: { betType: 'ASC' },
    });
    return { gameId, odds: list };
  }

  async updateOddsConfig(
    gameId: number,
    odds: OddsUpdateInput[],
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');

    for (const item of odds) {
      if (item.odds === undefined) {
        throw new BadRequestException('Odds value is required');
      }
      const existing = await this.oddsRepo.findOne({
        where: { gameId, betType: item.betType },
      });

      if (existing) {
        await this.oddsRepo.update(existing.id, { odds: item.odds });
      } else {
        if (item.betType === undefined) {
          throw new BadRequestException('Bet type is required for a new entry');
        }
        await this.oddsRepo.save(
          this.oddsRepo.create({
            gameId,
            gameType:
              item.gameType !== undefined ? item.gameType : game.gameType,
            betType: item.betType,
            odds: item.odds,
          }),
        );
      }
    }

    await this.audit.createAuditLog(
      adminId,
      'update_odds',
      'game_odds',
      String(gameId),
      { count: odds.length },
    );
    return this.getOddsConfig(gameId);
  }

  async deleteOddsEntry(gameId: number, id: number, adminId: number) {
    const entry = await this.oddsRepo.findOne({ where: { id, gameId } });
    if (!entry) throw new NotFoundException('Odds entry not found');
    await this.oddsRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_odds_entry',
      'game_odds',
      String(id),
    );
    return { success: true };
  }

  async getGameSchedule(gameId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const openRounds = await this.roundRepo.find({
      where: {
        gameId,
        status: In([RoundStatus.BettingOpen, RoundStatus.BettingClosed]),
      },
      order: { drawTime: 'ASC' },
    });
    const scheduledDrawTimes = openRounds
      .map((r) => r.drawTime)
      .filter((d): d is Date => !!d);
    return {
      gameId: game.id,
      gameName: game.gameName,
      gameType: game.gameType,
      drawInterval: game.drawInterval,
      status: game.status,
      config: {
        roundDuration: game.drawInterval,
        stopBetBefore: game.stopBetBeforeSec,
        drawDelay: game.drawDelaySec,
        autoGenerate: game.autoGenerate === 1,
        maxPrize: game.maxPrize,
        scheduledDrawTime: game.scheduledDrawTime,
        scheduledDrawTimes,
        startDate: game.startDate,
      },
    };
  }

  async updateGameSchedule(gameId: number, config: any, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const updates: Partial<GameList> = {};
    if (config.drawInterval !== undefined)
      updates.drawInterval = config.drawInterval;
    if (config.roundDuration !== undefined)
      updates.drawInterval = config.roundDuration;
    if (config.stopBetBefore !== undefined)
      updates.stopBetBeforeSec = config.stopBetBefore;
    if (config.drawDelay !== undefined) updates.drawDelaySec = config.drawDelay;
    if (config.autoGenerate !== undefined)
      updates.autoGenerate = config.autoGenerate ? TinyFlag.Yes : TinyFlag.No;
    if (config.maxPrize !== undefined) updates.maxPrize = config.maxPrize;

    const effectiveAutoGenerate =
      config.autoGenerate !== undefined
        ? config.autoGenerate
          ? TinyFlag.Yes
          : TinyFlag.No
        : game.autoGenerate;
    if (config.autoGenerate !== undefined) {
      updates.lotteryType =
        effectiveAutoGenerate === TinyFlag.No
          ? LotteryDrawMode.Manual
          : LotteryDrawMode.Auto;
    }

    if (effectiveAutoGenerate === TinyFlag.Yes) {
      updates.startDate = null;
    } else if (config.startDate !== undefined) {
      updates.startDate = this.gameService.parseStartDate(config.startDate);
    }

    const drawTimesProvided =
      config.scheduledDrawTimes !== undefined ||
      config.scheduledDrawTime !== undefined;
    const drawTimes = drawTimesProvided
      ? this.gameService.parseManualDrawTimes(config)
      : [];
    if (drawTimesProvided) {
      updates.scheduledDrawTime = drawTimes.length > 0 ? drawTimes[0] : null;
    }

    if (Object.keys(updates).length > 0) {
      await this.gameRepo.update(gameId, updates);
    }

    const isManual =
      game.isLottery === TinyFlag.Yes && effectiveAutoGenerate === TinyFlag.No;
    if (isManual && drawTimes.length > 0) {
      const stopBetBeforeSec =
        updates.stopBetBeforeSec !== undefined
          ? updates.stopBetBeforeSec
          : game.stopBetBeforeSec;
      await this.gameService.materializeManualRounds(
        game,
        drawTimes,
        stopBetBeforeSec,
      );
    }

    await this.audit.createAuditLog(
      adminId,
      'update_schedule',
      'game',
      String(gameId),
      config,
    );
    return this.getGameSchedule(gameId);
  }

  async getCashrainWindows(gameId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const windows = await this.cashrainWindowRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return {
      gameId: game.id,
      gameName: game.gameName,
      windows: windows.map((w) => ({
        id: w.id,
        dayStart: w.dayStart,
        dayEnd: w.dayEnd,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
        maxClaimsPerUser: w.maxClaimsPerUser,
        status: w.status,
      })),
    };
  }

  async saveCashrainWindows(
    gameId: number,
    windows: {
      dayStart?: number;
      dayEnd?: number;
      startMinute: number;
      endMinute: number;
      maxClaimsPerUser?: number;
      status?: number;
    }[],
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const clean = (Array.isArray(windows) ? windows : [])
      .map((w) => ({
        dayStart: Math.trunc(Number(w.dayStart !== undefined ? w.dayStart : 1)),
        dayEnd: Math.trunc(Number(w.dayEnd !== undefined ? w.dayEnd : 31)),
        startMinute: Math.trunc(Number(w.startMinute)),
        endMinute: Math.trunc(Number(w.endMinute)),
        maxClaimsPerUser: Math.max(
          0,
          Math.trunc(
            Number(w.maxClaimsPerUser !== undefined ? w.maxClaimsPerUser : 1),
          ),
        ),
        status: w.status === 0 ? 0 : 1,
      }))
      .filter(
        (w) =>
          Number.isFinite(w.startMinute) &&
          Number.isFinite(w.endMinute) &&
          Number.isFinite(w.dayStart) &&
          Number.isFinite(w.dayEnd) &&
          Number.isFinite(w.maxClaimsPerUser) &&
          w.startMinute >= 0 &&
          w.startMinute <= 1439 &&
          w.endMinute >= 0 &&
          w.endMinute <= 1439 &&
          w.dayStart >= 1 &&
          w.dayStart <= 31 &&
          w.dayEnd >= 1 &&
          w.dayEnd <= 31,
      );
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CashrainWindow);
      await repo.delete({ gameId });
      if (clean.length > 0) {
        await repo.save(
          clean.map((w, index) =>
            repo.create({
              gameId,
              dayStart: w.dayStart,
              dayEnd: w.dayEnd,
              startMinute: w.startMinute,
              endMinute: w.endMinute,
              maxClaimsPerUser: w.maxClaimsPerUser,
              sortOrder: index,
              status: w.status,
            }),
          ),
        );
      }
    });
    await this.audit.createAuditLog(
      adminId,
      'update_cashrain_windows',
      'game',
      String(gameId),
      { count: clean.length },
    );
    return this.getCashrainWindows(gameId);
  }

  async getGameFeeConfig(gameId: number) {
    return this.feeRepo.find({ where: { gameId, status: 1 } });
  }

  async upsertGameFeeConfig(
    gameId: number,
    dto: {
      feeType: string;
      feeRate: number;
      fixedFee?: number;
      gameType?: string;
    },
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');

    const existing = await this.feeRepo.findOne({
      where: { gameId, feeType: dto.feeType },
    });
    const fixedFee = dto.fixedFee !== undefined ? dto.fixedFee : 0;
    if (existing) {
      await this.feeRepo.update(existing.id, {
        feeRate: dto.feeRate,
        fixedFee,
      });
    } else {
      await this.feeRepo.save(
        this.feeRepo.create({
          gameId,
          gameType: dto.gameType !== undefined ? dto.gameType : game.gameType,
          feeType: dto.feeType,
          feeRate: dto.feeRate,
          fixedFee,
        }),
      );
    }
    await this.audit.createAuditLog(
      adminId,
      'upsert_fee_config',
      'fee_config',
      String(gameId),
      { feeType: dto.feeType },
    );
    return this.getGameFeeConfig(gameId);
  }

  async deleteGameFeeConfig(gameId: number, id: number, adminId: number) {
    const entry = await this.feeRepo.findOne({ where: { id, gameId } });
    if (!entry) throw new NotFoundException('Fee config not found');
    await this.feeRepo.delete(id);
    await this.audit.createAuditLog(
      adminId,
      'delete_fee_config',
      'fee_config',
      String(id),
    );
    return { success: true };
  }

  async updateGameUiConfig(gameId: number, uiConfig: any, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const updates: Partial<GameList> = {};
    if (uiConfig?.themeColor !== undefined)
      updates.themeColor = uiConfig.themeColor;
    if (uiConfig?.bgColor !== undefined) updates.bgColor = uiConfig.bgColor;
    if (uiConfig?.textColor !== undefined)
      updates.textColor = uiConfig.textColor;
    if (uiConfig?.borderColor !== undefined)
      updates.borderColor = uiConfig.borderColor;
    if (Object.keys(updates).length > 0)
      await this.gameRepo.update(gameId, updates);
    await this.audit.createAuditLog(
      adminId,
      'update_ui_config',
      'game',
      String(gameId),
      updates,
    );
    return { success: true, ...updates };
  }

  async updateGameRules(gameId: number, rules: any, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const sections: { title: string; content: string }[] = Array.isArray(
      rules?.sections,
    )
      ? rules.sections
      : Array.isArray(rules)
        ? rules
        : [];
    await this.gameConfig.replaceRuleSections(gameId, sections);
    await this.audit.createAuditLog(
      adminId,
      'update_rules',
      'game',
      String(gameId),
      { count: sections.length },
    );
    return {
      success: true,
      sections: await this.gameConfig.getRuleSections(gameId),
    };
  }

  async updateGameResultConfig(
    gameId: number,
    rc: UpdateGameResultConfigDto,
    adminId: number,
  ) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const updates: Partial<GameList> = {};
    if (rc.resultMode !== undefined) updates.resultMode = rc.resultMode;
    if (rc.houseEdgeTarget !== undefined)
      updates.resultHouseEdgeTarget = rc.houseEdgeTarget;
    if (rc.holdForApproval !== undefined)
      updates.resultHoldForApproval = rc.holdForApproval ? 1 : 0;
    if (rc.avoidBigPrize !== undefined)
      updates.resultAvoidBigPrize = rc.avoidBigPrize ? 1 : 0;
    if (rc.avoidZeroOrder !== undefined)
      updates.resultAvoidZeroOrder = rc.avoidZeroOrder ? 1 : 0;
    if (Object.keys(updates).length > 0)
      await this.gameRepo.update(gameId, updates);
    await this.audit.createAuditLog(
      adminId,
      'update_result_config',
      'game',
      String(gameId),
      updates,
    );
    return { success: true, ...updates };
  }

  async getGameConfig(gameId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    return {
      gameId,
      gameType: game.gameType,
      scalar: {
        digitCount: game.digitCount,
        maxPrize: game.maxPrize,
        payRate: game.payRate,
        quickCycleSec: game.quickCycleSec,
        isQuick: game.isQuick,
        fivedBigSmallThreshold: game.fivedBigSmallThreshold,
        numberMin: game.numberMin,
        numberMax: game.numberMax,
      },
      kerala: await this.gameConfig.getKeralaConfig(gameId),
      punjab: await this.gameConfig.getPunjabConfig(gameId),
      race: await this.gameConfig.getRaceConfig(gameId),
      pick4: await this.gameConfig.getPick4Config(gameId),
      prizeTiers: await this.gameConfig.getPrizeTiers(gameId),
      prefixes: await this.gameConfig.getPrefix2ndList(gameId),
      rules: await this.gameConfig.getRuleSections(gameId),
      box: await this.gameConfig.getBoxConfig(gameId),
      boxItems: await this.gameConfig.getBoxItemRows(gameId),
      wheel: await this.gameConfig.getWheelConfig(gameId),
      segments: await this.gameConfig.getWheelSegments(gameId),
      colorPalette: await this.gameConfig.getColorPaletteRows(gameId),
      numberColors: await this.gameConfig.getNumberColorRows(gameId),
      positionColors: await this.gameConfig.getPositionColorRows(gameId),
      raceRunners: await this.gameConfig.getRaceRunners(gameId),
      assets: await this.gameConfig.getGameAssetRows(gameId),
      slatProducts: await this.gameConfig.getSlatProducts(gameId),
      gradients:
        game.gameType === GameType.MysteryBox
          ? await this.presentation.getMysteryBoxGradients()
          : [],
    };
  }

  async saveGameConfig(gameId: number, payload: any, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    const p = payload !== null && payload !== undefined ? payload : {};

    const scalar: Partial<GameList> = {};
    if (p.digitCount !== undefined) scalar.digitCount = p.digitCount;
    if (p.maxPrize !== undefined) scalar.maxPrize = p.maxPrize;
    if (p.payRate !== undefined) scalar.payRate = p.payRate;
    if (p.quickCycleSec !== undefined) scalar.quickCycleSec = p.quickCycleSec;
    if (p.isQuick !== undefined) scalar.isQuick = p.isQuick ? 1 : 0;
    if (p.fivedBigSmallThreshold !== undefined)
      scalar.fivedBigSmallThreshold = p.fivedBigSmallThreshold;
    if (p.numberMin !== undefined) scalar.numberMin = Number(p.numberMin);
    if (p.numberMax !== undefined) scalar.numberMax = Number(p.numberMax);
    if (Object.keys(scalar).length > 0)
      await this.gameRepo.update(gameId, scalar);

    if (p.kerala) await this.gameConfig.saveKeralaConfig(gameId, p.kerala);
    if (p.punjab) await this.gameConfig.savePunjabConfig(gameId, p.punjab);
    if (p.race) await this.gameConfig.saveRaceConfig(gameId, p.race);
    if (p.pick4) await this.gameConfig.savePick4Config(gameId, p.pick4);
    if (Array.isArray(p.prizeTiers))
      await this.gameConfig.replacePrizeTiers(gameId, p.prizeTiers);
    if (Array.isArray(p.prefixes))
      await this.gameConfig.replaceNumberPrefixes(gameId, p.prefixes);
    if (p.box) await this.gameConfig.saveBoxConfig(gameId, p.box);
    if (Array.isArray(p.boxItems))
      await this.gameConfig.replaceBoxItems(gameId, p.boxItems);
    if (p.wheel) await this.gameConfig.saveWheelConfig(gameId, p.wheel);
    if (Array.isArray(p.segments))
      await this.gameConfig.replaceWheelSegments(gameId, p.segments);
    if (Array.isArray(p.colorPalette))
      await this.gameConfig.replaceColorPalette(gameId, p.colorPalette);
    if (Array.isArray(p.numberColors))
      await this.gameConfig.replaceNumberColors(gameId, p.numberColors);
    if (Array.isArray(p.positionColors))
      await this.gameConfig.replacePositionColors(gameId, p.positionColors);
    if (Array.isArray(p.raceRunners))
      await this.gameConfig.replaceRaceRunners(gameId, p.raceRunners);
    if (Array.isArray(p.assets))
      await this.gameConfig.replaceGameAssets(gameId, p.assets);
    if (Array.isArray(p.rules))
      await this.gameConfig.replaceRuleSections(gameId, p.rules);
    const slatPayload = p as SlatConfigPayload;
    if (Array.isArray(slatPayload.slatProducts))
      await this.gameConfig.replaceSlatProducts(
        gameId,
        slatPayload.slatProducts,
      );
    if (Array.isArray(p.gradients))
      await this.presentation.replaceMysteryBoxGradients(p.gradients, adminId);

    await this.audit.createAuditLog(
      adminId,
      'save_game_config',
      'game',
      String(gameId),
      { keys: Object.keys(p) },
    );
    this.gameInfoCache.invalidateAll();
    return this.getGameConfig(gameId);
  }
}
