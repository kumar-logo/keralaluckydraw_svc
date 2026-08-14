import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  EntityManager,
  EntityTarget,
  DeepPartial,
  FindOptionsWhere,
} from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { GameRaceConfig } from '../../../entities/game-race-config.entity';
import { GameKeralaConfig } from '../../../entities/game-kerala-config.entity';
import { GamePunjabConfig } from '../../../entities/game-punjab-config.entity';
import { GameBoxConfig } from '../../../entities/game-box-config.entity';
import { GameWheelConfig } from '../../../entities/game-wheel-config.entity';
import { GamePick4Config } from '../../../entities/game-pick4-config.entity';
import { GameLobbyPlacement } from '../../../entities/game-lobby-placement.entity';
import { GameNumberPrefix } from '../../../entities/game-number-prefix.entity';
import { GamePrizeTier } from '../../../entities/game-prize-tier.entity';
import { GameBoxItem } from '../../../entities/game-box-item.entity';
import { GameWheelSegment } from '../../../entities/game-wheel-segment.entity';
import { GameColorPalette } from '../../../entities/game-color-palette.entity';
import { GameNumberColor } from '../../../entities/game-number-color.entity';
import { GamePositionColor } from '../../../entities/game-position-color.entity';
import { GameRaceRunner } from '../../../entities/game-race-runner.entity';
import { GameAsset } from '../../../entities/game-asset.entity';
import { GameSlatProduct } from '../../../entities/game-slat-product.entity';
import { GameSlatTier } from '../../../entities/game-slat-tier.entity';
import { GamePickTime } from '../../../entities/game-pick-time.entity';
import { GamePickInfo } from '../../../entities/game-pick-info.entity';
import { GamePickWinAmount } from '../../../entities/game-pick-win-amount.entity';
import { GamePickPrize } from '../../../entities/game-pick-prize.entity';
import { GameDailyReward } from '../../../entities/game-daily-reward.entity';
import { GameRuleSection } from '../../../entities/game-rule-section.entity';
import {
  GameMechanicsConfig,
  FAMILY_DEFAULTS,
  PrizeCounts,
  SlatProductView,
  SlatTierView,
} from './game-config.types';
import { resolveFamily } from './mechanics/family-map';
import { GameFamily, SlatMatchMode } from '../../../common/enums';

export type { SlatProductView, SlatTierView };

export interface BoxItemView {
  itemID: number;
  name: string;
  prize: number;
  rate: string;
  icon: string;
  imgID: string;
  link: string;
}

export interface WheelSegmentView {
  name: string;
  prize: number;
  weight: number;
  odds: number;
}

export interface ColorPaletteView {
  colorKey: string;
  hex: string;
}

export interface NumberColorView {
  number: number;
  colors: string[];
}

export interface PositionColorView {
  position: number;
  color: string;
  gradient?: string;
}

export interface PositionColors {
  colors: string[];
  gradients: string[][];
}

export interface RaceRunnerView {
  name: string;
  nameShort: string;
  colorHex: string;
  spriteKey: string | null;
}

export interface GameAssetView {
  assetType: string;
  number: number | null;
  url: string;
}

export interface PrizeTierView {
  level: number;
  prize: string;
  intPrize: number;
  tierName?: string;
  matchRule?: string;
}

export interface PickInfoView {
  pickInfoId: number;
  pickLevel: number;
  pickTitle: string;
  pickAmount: number;
  pickWinAmount: number[];
}

export interface PickTimeView {
  timeName: string;
  drawTime: string;
}

export interface RuleSectionView {
  title: string;
  content: string;
}

export interface LobbyPlacementView {
  section: string;
  sortOrder: number;
}

