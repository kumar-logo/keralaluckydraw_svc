import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { GameList } from '../../../entities/game-list.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { ResultDecision as ResultDecisionEntity } from '../../../entities/result-decision.entity';
import { ConfigLoaderService } from '../../config/config-loader.service';
import { ResultMode as ResultModeEnum } from '../../../common/enums/result-mode.enum';
import { GameEngineService } from './game-engine.service';
import { GameConfigService } from './game-config.service';
import { OddsService, MissingOddsPolicy } from './odds.service';
import {
  GameMechanic,
  DrawResult,
  MechanicBetContent,
  betCodeOf,
} from './mechanics/mechanic.types';
import { GameMechanicsConfig, defaultRng, Rng } from './game-config.types';

export type ResultMode =
  | 'random'
  | 'weighted'
  | 'min_payout'
  | 'max_profit'
  | 'lowest_risk'
  | 'manual';

export interface ResultDecision {
  result: DrawResult;
  mode: ResultMode;
  candidatesEvaluated: number;
  candidateSpace: number;
  sampled: boolean;
  totalStake: number;
  totalPayout: number;
  totalWinners: number;
  profitLoss: number;
  houseEdgeTarget?: number;
  reason: string;
}

interface BetGroup {
  betType: string;
  betContent: any;
  betCode: string;
  stake: number;
  count: number;
  quantity: number;
  storedOdds: number;
}

const FREE_RESULT_POOL = 64;

@Injectable()
export class ResultEngineService {
  private readonly logger = new Logger(ResultEngineService.name);

