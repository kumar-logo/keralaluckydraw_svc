import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { GameEngineService } from './game-engine.service';
import { GameConfigService } from './game-config.service';
import { ConfigLoaderService } from '../../config/config-loader.service';
import { SpaWsService } from '../../websocket/spa-ws.service';
import { MissingOddsPolicy, OddsService } from './odds.service';
import { Order } from '../../../entities/order.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { GameFeeConfig } from '../../../entities/game-fee-config.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import {
  OrderStatus,
  RoundStatus,
  SlatMatchMode,
  TransactionType,
} from '../../../common/enums';
import {
  GameMechanic,
  MechanicBetContent,
  MechanicResult,
  betCodeOf,
} from './mechanics/mechanic.types';
import { GameMechanicsConfig, SlatProductView } from './game-config.types';
import { computeNetWin } from './fee.util';

export interface SettlementReport {
  roundId: number;
  roundNo: string;
  gameType: string;
  totalOrders: number;
  wonOrders: number;
  lostOrders: number;
  totalBet: number;
  totalPayout: number;
  settledAt: Date;
  bigWins: string[];
}

interface EvaluationResult {
  won: boolean;
  winAmount: number;
  odds: number;
  prizeLevel?: string;
  fixed?: boolean;
}

interface EvaluationContext {
  game: GameList | null;
  mechanic: GameMechanic | undefined;
  cfg: GameMechanicsConfig;
  oddsMap: Record<string, number>;
  aliasMap: Record<string, string>;
  missingPolicy: string;
  winFee: GameFeeConfig | null;
}

interface SettledOutcome {
  won: boolean;
  netWin: number;
  odds: number;
  fixed: boolean;
  prizeLevel?: string;
}

type BetContentRecord = Record<string, unknown>;

export interface ResettleOrderChange {
  orderId: number;
  orderNo: string;
  userId: string;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  previousWin: number;
  nextWin: number;
  delta: number;
  odds: number;
  betContent?: BetContentRecord;
}

export interface ResettlePlan {
  roundId: number;
  roundNo: string;
  gameType: string;
  totalOrders: number;
  changedOrders: number;
  previousPayout: number;
  nextPayout: number;
  creditTotal: number;
  debitTotal: number;
  changes: ResettleOrderChange[];
}

export interface ResettlePreview extends ResettlePlan {
  shortfallTotal: number;
  shortfallUsers: number;
}

export interface ResettleReport extends ResettlePlan {
  debitApplied: number;
  debitShortfall: number;
}

const RESETTLE_ORDER_STATUSES = [
  OrderStatus.Pending,
  OrderStatus.Won,
  OrderStatus.Lost,
];