@Injectable()
export class GameConfigService {
  constructor(
    @InjectRepository(GameRaceConfig)
    private readonly raceRepo: Repository<GameRaceConfig>,
    @InjectRepository(GameKeralaConfig)
    private readonly keralaRepo: Repository<GameKeralaConfig>,
    @InjectRepository(GamePunjabConfig)
    private readonly punjabRepo: Repository<GamePunjabConfig>,
    @InjectRepository(GameBoxConfig)
    private readonly boxRepo: Repository<GameBoxConfig>,
    @InjectRepository(GameWheelConfig)
    private readonly wheelRepo: Repository<GameWheelConfig>,
    @InjectRepository(GamePick4Config)
    private readonly pick4Repo: Repository<GamePick4Config>,
    @InjectRepository(GameLobbyPlacement)
    private readonly lobbyRepo: Repository<GameLobbyPlacement>,
    @InjectRepository(GameNumberPrefix)
    private readonly prefixRepo: Repository<GameNumberPrefix>,
    @InjectRepository(GamePrizeTier)
    private readonly prizeTierRepo: Repository<GamePrizeTier>,
    @InjectRepository(GameBoxItem)
    private readonly boxItemRepo: Repository<GameBoxItem>,
    @InjectRepository(GameWheelSegment)
    private readonly wheelSegRepo: Repository<GameWheelSegment>,
    @InjectRepository(GamePickTime)
    private readonly pickTimeRepo: Repository<GamePickTime>,
    @InjectRepository(GamePickInfo)
    private readonly pickInfoRepo: Repository<GamePickInfo>,
    @InjectRepository(GamePickWinAmount)
    private readonly pickWinRepo: Repository<GamePickWinAmount>,
    @InjectRepository(GamePickPrize)
    private readonly pickPrizeRepo: Repository<GamePickPrize>,
    @InjectRepository(GameDailyReward)
    private readonly dailyRepo: Repository<GameDailyReward>,
    @InjectRepository(GameRuleSection)
    private readonly ruleRepo: Repository<GameRuleSection>,
    @InjectRepository(GameColorPalette)
    private readonly colorPaletteRepo: Repository<GameColorPalette>,
    @InjectRepository(GameNumberColor)
    private readonly numberColorRepo: Repository<GameNumberColor>,
    @InjectRepository(GamePositionColor)
    private readonly positionColorRepo: Repository<GamePositionColor>,
    @InjectRepository(GameRaceRunner)
    private readonly raceRunnerRepo: Repository<GameRaceRunner>,
    @InjectRepository(GameAsset)
    private readonly assetRepo: Repository<GameAsset>,
    @InjectRepository(GameSlatProduct)
    private readonly slatProductRepo: Repository<GameSlatProduct>,
    @InjectRepository(GameSlatTier)
    private readonly slatTierRepo: Repository<GameSlatTier>,
  ) {}

  async deleteAllForGame(gameId: number): Promise<void> {
    const pickInfos = await this.pickInfoRepo.find({ where: { gameId } });
    const pickInfoIds = pickInfos.map((p) => p.id);
    if (pickInfoIds.length > 0) {
      await this.pickWinRepo.delete({ pickInfoId: In(pickInfoIds) });
    }
    const slatProducts = await this.slatProductRepo.find({ where: { gameId } });
    const slatProductIds = slatProducts.map((p) => p.id);
    if (slatProductIds.length > 0) {
      await this.slatTierRepo.delete({ productId: In(slatProductIds) });
      await this.slatProductRepo.delete({ gameId });
    }
    await Promise.all([
      this.raceRepo.delete({ gameId }),
      this.keralaRepo.delete({ gameId }),
      this.punjabRepo.delete({ gameId }),
      this.boxRepo.delete({ gameId }),
      this.wheelRepo.delete({ gameId }),
      this.pick4Repo.delete({ gameId }),
      this.lobbyRepo.delete({ gameId }),
      this.prefixRepo.delete({ gameId }),
      this.prizeTierRepo.delete({ gameId }),
      this.boxItemRepo.delete({ gameId }),
      this.wheelSegRepo.delete({ gameId }),
      this.pickTimeRepo.delete({ gameId }),
      this.pickInfoRepo.delete({ gameId }),
      this.pickPrizeRepo.delete({ gameId }),
      this.dailyRepo.delete({ gameId }),
      this.ruleRepo.delete({ gameId }),
      this.colorPaletteRepo.delete({ gameId }),
      this.numberColorRepo.delete({ gameId }),
      this.positionColorRepo.delete({ gameId }),
      this.raceRunnerRepo.delete({ gameId }),
      this.assetRepo.delete({ gameId }),
    ]);
  }