  constructor(
    @InjectRepository(GameRound)
    private readonly roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(GameList) private readonly gameRepo: Repository<GameList>,
    @InjectRepository(GameOddsConfig)
    private readonly oddsRepo: Repository<GameOddsConfig>,
    @InjectRepository(ResultDecisionEntity)
    private readonly decisionRepo: Repository<ResultDecisionEntity>,
    private readonly gameEngine: GameEngineService,
    private readonly gameConfig: GameConfigService,
    private readonly oddsService: OddsService,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async decideForRound(
    roundId: number,
    rng: Rng = defaultRng,
  ): Promise<ResultDecision> {
    const ctx = await this.loadContext(roundId);
    return this.decide({ ...ctx, mode: ctx.mode, rng });
  }

  async previewForRound(
    roundId: number,
    proposedResult: any,
  ): Promise<{
    proposedResult: any;
    totalWinners: number;
    totalPayout: number;
    totalStake: number;
    profitLoss: number;
    winRate: number;
    winners: {
      userId: string;
      orderNo: string;
      betContent: any;
      amount: number;
      winAmount: number;
      prizeLevel?: string;
    }[];
  }> {
    const ctx = await this.loadContext(roundId);
    const aliasMap = await this.configLoader.getOddsAliasMap();
    const missingPolicy = await this.configLoader.getOddsMissingPolicy();

    const winners: any[] = [];
    let totalStake = 0;
    let totalPayout = 0;

    for (const order of ctx.fullOrders) {
      totalStake += Number(order.totalAmount);
      if (!ctx.mechanic) continue;
      const outcome = ctx.mechanic.evaluate({
        betType: order.betType || '',
        betContent: (order.betContent as MechanicBetContent) || {},
        result: proposedResult,
        cfg: ctx.cfg,
      });
      if (!outcome.won) continue;
      let winAmount: number;
      if (outcome.fixedWin !== undefined) {
        winAmount = round2(outcome.fixedWin * (Number(order.quantity) || 1));
      } else {
        let odds: number;
        if (outcome.prizeLevel) {
          odds =
            ctx.oddsMap[outcome.prizeLevel] ??
            ctx.oddsMap[`prize_${outcome.prizeLevel}`] ??
            (Number(order.odds) || 1);
        } else {
          odds = this.oddsService.resolve({
            oddsMap: ctx.oddsMap,
            betCode: betCodeOf(
              order.betContent as MechanicBetContent,
              order.betType || '',
            ),
            oddsKey: outcome.oddsKey,
            storedOdds: Number(order.odds),
            aliasMap,
            missingPolicy: missingPolicy as any,
          }).odds;
        }
        winAmount = Number(order.totalAmount) * odds;
      }
      totalPayout += winAmount;
      winners.push({
        userId: order.userId,
        orderNo: order.orderNo,
        betContent: order.betContent,
        amount: Number(order.totalAmount),
        winAmount: round2(winAmount),
        prizeLevel: outcome.prizeLevel,
      });
    }

    return {
      proposedResult,
      totalWinners: winners.length,
      totalPayout: round2(totalPayout),
      totalStake: round2(totalStake),
      profitLoss: round2(totalStake - totalPayout),
      winRate:
        ctx.fullOrders.length > 0
          ? round2((winners.length / ctx.fullOrders.length) * 100)
          : 0,
      winners: winners.slice(0, 100),
    };
  }

  async recommendForRound(roundId: number): Promise<
    {
      result: any;
      strategy: string;
      totalPayout: number;
      totalWinners: number;
      profitLoss: number;
      description: string;
    }[]
  > {
    const ctx = await this.loadContext(roundId);
    if (ctx.fullOrders.length === 0) {
      return [
        {
          result: null,
          strategy: 'no_orders',
          totalPayout: 0,
          totalWinners: 0,
          profitLoss: 0,
          description: 'No pending orders — any result produces zero payout.',
        },
      ];
    }
    const modes: ResultMode[] = [
      ResultModeEnum.MinPayout,
      ResultModeEnum.LowestRisk,
      ResultModeEnum.Random,
    ];
    const out: {
      result: any;
      strategy: string;
      totalPayout: number;
      totalWinners: number;
      profitLoss: number;
      description: string;
    }[] = [];
    const seen = new Set<string>();
    for (const mode of modes) {
      const d = await this.decide({ ...ctx, mode });
      const key = JSON.stringify(d.result?.drawResult ?? d.result);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        result: d.result,
        strategy: d.reason,
        totalPayout: d.totalPayout,
        totalWinners: d.totalWinners,
        profitLoss: d.profitLoss,
        description:
          d.reason === ResultModeEnum.MinPayout ||
          d.reason === ResultModeEnum.MaxProfit ||
          d.reason === 'forced_min_loss'
            ? `Lowest payout ${d.totalPayout} (${d.totalWinners} winners) — profit ${d.profitLoss}.`
            : d.reason === ResultModeEnum.LowestRisk
              ? `Within house-edge target — payout ${d.totalPayout}.`
              : `Fair random — payout ${d.totalPayout}.`,
      });
    }
    return out;
  }

  private async loadContext(roundId: number) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    const game = await this.gameRepo.findOne({ where: { id: round.gameId } });
    if (!game) throw new NotFoundException('Game not found');

    const fullOrders = await this.orderRepo.find({
      where: { gameId: round.gameId, roundNo: round.roundNo, status: 0 },
    });
    const oddsMap = await this.loadOddsMap(round.gameId);
    const defaultMode =
      (await this.configLoader.getResultModeDefault()) as ResultMode;
    const mode =
      (game.resultMode as ResultMode) || defaultMode || ResultModeEnum.Random;
    const houseEdgeTarget =
      game.resultHouseEdgeTarget != null
        ? Number(game.resultHouseEdgeTarget)
        : await this.configLoader.getResultHouseEdgeDefault();

    return {
      round,
      game,
      gameType: game.gameType,
      cfg: await this.gameConfig.getMechanicsConfig(game),
      mechanic: this.gameEngine.getMechanic(game.gameType),
      orders: fullOrders,
      fullOrders,
      oddsMap,
      mode,
      houseEdgeTarget,
      weights: undefined,
      avoidBigPrize: game.resultAvoidBigPrize === 1,
      avoidZeroOrder: game.resultAvoidZeroOrder === 1,
    };
  }

  async decide(ctx: {
    gameType: string;
    cfg: GameMechanicsConfig;
    mechanic?: GameMechanic;
    orders: Pick<
      Order,
      'betType' | 'betContent' | 'totalAmount' | 'odds' | 'quantity'
    >[];
    oddsMap: Record<string, number>;
    mode: ResultMode;
    houseEdgeTarget?: number;
    weights?: Record<string, number>;
    avoidBigPrize?: boolean;
    avoidZeroOrder?: boolean;
    rng?: Rng;
  }): Promise<ResultDecision> {
    const { cfg, mechanic, orders, oddsMap, mode, houseEdgeTarget } = ctx;
    const rng = ctx.rng ?? defaultRng;
    const avoidBigPrize = !!ctx.avoidBigPrize;
    const avoidZeroOrder = !!ctx.avoidZeroOrder;
    const constrained = avoidBigPrize || avoidZeroOrder;

    if (!mechanic) {
      this.logger.warn(
        `No mechanic for gameType=${ctx.gameType}; emitting empty result`,
      );
      return this.emptyDecision(mode, 'no_mechanic');
    }

    const totalStake = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const groups = this.aggregate(orders);

    const aliasMap = await this.configLoader.getOddsAliasMap();
    const missingPolicy = await this.configLoader.getOddsMissingPolicy();
    const sampleSize = await this.configLoader.getResultSampleSize();
    const budgetMs = await this.configLoader.getResultDecisionBudgetMs();

    const houseFavoring =
      mode === ResultModeEnum.MaxProfit ||
      mode === ResultModeEnum.MinPayout ||
      mode === ResultModeEnum.LowestRisk;

    if (
      orders.length === 0 ||
      (!houseFavoring &&
        (mode === ResultModeEnum.Random || mode === ResultModeEnum.Manual) &&
        !constrained)
    ) {
      const result = mechanic.generate(cfg, rng);
      const { payout, winners } = this.score(
        mechanic,
        cfg,
        result,
        groups,
        oddsMap,
        aliasMap,
        missingPolicy,
      );
      return {
        result,
        mode,
        candidatesEvaluated: 1,
        candidateSpace: 1,
        sampled: false,
        totalStake,
        totalPayout: round2(payout),
        totalWinners: winners,
        profitLoss: round2(totalStake - payout),
        houseEdgeTarget,
        reason:
          orders.length === 0
            ? 'no_orders'
            : mode === ResultModeEnum.Manual
              ? 'manual_suggestion'
              : ResultModeEnum.Random,
      };
    }

    const targets = this.extractTargets(orders);
    const candidates = mechanic.enumerateCandidates(cfg, {
      rng,
      sampleSize,
      targets,
    });
    const candidateSpace = candidates.length;
    const sampled = candidateSpace >= sampleSize;

    const scored: { result: any; payout: number; winners: number }[] = [];
    const start = Date.now();
    const seeksMinPayout =
      mode === ResultModeEnum.MinPayout || mode === ResultModeEnum.MaxProfit;
    let evaluated = 0;
    let freeFound = 0;
    for (const candidate of this.shuffled(candidates, rng)) {
      const { payout, winners } = this.score(
        mechanic,
        cfg,
        candidate,
        groups,
        oddsMap,
        aliasMap,
        missingPolicy,
      );
      scored.push({ result: candidate, payout, winners });
      evaluated++;
      if (payout === 0 && winners === 0) {
        freeFound++;
        if (seeksMinPayout && freeFound >= FREE_RESULT_POOL) break;
      }
      if (Date.now() - start > budgetMs) break;
    }

    let pool = scored;
    const applied: string[] = [];
    if (avoidZeroOrder) {
      const zero = pool.filter((s) => s.winners === 0);
      if (zero.length) {
        pool = zero;
        applied.push('avoid_zero_order');
      }
    }
    if (avoidBigPrize) {
      const cap = totalStake * (1 - (houseEdgeTarget ?? 0.15));
      const safe = pool.filter((s) => s.payout <= cap);
      if (safe.length) {
        pool = safe;
      } else {
        const min = pool.reduce((a, b) => (b.payout < a.payout ? b : a));
        pool = [min];
      }
      applied.push('avoid_big_prize');
    }

    const picked = this.pick(
      pool,
      mode,
      totalStake,
      houseEdgeTarget ?? 0.15,
      rng,
    );
    const reason = applied.length
      ? `${picked.reason}+${applied.join('+')}`
      : picked.reason;

    return {
      result: picked.choice.result,
      mode,
      candidatesEvaluated: evaluated,
      candidateSpace,
      sampled,
      totalStake: round2(totalStake),
      totalPayout: round2(picked.choice.payout),
      totalWinners: picked.choice.winners,
      profitLoss: round2(totalStake - picked.choice.payout),
      houseEdgeTarget,
      reason,
    };
  }

  async recordDecision(
    roundId: number,
    gameId: number,
    gameType: string,
    decision: ResultDecision,
    decidedBy: string,
  ): Promise<void> {
    try {
      await this.decisionRepo.save(
        this.decisionRepo.create({
          roundId,
          gameId,
          gameType,
          mode: decision.mode,
          decidedBy,
          candidatesEvaluated: decision.candidatesEvaluated,
          candidateSpace: decision.candidateSpace,
          sampled: decision.sampled ? 1 : 0,
          chosenResult: decision.result,
          totalStake: decision.totalStake,
          totalPayout: decision.totalPayout,
          profitLoss: decision.profitLoss,
          houseEdgeTarget: decision.houseEdgeTarget ?? undefined,
          reason: decision.reason,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to record result decision for round ${roundId}: ${(err as Error).message}`,
      );
    }
  }

  async listDecisions({
    gameId,
    mode,
    pageNo = 1,
    pageSize = 20,
  }: {
    gameId?: number;
    mode?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<{
    list: ResultDecisionEntity[];
    total: number;
    pageNo: number;
    pageSize: number;
  }> {
    const qb = this.decisionRepo
      .createQueryBuilder('d')
      .orderBy('d.created_at', 'DESC');
    if (gameId) qb.andWhere('d.game_id = :gid', { gid: gameId });
    if (mode) qb.andWhere('d.mode = :m', { m: mode });
    const total = await qb.getCount();
    const list = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, pageNo, pageSize };
  }

  private async loadOddsMap(gameId: number): Promise<Record<string, number>> {
    const configs = await this.oddsRepo.find({ where: { gameId, status: 1 } });
    const map: Record<string, number> = {};
    for (const c of configs) map[c.betType] = Number(c.odds);
    return map;
  }

  private selectionKey(betContent: MechanicBetContent | null): string {
    if (!betContent) return '';
    const parts: string[] = [];
    if (betContent.numbers !== undefined) parts.push(`n:${betContent.numbers}`);
    if (Array.isArray(betContent.codes)) parts.push(`c:${betContent.codes.join(',')}`);
    if (Array.isArray(betContent.positions))
      parts.push(`p:${betContent.positions.join(',')}`);
    if (betContent.slatProductId !== undefined)
      parts.push(`s:${betContent.slatProductId}`);
    if (betContent.ticketCode !== undefined)
      parts.push(`t:${betContent.ticketCode}`);
    return parts.join('|');
  }

  private aggregate(
    orders:
      | BetGroup['betContent'][]
      | Pick<
          Order,
          'betType' | 'betContent' | 'totalAmount' | 'odds' | 'quantity'
        >[],
  ): BetGroup[] {
    const groups = new Map<string, BetGroup>();
    for (const o of orders as Pick<
      Order,
      'betType' | 'betContent' | 'totalAmount' | 'odds' | 'quantity'
    >[]) {
      const betCode = betCodeOf(o.betContent as MechanicBetContent, o.betType);
      const sig = `${o.betType}||${betCode}||${this.selectionKey(
        o.betContent as MechanicBetContent,
      )}`;
      const qty = Number(o.quantity) || 1;
      const existing = groups.get(sig);
      if (existing) {
        existing.stake += Number(o.totalAmount);
        existing.count += 1;
        existing.quantity += qty;
      } else {
        groups.set(sig, {
          betType: o.betType,
          betContent: o.betContent,
          betCode,
          stake: Number(o.totalAmount),
          count: 1,
          quantity: qty,
          storedOdds: Number(o.odds),
        });
      }
    }
    return Array.from(groups.values());
  }

  private score(
    mechanic: GameMechanic,
    cfg: GameMechanicsConfig,
    result: any,
    groups: BetGroup[],
    oddsMap: Record<string, number>,
    aliasMap: Record<string, string>,
    missingPolicy: string,
  ): { payout: number; winners: number } {
    let payout = 0;
    let winners = 0;
    for (const g of groups) {
      const outcome = mechanic.evaluate({
        betType: g.betType,
        betContent: g.betContent,
        result,
        cfg,
      });
      if (!outcome.won) continue;
      if (outcome.fixedWin !== undefined) {
        payout += outcome.fixedWin * g.quantity;
        winners += g.count;
        continue;
      }
      let odds: number;
      if (outcome.prizeLevel) {
        odds =
          oddsMap[outcome.prizeLevel] ??
          oddsMap[`prize_${outcome.prizeLevel}`] ??
          (g.storedOdds > 0 ? g.storedOdds : 1);
      } else {
        odds = this.oddsService.resolve({
          oddsMap,
          betCode: g.betCode,
          oddsKey: outcome.oddsKey,
          storedOdds: g.storedOdds,
          aliasMap,
          missingPolicy: missingPolicy as any,
        }).odds;
      }
      payout += g.stake * odds;
      winners += g.count;
    }
    return { payout, winners };
  }

  private shuffled<T>(items: T[], rng: Rng): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  }

  private pick(
    scored: { result: any; payout: number; winners: number }[],
    mode: ResultMode,
    totalStake: number,
    houseEdgeTarget: number,
    rng: Rng,
  ): {
    choice: { result: any; payout: number; winners: number };
    reason: string;
  } {
    if (scored.length === 0)
      return {
        choice: { result: null, payout: 0, winners: 0 },
        reason: 'no_candidates',
      };

    if (
      mode === ResultModeEnum.MinPayout ||
      mode === ResultModeEnum.MaxProfit
    ) {
      const minPayout = scored.reduce(
        (m, s) => (s.payout < m ? s.payout : m),
        scored[0].payout,
      );
      const atMinPayout = scored.filter((s) => s.payout === minPayout);
      const minWinners = atMinPayout.reduce(
        (m, s) => (s.winners < m ? s.winners : m),
        atMinPayout[0].winners,
      );
      const best = atMinPayout.filter((s) => s.winners === minWinners);
      const choice = best[Math.floor(rng.next() * best.length)];
      const baseReason =
        mode === ResultModeEnum.MaxProfit
          ? ResultModeEnum.MaxProfit
          : ResultModeEnum.MinPayout;
      const reason =
        choice.payout > totalStake ? 'forced_min_loss' : baseReason;
      return { choice, reason };
    }

    if (mode === ResultModeEnum.LowestRisk) {
      const cap = totalStake * (1 - houseEdgeTarget);
      const within = scored.filter((s) => s.payout <= cap);
      if (within.length > 0) {
        const choice = within[Math.floor(rng.next() * within.length)];
        return { choice, reason: ResultModeEnum.LowestRisk };
      }
      const min = scored.reduce((a, b) => (b.payout < a.payout ? b : a));
      return { choice: min, reason: 'edge_target_unmet' };
    }

    if (mode === ResultModeEnum.Weighted) {
      const choice = scored[Math.floor(rng.next() * scored.length)];
      return { choice, reason: ResultModeEnum.Weighted };
    }

    const choice = scored[Math.floor(rng.next() * scored.length)];
    return { choice, reason: ResultModeEnum.Random };
  }

  private extractTargets(
    orders: Pick<Order, 'betType' | 'betContent'>[],
  ): string[] {
    const set = new Set<string>();
    for (const o of orders) {
      const betContent = o.betContent as {
        numbers?: unknown;
        betCode?: unknown;
        betNum?: unknown;
      } | null;
      const n =
        betContent?.numbers ?? betContent?.betCode ?? betContent?.betNum;
      if (n != null && /^\d+$/.test(String(n))) set.add(String(n));
    }
    return Array.from(set);
  }

  private emptyDecision(mode: ResultMode, reason: string): ResultDecision {
    return {
      result: { drawResult: '' },
      mode,
      candidatesEvaluated: 0,
      candidateSpace: 0,
      sampled: false,
      totalStake: 0,
      totalPayout: 0,
      totalWinners: 0,
      profitLoss: 0,
      reason,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
