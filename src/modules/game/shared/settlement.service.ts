import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { GameEngineService } from './game-engine.service';
import { GameConfigService } from './game-config.service';
import { ConfigLoaderService } from '../../config/config-loader.service';
import { SpaWsService } from '../../websocket/spa-ws.service';
import { OddsService } from './odds.service';
import { Order } from '../../../entities/order.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { GameFeeConfig } from '../../../entities/game-fee-config.entity';
import { User } from '../../../entities/user.entity';
import {
  GameMechanic,
  MechanicBetContent,
  betCodeOf,
} from './mechanics/mechanic.types';
import { GameMechanicsConfig } from './game-config.types';
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
      const round = await queryRunner.manager
        .getRepository(GameRound)
        .findOne({
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
      const bigWinMin = await this.configLoader.getBigwinMinAmount();
      const bigWinTemplate = await this.configLoader.getBigwinTemplate();

      let totalPayout = 0;
      let wonCount = 0;
      let lostCount = 0;
      let totalBet = 0;
      const wonByUser = new Map<string, number>();

      for (const order of pendingOrders) {
        totalBet += Number(order.totalAmount);
        const evaluation = await this.evaluateOrder(
          order,
          round.result,
          mechanic,
          cfg,
          oddsMap,
          aliasMap,
          missingPolicy,
        );

        if (evaluation.won) {
          wonCount++;
          const netWin = evaluation.fixed
            ? evaluation.winAmount
            : this.applyWinFee(evaluation.winAmount, winFee);
          totalPayout += netWin;

          const update: QueryDeepPartialEntity<Order> = {
            status: 1,
            winAmount: netWin,
            odds: evaluation.odds,
            settledAt: new Date(),
          };
          if (evaluation.fixed) {
            const existingBetContent =
              order.betContent &&
              typeof order.betContent === 'object' &&
              !Array.isArray(order.betContent)
                ? (order.betContent as Record<string, unknown>)
                : {};
            update.betContent = {
              ...existingBetContent,
              position: evaluation.prizeLevel,
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

  async resettleRound(roundId: number): Promise<SettlementReport> {
    const dataSource = this.gameEngine.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const round = await queryRunner.manager
        .getRepository(GameRound)
        .findOne({ where: { id: roundId } });

      if (!round) throw new Error(`Round ${roundId} not found`);
      if (!round.result) throw new Error(`Round ${roundId} has no draw result`);

      const settledCount = await queryRunner.manager
        .getRepository(Order)
        .count({
          where: {
            gameId: round.gameId,
            roundNo: round.roundNo,
            status: In([1, 2]),
          },
        });
      if (settledCount > 0) {
        throw new BadRequestException(
          'Round already settled and winners paid — retry only applies to failed settlements.',
        );
      }

      await queryRunner.manager
        .getRepository(GameRound)
        .update(roundId, { status: 1, totalPayout: 0, settledAt: null });
    } finally {
      await queryRunner.release();
    }

    this.logger.warn(`Round ${roundId} re-opened for re-settlement (no prior payouts)`);
    return this.settleRound(roundId);
  }

  private async evaluateOrder(
    order: Order,
    result: any,
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
      missingPolicy: missingPolicy as any,
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