  async cloneAllForGame(
    sourceGameId: number,
    targetGameId: number,
    manager: EntityManager,
  ): Promise<void> {
    await this.cloneSingletonConfig(
      manager,
      GameRaceConfig,
      sourceGameId,
      targetGameId,
    );
    await this.cloneSingletonConfig(
      manager,
      GameKeralaConfig,
      sourceGameId,
      targetGameId,
    );
    await this.cloneSingletonConfig(
      manager,
      GamePunjabConfig,
      sourceGameId,
      targetGameId,
    );
    await this.cloneSingletonConfig(
      manager,
      GameBoxConfig,
      sourceGameId,
      targetGameId,
    );
    await this.cloneSingletonConfig(
      manager,
      GameWheelConfig,
      sourceGameId,
      targetGameId,
    );
    await this.cloneSingletonConfig(
      manager,
      GamePick4Config,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameLobbyPlacement,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameNumberPrefix,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GamePrizeTier,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameBoxItem,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameWheelSegment,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GamePickTime,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GamePickPrize,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameDailyReward,
      sourceGameId,
      targetGameId,
    );
    await this.cloneChildConfig(
      manager,
      GameRuleSection,
      sourceGameId,
      targetGameId,
    );
    await this.clonePickInfos(manager, sourceGameId, targetGameId);
    await this.cloneSlatProducts(manager, sourceGameId, targetGameId);
  }

  private async cloneSlatProducts(
    manager: EntityManager,
    sourceGameId: number,
    targetGameId: number,
  ): Promise<void> {
    const productRepo = manager.getRepository(GameSlatProduct);
    const tierRepo = manager.getRepository(GameSlatTier);
    const products = await productRepo.find({
      where: { gameId: sourceGameId },
      order: { sortOrder: 'ASC' },
    });
    for (const product of products) {
      const created = await productRepo.save(
        productRepo.create({
          ...product,
          id: undefined,
          gameId: targetGameId,
        }),
      );
      const tiers = await tierRepo.find({
        where: { productId: product.id },
        order: { sortOrder: 'ASC' },
      });
      if (tiers.length === 0) continue;
      await tierRepo.save(
        tiers.map((tier) =>
          tierRepo.create({
            ...tier,
            id: undefined,
            productId: created.id,
          }),
        ),
      );
    }
  }