const MONEY_EPSILON = 0.005;

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly gameConfig: GameConfigService,
    private readonly configLoader: ConfigLoaderService,
    private readonly spaWs: SpaWsService,
    private readonly oddsService: OddsService,
    @InjectRepository(GameList) private readonly gameRepo: Repository<GameList>,
    @InjectRepository(GameFeeConfig)
    private readonly feeRepo: Repository<GameFeeConfig>,
  ) {}

  async settleRound(roundId: number): Promise<SettlementReport> {
    const dataSource = this.gameEngine.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const round = await queryRunner.manager.getRepository(GameRound).findOne({
        where: { id: roundId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!round) {
        throw new Error(`Round ${roundId} not found`);
      }
      if (!round.result) {
        throw new Error(`Round ${roundId} has no draw result`);
      }
      if (round.status === 2) {
        await queryRunner.commitTransaction();
        this.logger.warn(`Round ${roundId} already settled — skipping`);
        return this.buildReport(round, 0, 0, 0, 0);
      }

      const pendingOrders = await queryRunner.manager
        .getRepository(Order)
        .find({
          where: { gameId: round.gameId, roundNo: round.roundNo, status: 0 },
        });

      if (pendingOrders.length === 0) {
        await queryRunner.manager
          .getRepository(GameRound)
          .update(roundId, { status: 2, settledAt: new Date() });
        await queryRunner.commitTransaction();

        this.logger.log(`Round ${roundId} settled: 0 orders`);
        return this.buildReport(round, 0, 0, 0, 0);
      }

      const ctx = await this.loadEvaluationContext(round);
      const game = ctx.game;
      const bigWinMin = await this.configLoader.getBigwinMinAmount();
      const bigWinTemplate = await this.configLoader.getBigwinTemplate();

      let totalPayout = 0;
      let wonCount = 0;
      let lostCount = 0;
      const wonByUser = new Map<string, number>();

      for (const order of pendingOrders) {
        const outcome = await this.settledOutcome(
          order,
          round.result as MechanicResult,
          ctx,
        );

        if (outcome.won) {
          wonCount++;
          const netWin = outcome.netWin;
          totalPayout += netWin;

          const update: QueryDeepPartialEntity<Order> = {
            status: 1,
            winAmount: netWin,
            odds: outcome.odds,
            settledAt: new Date(),
          };
          if (outcome.fixed) {
            update.betContent = {
              ...this.betContentRecord(order),
              position: outcome.prizeLevel,
              winPrice: netWin,
            };
          }
          await queryRunner.manager
            .getRepository(Order)
            .update(order.id, update);

          await this.gameEngine.creditBalance(
            order.userId,
            netWin,
            order.orderNo,
            `Win: ${round.gameType} round ${round.roundNo}`,
            queryRunner,
            false,
            { withdrawable: true },
          );

          wonByUser.set(
            order.userId,
            (wonByUser.get(order.userId) ?? 0) + netWin,
          );
        } else {
          lostCount++;

          await queryRunner.manager.getRepository(Order).update(order.id, {
            status: 2,
            winAmount: 0,
            settledAt: new Date(),
          });
        }
      }

      await queryRunner.manager.getRepository(GameRound).update(roundId, {
        status: 2,
        totalPayout,
        settledAt: new Date(),
      });

      await queryRunner.commitTransaction();

      const report = this.buildReport(
        round,
        pendingOrders.length,
        wonCount,
        lostCount,
        totalPayout,
      );
      report.bigWins = await this.buildBigWins(
        queryRunner,
        wonByUser,
        bigWinMin,
        bigWinTemplate,
        game,
        round,
      );
      if (report.bigWins.length > 0) {
        try {
          await this.spaWs.broadcastBigWin(report.bigWins);
        } catch (broadcastErr) {
          this.logger.error(
            `Big-win broadcast failed: ${broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)}`,
          );
        }
      }
      this.logger.log(
        `Round ${round.roundNo} settled: ${pendingOrders.length} orders, ` +
          `${wonCount} won, ${lostCount} lost, payout=${totalPayout}`,
      );

      return report;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Settlement failed for round ${roundId}: ${err.message}`,
        err.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async previewResettle(roundId: number): Promise<ResettlePreview> {
    const dataSource = this.gameEngine.getDataSource();
    const round = await dataSource
      .getRepository(GameRound)
      .findOne({ where: { id: roundId } });
    const resultRound = this.assertResettleable(round, roundId);
    const orders = await dataSource.getRepository(Order).find({
      where: {
        gameId: resultRound.gameId,
        roundNo: resultRound.roundNo,
        status: In(RESETTLE_ORDER_STATUSES),
      },
    });
    const plan = await this.buildResettlePlan(resultRound, orders);

    const netByUser = new Map<string, number>();
    for (const change of plan.changes) {
      netByUser.set(
        change.userId,
        round2((netByUser.get(change.userId) ?? 0) + change.delta),
      );
    }
    const debtors = [...netByUser.entries()].filter(([, net]) => net < 0);
    let shortfallTotal = 0;
    let shortfallUsers = 0;
    if (debtors.length > 0) {
      const users = await dataSource.getRepository(User).find({
        where: { userId: In(debtors.map(([userId]) => userId)) },
        select: ['userId', 'balance'],
      });
      const balanceByUser = new Map(
        users.map((u) => [u.userId, Math.max(0, Number(u.balance))]),
      );
      for (const [userId, net] of debtors) {
        const available = balanceByUser.get(userId) ?? 0;
        const short = round2(Math.max(0, -net - available));
        if (short > 0) {
          shortfallTotal = round2(shortfallTotal + short);
          shortfallUsers++;
        }
      }
    }
    return { ...plan, shortfallTotal, shortfallUsers };
  }

  async resettleRound(roundId: number): Promise<ResettleReport> {
    const dataSource = this.gameEngine.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const round = await queryRunner.manager.getRepository(GameRound).findOne({
        where: { id: roundId },
        lock: { mode: 'pessimistic_write' },
      });
      const resultRound = this.assertResettleable(round, roundId);
      const orders = await queryRunner.manager.getRepository(Order).find({
        where: {
          gameId: resultRound.gameId,
          roundNo: resultRound.roundNo,
          status: In(RESETTLE_ORDER_STATUSES),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const plan = await this.buildResettlePlan(resultRound, orders);

      const ordered = [...plan.changes].sort((a, b) => b.delta - a.delta);
      const description = `Re-settle: ${resultRound.gameType} round ${resultRound.roundNo}`;
      let debitApplied = 0;
      let debitShortfall = 0;
      const settledAt = new Date();

      for (const change of ordered) {
        const update: QueryDeepPartialEntity<Order> =
          change.nextStatus === OrderStatus.Won
            ? {
                status: change.nextStatus,
                winAmount: change.nextWin,
                odds: change.odds,
                settledAt,
              }
            : { status: change.nextStatus, winAmount: 0, settledAt };
        if (change.betContent) update.betContent = change.betContent;
        await queryRunner.manager
          .getRepository(Order)
          .update(change.orderId, update);

        if (change.delta > 0) {
          await this.gameEngine.creditBalance(
            change.userId,
            change.delta,
            change.orderNo,
            description,
            queryRunner,
            false,
            { withdrawable: true },
          );
        } else if (change.delta < 0) {
          const amount = round2(-change.delta);
          const applied = await this.reverseWin(
            queryRunner,
            change.userId,
            amount,
            change.orderNo,
            description,
          );
          debitApplied = round2(debitApplied + applied);
          debitShortfall = round2(debitShortfall + amount - applied);
        }
      }

      await queryRunner.manager.getRepository(GameRound).update(roundId, {
        status: RoundStatus.Settled,
        totalPayout: plan.nextPayout,
        settledAt,
      });
      await queryRunner.commitTransaction();

      this.logger.warn(
        `Round ${resultRound.roundNo} re-settled: ${plan.changedOrders}/${plan.totalOrders} orders changed, ` +
          `payout ${plan.previousPayout} -> ${plan.nextPayout}, credited=${plan.creditTotal}, ` +
          `debited=${debitApplied}, uncollected=${debitShortfall}`,
      );
      return { ...plan, debitApplied, debitShortfall };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private assertResettleable(
    round: GameRound | null,
    roundId: number,
  ): GameRound {
    if (!round) throw new NotFoundException(`Round ${roundId} not found`);
    if (round.status === RoundStatus.BettingOpen) {
      throw new BadRequestException(
        'Round is still open for betting — it cannot be re-settled.',
      );
    }
    if (round.status === RoundStatus.Cancelled) {
      throw new BadRequestException(
        'Round was cancelled and refunded — it cannot be re-settled.',
      );
    }
    if (!round.result) {
      throw new BadRequestException(
        'Round has no draw result yet — draw it before re-settling.',
      );
    }
    return round;
  }

  private async buildResettlePlan(
    round: GameRound,
    orders: Order[],
  ): Promise<ResettlePlan> {
    const ctx = await this.loadEvaluationContext(round);
    const changes: ResettleOrderChange[] = [];
    let previousPayout = 0;
    let nextPayout = 0;
    let creditTotal = 0;
    let debitTotal = 0;

    for (const order of orders) {
      const outcome = await this.settledOutcome(
        order,
        round.result as MechanicResult,
        ctx,
      );
      const previousStatus = order.status as OrderStatus;
      const previousWin =
        previousStatus === OrderStatus.Won
          ? round2(Number(order.winAmount))
          : 0;
      const nextStatus = outcome.won ? OrderStatus.Won : OrderStatus.Lost;
      const nextWin = outcome.won ? round2(outcome.netWin) : 0;
      previousPayout = round2(previousPayout + previousWin);
      nextPayout = round2(nextPayout + nextWin);

      const delta = round2(nextWin - previousWin);
      if (previousStatus === nextStatus && Math.abs(delta) < MONEY_EPSILON) {
        continue;
      }
      if (delta > 0) creditTotal = round2(creditTotal + delta);
      if (delta < 0) debitTotal = round2(debitTotal - delta);
      changes.push({
        orderId: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        previousStatus,
        nextStatus,
        previousWin,
        nextWin,
        delta,
        odds: outcome.odds,
        betContent: this.resettledBetContent(order, outcome, nextWin, ctx),
      });
    }

    return {
      roundId: round.id,
      roundNo: round.roundNo,
      gameType: round.gameType,
      totalOrders: orders.length,
      changedOrders: changes.length,
      previousPayout,
      nextPayout,
      creditTotal,
      debitTotal,
      changes,
    };
  }

  private async reverseWin(
    queryRunner: QueryRunner,
    userId: string,
    amount: number,
    refId: string,
    description: string,
  ): Promise<number> {
    const userRepo = queryRunner.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) return 0;

    const balance = Number(user.balance);
    const applied = round2(Math.min(amount, Math.max(0, balance)));
    const nextBalance = round2(balance - applied);
    const nextWithdrawable = round2(
      Math.max(
        0,
        Math.min(Number(user.withdrawableBalance) - applied, nextBalance),
      ),
    );
    if (applied > 0) {
      await userRepo
        .createQueryBuilder()
        .update(User)
        .set({
          balance: nextBalance,
          withdrawableBalance: nextWithdrawable,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();
    }

    const uncollected = round2(amount - applied);
    const txnRepo = queryRunner.manager.getRepository(Transaction);
    await txnRepo.save(
      txnRepo.create({
        userId,
        sourceType: TransactionType.WinReversal,
        amount: -applied,
        balance: nextBalance,
        refId,
        description:
          uncollected > 0
            ? `${description} (uncollected ${uncollected})`
            : description,
      }),
    );
    return applied;
  }

  private async loadEvaluationContext(
    round: GameRound,
  ): Promise<EvaluationContext> {
    const oddsMap = await this.gameEngine.getOddsForGame(round.gameId);
    const game = await this.gameRepo.findOne({ where: { id: round.gameId } });
    const winFee = await this.feeRepo.findOne({
      where: { gameId: round.gameId, feeType: 'win_deduction', status: 1 },
    });
    const mechanic = this.gameEngine.getMechanic(
      game ? game.gameType : round.gameType,
    );
    const cfg: GameMechanicsConfig = game
      ? await this.gameConfig.getMechanicsConfig(game)
      : { family: 'digit5' };
    const aliasMap = await this.configLoader.getOddsAliasMap();
    const missingPolicy = await this.configLoader.getOddsMissingPolicy();
    return { game, mechanic, cfg, oddsMap, aliasMap, missingPolicy, winFee };
  }

  private async settledOutcome(
    order: Order,
    result: MechanicResult,
    ctx: EvaluationContext,
  ): Promise<SettledOutcome> {
    const evaluation = await this.evaluateOrder(
      order,
      result,
      ctx.mechanic,
      ctx.cfg,
      ctx.oddsMap,
      ctx.aliasMap,
      ctx.missingPolicy,
    );
    const netWin = evaluation.fixed
      ? evaluation.winAmount
      : this.applyWinFee(evaluation.winAmount, ctx.winFee);
    return {
      won: evaluation.won,
      netWin,
      odds: evaluation.odds,
      fixed: evaluation.fixed === true,
      prizeLevel: evaluation.prizeLevel,
    };
  }

  private betContentRecord(order: Order): BetContentRecord {
    return order.betContent &&
      typeof order.betContent === 'object' &&
      !Array.isArray(order.betContent)
      ? (order.betContent as BetContentRecord)
      : {};
  }

  private resettledBetContent(
    order: Order,
    outcome: SettledOutcome,
    nextWin: number,
    ctx: EvaluationContext,
  ): BetContentRecord | undefined {
    const content = this.betContentRecord(order);
    if (outcome.won && outcome.fixed) {
      return { ...content, position: outcome.prizeLevel, winPrice: nextWin };
    }
    if (outcome.won || content.position === order.betType) return undefined;
    const product = (ctx.cfg.slatProducts ?? []).find(
      (p) => p.id === Number(content.slatProductId),
    );
    if (!product) return undefined;
    return {
      ...content,
      position: order.betType,
      winPrice: this.slatPlacementWinPrice(product, order.betType),
    };
  }

  private slatPlacementWinPrice(
    product: SlatProductView,
    label: string,
  ): number {
    if (product.matchMode === SlatMatchMode.Group) {
      const tier = product.tiers.find((t) => t.label === label);
      return tier ? Number(tier.winAmount) : 0;
    }
    const top = [...product.tiers].sort((a, b) => b.tierRank - a.tierRank)[0];
    return top ? Number(top.winAmount) : 0;
  }

  private async evaluateOrder(
    order: Order,
    result: MechanicResult,
    mechanic: GameMechanic | undefined,
    cfg: GameMechanicsConfig,
    oddsMap: Record<string, number>,
    aliasMap: Record<string, string>,
    missingPolicy: string,
  ): Promise<EvaluationResult> {
    if (!mechanic) {
      this.logger.warn(
        `No mechanic for order ${order.orderNo} (gameType=${order.gameType}); marked lost`,
      );
      return { won: false, winAmount: 0, odds: Number(order.odds) };
    }

    const outcome = mechanic.evaluate({
      betType: order.betType || '',
      betContent: (order.betContent as MechanicBetContent) || {},
      result,
      cfg,
    });

    if (!outcome.won) {
      return {
        won: false,
        winAmount: 0,
        odds: Number(order.odds),
        prizeLevel: outcome.prizeLevel,
      };
    }

    if (outcome.fixedWin !== undefined) {
      const winAmount = round2(
        outcome.fixedWin * (Number(order.quantity) || 1),
      );
      return {
        won: winAmount > 0,
        winAmount,
        odds: 0,
        prizeLevel: outcome.prizeLevel,
        fixed: true,
      };
    }

    const betCode = betCodeOf(
      order.betContent as MechanicBetContent,
      order.betType || '',
    );
    const resolution = this.oddsService.resolve({
      oddsMap,
      betCode,
      oddsKey: outcome.oddsKey,
      storedOdds: Number(order.odds),
      aliasMap,
      missingPolicy: missingPolicy as MissingOddsPolicy,
    });
    const odds = resolution.odds;
    if (resolution.source === 'missing') {
      this.logger.warn(
        `Odds unresolved for order ${order.orderNo} (betCode='${betCode}', oddsKey='${outcome.oddsKey ?? ''}', prizeLevel='${outcome.prizeLevel ?? ''}') — winAmount may be 0`,
      );
    }

    const winAmount = Number((Number(order.totalAmount) * odds).toFixed(2));
    return { won: true, winAmount, odds, prizeLevel: outcome.prizeLevel };
  }

  private applyWinFee(grossWin: number, fee: GameFeeConfig | null): number {
    if (!fee) return grossWin;
    return computeNetWin(grossWin, Number(fee.feeRate), Number(fee.fixedFee));
  }

  private buildReport(
    round: GameRound,
    totalOrders: number,
    wonOrders: number,
    lostOrders: number,
    totalPayout: number,
  ): SettlementReport {
    return {
      roundId: round.id,
      roundNo: round.roundNo,
      gameType: round.gameType,
      totalOrders,
      wonOrders,
      lostOrders,
      totalBet: Number(round.totalBet),
      totalPayout,
      settledAt: new Date(),
      bigWins: [],
    };
  }

  private async buildBigWins(
    queryRunner: QueryRunner,
    wonByUser: Map<string, number>,
    minAmount: number,
    template: string,
    game: GameList | null,
    round: GameRound,
  ): Promise<string[]> {
    const qualifiers = [...wonByUser.entries()].filter(
      ([, amount]) => amount >= minAmount,
    );
    if (qualifiers.length === 0) return [];

    const userIds = qualifiers.map(([userId]) => userId);
    const users = await queryRunner.manager.getRepository(User).find({
      where: { userId: In(userIds) },
      select: ['userId', 'nickname', 'phone'],
    });
    const userMap = new Map(users.map((u) => [u.userId, u]));
    const gameName = game ? game.gameName : round.gameType;

    return qualifiers.map(([userId, amount]) => {
      const display = this.maskPlayer(userMap.get(userId));
      return template
        .replace(/\{user\}/g, display)
        .replace(/\{amount\}/g, Math.round(amount).toLocaleString('en-IN'))
        .replace(/\{game\}/g, gameName);
    });
  }

  private maskPlayer(user?: { nickname?: string; phone?: string }): string {
    const nick = user?.nickname?.trim();
    if (nick) {
      return nick.length <= 2
        ? nick
        : `${nick.slice(0, 1)}***${nick.slice(-1)}`;
    }
    const phone = user?.phone?.trim();
    if (phone && phone.length >= 4) {
      return `${phone.slice(0, 2)}****${phone.slice(-2)}`;
    }
    return 'A lucky player';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