  private async cloneSingletonConfig<T extends { gameId: number }>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    sourceGameId: number,
    targetGameId: number,
  ): Promise<void> {
    const repo = manager.getRepository(entity);
    const row = await repo.findOne({
      where: { gameId: sourceGameId } as unknown as FindOptionsWhere<T>,
    });
    if (!row) return;
    await repo.save(
      repo.create({
        ...row,
        gameId: targetGameId,
      } as unknown as DeepPartial<T>),
    );
  }

  private async cloneChildConfig<T extends { id: number; gameId: number }>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    sourceGameId: number,
    targetGameId: number,
  ): Promise<void> {
    const repo = manager.getRepository(entity);
    const rows = await repo.find({
      where: { gameId: sourceGameId } as unknown as FindOptionsWhere<T>,
    });
    if (rows.length === 0) return;
    await repo.save(
      rows.map((row) =>
        repo.create({
          ...row,
          id: undefined,
          gameId: targetGameId,
        } as unknown as DeepPartial<T>),
      ),
    );
  }

  private async clonePickInfos(
    manager: EntityManager,
    sourceGameId: number,
    targetGameId: number,
  ): Promise<void> {
    const infoRepo = manager.getRepository(GamePickInfo);
    const winRepo = manager.getRepository(GamePickWinAmount);
    const infos = await infoRepo.find({ where: { gameId: sourceGameId } });
    for (const info of infos) {
      const created = await infoRepo.save(
        infoRepo.create({ ...info, id: undefined, gameId: targetGameId }),
      );
      const wins = await winRepo.find({ where: { pickInfoId: info.id } });
      if (wins.length === 0) continue;
      await winRepo.save(
        wins.map((win) =>
          winRepo.create({ ...win, id: undefined, pickInfoId: created.id }),
        ),
      );
    }
  }

  getRaceConfig(gameId: number): Promise<GameRaceConfig | null> {
    return this.raceRepo.findOne({ where: { gameId } });
  }

  getKeralaConfig(gameId: number): Promise<GameKeralaConfig | null> {
    return this.keralaRepo.findOne({ where: { gameId } });
  }

  getPunjabConfig(gameId: number): Promise<GamePunjabConfig | null> {
    return this.punjabRepo.findOne({ where: { gameId } });
  }

  getBoxConfig(gameId: number): Promise<GameBoxConfig | null> {
    return this.boxRepo.findOne({ where: { gameId } });
  }

  getWheelConfig(gameId: number): Promise<GameWheelConfig | null> {
    return this.wheelRepo.findOne({ where: { gameId } });
  }

  getPick4Config(gameId: number): Promise<GamePick4Config | null> {
    return this.pick4Repo.findOne({ where: { gameId } });
  }

  async getPrefix2ndList(gameId: number): Promise<string[]> {
    const rows = await this.prefixRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => r.prefix);
  }

  async getPrizeTiers(gameId: number): Promise<PrizeTierView[]> {
    const rows = await this.prizeTierRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      level: r.level,
      prize: String(r.prizeLabel ?? r.prizeValue),
      intPrize: Number(r.prizeValue),
      tierName: r.tierName ?? undefined,
      matchRule: r.matchRule ?? undefined,
    }));
  }

  async getBoxItems(gameId: number): Promise<BoxItemView[]> {
    const rows = await this.boxItemRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      itemID: r.itemId,
      name: r.name,
      prize: Number(r.prize),
      rate: String(r.rate),
      icon: r.iconUrl ?? '',
      imgID: r.imgId ?? '',
      link: r.linkUrl ?? '',
    }));
  }

  getBoxItemRows(gameId: number): Promise<GameBoxItem[]> {
    return this.boxItemRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
  }

  async getWheelSegments(gameId: number): Promise<WheelSegmentView[]> {
    const rows = await this.wheelSegRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      name: r.name,
      prize: Number(r.prize),
      weight: r.weight,
      odds: Number(r.odds),
    }));
  }

  async getPickTimes(gameId: number): Promise<PickTimeView[]> {
    const rows = await this.pickTimeRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({ timeName: r.timeName, drawTime: r.drawTime }));
  }

  async getPickInfos(gameId: number): Promise<PickInfoView[]> {
    const infos = await this.pickInfoRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    if (infos.length === 0) return [];
    const wins = await this.pickWinRepo.find({
      where: { pickInfoId: In(infos.map((i) => i.id)) },
      order: { sortOrder: 'ASC' },
    });
    const winsByInfo = new Map<number, number[]>();
    for (const w of wins) {
      const list = winsByInfo.get(w.pickInfoId) ?? [];
      list.push(Number(w.amount));
      winsByInfo.set(w.pickInfoId, list);
    }
    return infos.map((i) => ({
      pickInfoId: i.pickInfoId,
      pickLevel: i.pickLevel,
      pickTitle: i.pickTitle,
      pickAmount: i.pickAmount,
      pickWinAmount: winsByInfo.get(i.id) ?? [],
    }));
  }

  async getPickPrizes(
    gameId: number,
    variant: number,
  ): Promise<{ level: number; prize: number }[]> {
    const rows = await this.pickPrizeRepo.find({
      where: { gameId, variant },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({ level: r.level, prize: Number(r.prize) }));
  }

  async getDailyRewards(gameId: number): Promise<number[]> {
    const rows = await this.dailyRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => Number(r.amount));
  }

  async getRuleSections(gameId: number): Promise<RuleSectionView[]> {
    const rows = await this.ruleRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({ title: r.title, content: r.content }));
  }

  async getLobbyPlacements(gameId: number): Promise<LobbyPlacementView[]> {
    const rows = await this.lobbyRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({ section: r.section, sortOrder: r.sortOrder }));
  }

  async getLobbyPlacementMap(
    gameIds: number[],
  ): Promise<Map<number, LobbyPlacementView[]>> {
    const map = new Map<number, LobbyPlacementView[]>();
    if (gameIds.length === 0) return map;
    const rows = await this.lobbyRepo.find({
      where: { gameId: In(gameIds) },
      order: { sortOrder: 'ASC' },
    });
    for (const r of rows) {
      const list = map.get(r.gameId) ?? [];
      list.push({ section: r.section, sortOrder: r.sortOrder });
      map.set(r.gameId, list);
    }
    return map;
  }

  async saveKeralaConfig(
    gameId: number,
    cfg: Partial<GameKeralaConfig>,
  ): Promise<void> {
    const existing = await this.keralaRepo.findOne({ where: { gameId } });
    await this.keralaRepo.save(
      this.keralaRepo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async savePunjabConfig(
    gameId: number,
    cfg: Partial<GamePunjabConfig>,
  ): Promise<void> {
    const existing = await this.punjabRepo.findOne({ where: { gameId } });
    await this.punjabRepo.save(
      this.punjabRepo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async saveRaceConfig(
    gameId: number,
    cfg: Partial<GameRaceConfig>,
  ): Promise<void> {
    const existing = await this.raceRepo.findOne({ where: { gameId } });
    await this.raceRepo.save(
      this.raceRepo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async savePick4Config(
    gameId: number,
    cfg: Partial<GamePick4Config>,
  ): Promise<void> {
    const existing = await this.pick4Repo.findOne({ where: { gameId } });
    await this.pick4Repo.save(
      this.pick4Repo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async saveBoxConfig(
    gameId: number,
    cfg: Partial<GameBoxConfig>,
  ): Promise<void> {
    const existing = await this.boxRepo.findOne({ where: { gameId } });
    await this.boxRepo.save(
      this.boxRepo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async saveWheelConfig(
    gameId: number,
    cfg: Partial<GameWheelConfig>,
  ): Promise<void> {
    const existing = await this.wheelRepo.findOne({ where: { gameId } });
    await this.wheelRepo.save(
      this.wheelRepo.create({ ...(existing ?? {}), ...cfg, gameId }),
    );
  }

  async replaceWheelSegments(
    gameId: number,
    segments: WheelSegmentView[],
  ): Promise<void> {
    await this.wheelSegRepo.delete({ gameId });
    if (segments.length > 0) {
      await this.wheelSegRepo.save(
        segments.map((s, i) =>
          this.wheelSegRepo.create({
            gameId,
            name: s.name,
            prize: s.prize,
            weight: s.weight,
            odds: s.odds,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async getColorPaletteRows(gameId: number): Promise<ColorPaletteView[]> {
    const rows = await this.colorPaletteRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({ colorKey: r.colorKey, hex: r.hex }));
  }

  async getColorPaletteMap(gameId: number): Promise<Record<string, string>> {
    const rows = await this.getColorPaletteRows(gameId);
    return rows.reduce<Record<string, string>>((acc, r) => {
      acc[r.colorKey] = r.hex;
      return acc;
    }, {});
  }

  async replaceColorPalette(
    gameId: number,
    palette: ColorPaletteView[],
  ): Promise<void> {
    await this.colorPaletteRepo.delete({ gameId });
    if (palette.length > 0) {
      await this.colorPaletteRepo.save(
        palette.map((p, i) =>
          this.colorPaletteRepo.create({
            gameId,
            colorKey: p.colorKey,
            hex: p.hex,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async getNumberColorRows(gameId: number): Promise<NumberColorView[]> {
    const rows = await this.numberColorRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    const byNumber = new Map<number, string[]>();
    for (const r of rows) {
      const list = byNumber.get(r.number) ?? [];
      list.push(r.colorKey);
      byNumber.set(r.number, list);
    }
    return Array.from(byNumber.entries()).map(([number, colors]) => ({
      number,
      colors,
    }));
  }

  async getNumberColorMap(gameId: number): Promise<Record<string, string[]>> {
    const rows = await this.getNumberColorRows(gameId);
    return rows.reduce<Record<string, string[]>>((acc, r) => {
      acc[String(r.number)] = r.colors;
      return acc;
    }, {});
  }

  async replaceNumberColors(
    gameId: number,
    items: NumberColorView[],
  ): Promise<void> {
    await this.numberColorRepo.delete({ gameId });
    const rows: GameNumberColor[] = [];
    let order = 0;
    for (const item of items) {
      for (const colorKey of item.colors) {
        rows.push(
          this.numberColorRepo.create({
            gameId,
            number: item.number,
            colorKey,
            sortOrder: order,
          }),
        );
        order += 1;
      }
    }
    if (rows.length > 0) await this.numberColorRepo.save(rows);
  }

  async getPositionColorRows(gameId: number): Promise<PositionColorView[]> {
    const rows = await this.positionColorRepo.find({
      where: { gameId },
      order: { position: 'ASC' },
    });
    return rows.map((r) => ({
      position: r.position,
      color: r.color,
      gradient: r.gradient ?? undefined,
    }));
  }

  async getPositionColors(gameId: number): Promise<PositionColors> {
    const rows = await this.positionColorRepo.find({
      where: { gameId },
      order: { position: 'ASC' },
    });
    if (rows.length === 0) {
      return { colors: [], gradients: [] };
    }
    const maxPosition = rows.reduce((m, r) => Math.max(m, r.position), -1);
    const colors: string[] = new Array<string>(maxPosition + 1).fill('');
    const gradients: string[][] = new Array<string[]>(maxPosition + 1)
      .fill([])
      .map(() => []);
    for (const row of rows) {
      colors[row.position] = row.color;
      gradients[row.position] = row.gradient
        ? row.gradient.split(',').filter((part) => part.length > 0)
        : [];
    }
    return { colors, gradients };
  }

  async replacePositionColors(
    gameId: number,
    items: PositionColorView[],
  ): Promise<void> {
    await this.positionColorRepo.delete({ gameId });
    if (items.length > 0) {
      await this.positionColorRepo.save(
        items.map((item, i) =>
          this.positionColorRepo.create({
            gameId,
            position: item.position,
            color: item.color,
            gradient: item.gradient ?? null,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async getRaceRunners(gameId: number): Promise<RaceRunnerView[]> {
    const rows = await this.raceRunnerRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      name: r.name,
      nameShort: r.nameShort,
      colorHex: r.colorHex,
      spriteKey: r.spriteKey,
    }));
  }

  async replaceRaceRunners(
    gameId: number,
    runners: RaceRunnerView[],
  ): Promise<void> {
    await this.raceRunnerRepo.delete({ gameId });
    if (runners.length > 0) {
      await this.raceRunnerRepo.save(
        runners.map((r, i) =>
          this.raceRunnerRepo.create({
            gameId,
            name: r.name,
            nameShort: r.nameShort,
            colorHex: r.colorHex,
            spriteKey: r.spriteKey ?? null,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async getGameAssetRows(gameId: number): Promise<GameAssetView[]> {
    const rows = await this.assetRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      assetType: r.assetType,
      number: r.number,
      url: r.url,
    }));
  }

  async getGameAssetBundle(
    gameId: number,
  ): Promise<{ icons: Record<string, string>; background: string | null }> {
    const rows = await this.getGameAssetRows(gameId);
    const icons: Record<string, string> = {};
    let background: string | null = null;
    for (const r of rows) {
      if (r.assetType === 'icon' && r.number != null) {
        icons[String(r.number)] = r.url;
      } else if (r.assetType === 'background') {
        background = r.url;
      }
    }
    return { icons, background };
  }

  async replaceGameAssets(
    gameId: number,
    assets: GameAssetView[],
  ): Promise<void> {
    await this.assetRepo.delete({ gameId });
    const clean = assets.filter((a) => (a.url ?? '').trim());
    if (clean.length > 0) {
      await this.assetRepo.save(
        clean.map((a, i) =>
          this.assetRepo.create({
            gameId,
            assetType: a.assetType,
            number: a.number ?? null,
            url: a.url,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async replacePrizeTiers(
    gameId: number,
    tiers: {
      level: number;
      prizeLabel?: string;
      prizeValue: number;
      tierName?: string;
      matchRule?: string;
    }[],
  ): Promise<void> {
    await this.prizeTierRepo.delete({ gameId });
    if (tiers.length > 0) {
      await this.prizeTierRepo.save(
        tiers.map((t, i) =>
          this.prizeTierRepo.create({
            gameId,
            level: t.level,
            prizeLabel: t.prizeLabel,
            prizeValue: t.prizeValue,
            tierName: t.tierName,
            matchRule: t.matchRule,
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async replaceBoxItems(
    gameId: number,
    items: {
      itemId?: number;
      name: string;
      prize: number;
      rate: number;
      iconUrl?: string;
      imgId?: string;
      linkUrl?: string;
      sortOrder?: number;
    }[],
  ): Promise<void> {
    await this.boxItemRepo.delete({ gameId });
    if (items.length > 0) {
      await this.boxItemRepo.save(
        items.map((it, i) =>
          this.boxItemRepo.create({
            gameId,
            itemId: it.itemId ?? 0,
            name: it.name,
            prize: it.prize,
            rate: it.rate,
            iconUrl: it.iconUrl,
            imgId: it.imgId,
            linkUrl: it.linkUrl,
            sortOrder: it.sortOrder ?? i,
          }),
        ),
      );
    }
  }

  async replaceNumberPrefixes(
    gameId: number,
    prefixes: string[],
  ): Promise<void> {
    await this.prefixRepo.delete({ gameId });
    const clean = prefixes
      .map((p) => (p ?? '').trim())
      .filter((p) => p.length > 0);
    if (clean.length > 0) {
      await this.prefixRepo.save(
        clean.map((p, i) =>
          this.prefixRepo.create({ gameId, prefix: p, sortOrder: i }),
        ),
      );
    }
  }

  async replaceRuleSections(
    gameId: number,
    sections: { title: string; content: string }[],
  ): Promise<void> {
    await this.ruleRepo.delete({ gameId });
    const clean = sections.filter(
      (s) => (s.title ?? '').trim() || (s.content ?? '').trim(),
    );
    if (clean.length > 0) {
      await this.ruleRepo.save(
        clean.map((s, i) =>
          this.ruleRepo.create({
            gameId,
            title: (s.title ?? '').trim(),
            content: s.content ?? '',
            sortOrder: i,
          }),
        ),
      );
    }
  }

  async getSlatProducts(gameId: number): Promise<SlatProductView[]> {
    const products = await this.slatProductRepo.find({
      where: { gameId },
      order: { sortOrder: 'ASC' },
    });
    if (products.length === 0) return [];
    const slatGame = await this.slatProductRepo.manager.findOne(GameList, {
      where: { id: gameId },
    });
    if (!slatGame?.digitCount) {
      throw new BadRequestException(
        `Game ${gameId} is missing digit_count required for slat products`,
      );
    }
    const gameDigitCount = Number(slatGame.digitCount);
    const tiers = await this.slatTierRepo.find({
      where: { productId: In(products.map((p) => p.id)) },
      order: { sortOrder: 'ASC' },
    });
    const tiersByProduct = new Map<number, SlatTierView[]>();
    for (const tier of tiers) {
      const list = tiersByProduct.get(tier.productId) ?? [];
      list.push({
        label: tier.label,
        positions: tier.memberPositions
          .split(',')
          .filter((part) => part.length > 0)
          .map(Number),
        winAmount: Number(tier.winAmount),
        tierRank: tier.tierRank,
      });
      tiersByProduct.set(tier.productId, list);
    }
    return products.map((p) => ({
      id: p.id,
      digitCount: gameDigitCount,
      price: Number(p.price),
      matchMode: p.matchMode,
      title: p.title,
      status: p.status,
      tiers: tiersByProduct.get(p.id) ?? [],
    }));
  }

  async replaceSlatProducts(
    gameId: number,
    products: SlatProductView[],
  ): Promise<void> {
    const game = await this.slatProductRepo.manager.findOne(GameList, {
      where: { id: gameId },
    });
    if (!game?.digitCount) {
      throw new BadRequestException(
        `Game ${gameId} is missing digit_count required for slat products`,
      );
    }
    const gameDigitCount = Number(game.digitCount);
    for (const product of products) {
      this.validateSlatProduct(product, gameDigitCount);
    }
    await this.slatProductRepo.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(GameSlatProduct);
      const tierRepo = manager.getRepository(GameSlatTier);
      const existing = await productRepo.find({ where: { gameId } });
      if (existing.length > 0) {
        await tierRepo.delete({ productId: In(existing.map((p) => p.id)) });
        await productRepo.delete({ gameId });
      }
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const savedProduct = await productRepo.save(
          productRepo.create({
            gameId,
            digitCount: gameDigitCount,
            price: product.price,
            matchMode: product.matchMode,
            title: product.title,
            status: product.status,
            sortOrder: i,
          }),
        );
        await tierRepo.save(
          product.tiers.map((tier, tierIndex) =>
            tierRepo.create({
              productId: savedProduct.id,
              label: tier.label,
              memberPositions: tier.positions.join(','),
              winAmount: tier.winAmount,
              tierRank: tier.tierRank,
              sortOrder: tierIndex,
            }),
          ),
        );
      }
    });
  }

  private validateSlatProduct(
    product: SlatProductView,
    gameDigitCount: number,
  ): void {
    if (![1, 2, 3, 4, 5].includes(gameDigitCount)) {
      throw new BadRequestException('game digitCount must be between 1 and 5');
    }
    if (!Object.values(SlatMatchMode).includes(product.matchMode)) {
      throw new BadRequestException(`Invalid matchMode: ${product.matchMode}`);
    }
    if (Number(product.price) < 0) {
      throw new BadRequestException('price must be non-negative');
    }
    for (const tier of product.tiers) {
      if (tier.positions.length === 0) {
        throw new BadRequestException(`Tier ${tier.label} has no positions`);
      }
      for (const index of tier.positions) {
        if (!Number.isInteger(index) || index < 0) {
          throw new BadRequestException(
            `Tier ${tier.label} has invalid position ${index}`,
          );
        }
        if (index >= gameDigitCount) {
          throw new BadRequestException(
            `Tier ${tier.label} position ${index} exceeds digitCount ${gameDigitCount}`,
          );
        }
      }
      if (Number(tier.winAmount) < 0) {
        throw new BadRequestException(
          `Tier ${tier.label} winAmount must be non-negative`,
        );
      }
    }
    if (product.matchMode === SlatMatchMode.Ladder) {
      this.validateLadderChain(product.tiers);
    } else {
      for (const tier of product.tiers) {
        if (tier.tierRank !== 0) {
          throw new BadRequestException(
            `Group tier ${tier.label} must have tierRank 0`,
          );
        }
      }
    }
  }

  private validateLadderChain(tiers: SlatTierView[]): void {
    const sorted = [...tiers].sort(
      (a, b) => a.positions.length - b.positions.length,
    );
    for (let i = 1; i < sorted.length; i++) {
      const shorter = sorted[i - 1].positions;
      const longer = sorted[i].positions;
      const trailing = longer.slice(longer.length - shorter.length);
      for (let k = 0; k < shorter.length; k++) {
        if (shorter[k] !== trailing[k]) {
          throw new BadRequestException(
            `Ladder tier ${sorted[i - 1].label} is not a trailing subset of ${sorted[i].label}`,
          );
        }
      }
    }
  }

  async getMechanicsConfig(game: GameList): Promise<GameMechanicsConfig> {
    const family = resolveFamily(game.gameType);
    const defaults = FAMILY_DEFAULTS[family] ?? { family };
    const merged: GameMechanicsConfig = { ...defaults, family };
    merged.colorMap = defaults.colorMap;
    if (game.digitCount != null) merged.digitCount = game.digitCount;

    if (family === GameFamily.Color) {
      const perGame = await this.getNumberColorMap(game.id);
      const numbers = Object.keys(perGame);
      if (numbers.length > 0) {
        merged.colorMap = perGame;
        merged.numbers = numbers.map(Number).sort((a, b) => a - b);
      }
    }

    if (family === GameFamily.SingleDigit) {
      const min = Number(game.numberMin);
      const max = Number(game.numberMax);
      const lo = Number.isInteger(min) && min >= 1 ? min : 1;
      const hi = Number.isInteger(max) && max >= lo ? max : 36;
      merged.numberRange = [lo, hi];
    }

    if (family === GameFamily.Race) {
      const rc = await this.getRaceConfig(game.id);
      if (rc) merged.runnerCount = rc.runnerCount;
    }

    if (family === GameFamily.Lottery) {
      const kc = await this.getKeralaConfig(game.id);
      if (kc) {
        merged.ticketLength = kc.ticketLength;
        const counts: PrizeCounts = {
          second: kc.secondCount || undefined,
          third: kc.thirdCount,
          fourth: kc.fourthCount,
          fifth: kc.fifthCount,
          consolation: kc.consolationCount,
        };
        merged.prizeCounts = counts;
      }
      const tiers = await this.prizeTierRepo.find({
        where: { gameId: game.id },
      });
      const rules: Record<string, number> = {};
      for (const t of tiers) {
        if (t.tierName && Number(t.prizeValue) > 0) {
          rules[t.tierName] = Number(t.prizeValue);
        }
      }
      if (Object.keys(rules).length > 0) merged.prizeMatchRules = rules;
    }

    if (family === GameFamily.Digit3 || family === GameFamily.Digit5) {
      merged.slatProducts = await this.getSlatProducts(game.id);
    }

    return merged;
  }
}
