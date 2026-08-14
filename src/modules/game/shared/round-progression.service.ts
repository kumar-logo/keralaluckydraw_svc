import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEngineService, GameConfig } from './game-engine.service';
import { SettlementService, SettlementReport } from './settlement.service';
import { ResultEngineService } from './result-engine.service';
import { RaceFrameSchedulerService } from './race-frame-scheduler.service';
import { WsGateway } from '../../websocket/ws.gateway';
import { GameInfoCacheStore } from '../../../common/game-info-cache.store';
import { GameRound } from '../../../entities/game-round.entity';
import { GameList } from '../../../entities/game-list.entity';
import { TinyFlag, GameFamily } from '../../../common/enums';
import { resolveFamily } from './mechanics';

@Injectable()
export class RoundProgressionService {
  private readonly logger = new Logger(RoundProgressionService.name);

  private lastRoundCreated = new Map<number, number>();

  private static readonly MANUAL_DRAW_TYPES = new Set(['cash_rain']);

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly settlement: SettlementService,
    private readonly resultEngine: ResultEngineService,
    private readonly raceFrameScheduler: RaceFrameSchedulerService,
    private readonly wsGateway: WsGateway,
    private readonly gameInfoCache: GameInfoCacheStore,
    @InjectRepository(GameRound)
    private readonly roundRepo: Repository<GameRound>,
  ) {}

  async processGame(game: GameList): Promise<void> {
    if (game.emergencyStop === 1) return;
    if (game.isPaused === 1) return;
    if (game.source && game.source !== 'TK') return;
    if (this.isInstantGame(game)) return;

    const config = this.gameEngine.getGameConfig(game);

    if (this.isManualLottery(game)) {
      await this.processManualLottery(game, config);
      return;
    }

    if (!config.autoGenerate) return;

    const currentRound = await this.gameEngine.getCurrentRound(game.id);
    const now = Date.now();

    if (!currentRound) {
      const lastCreated = this.lastRoundCreated.get(game.id) ?? 0;
      if (now - lastCreated < 3000) return;

      await this.createNewRound(game);
      return;
    }

    if (RoundProgressionService.MANUAL_DRAW_TYPES.has(game.gameType)) return;

    if (currentRound.status === 0) {
      const stopBetTs = currentRound.stopBetTime
        ? new Date(currentRound.stopBetTime).getTime()
        : new Date(currentRound.drawTime).getTime() -
          config.stopBetBefore * 1000;

      if (now >= stopBetTs) {
        await this.gameEngine.closeBetting(currentRound.id);

        this.wsGateway.broadcastGameUpdate(game.id, {
          type: 'betting_closed',
          roundNo: currentRound.roundNo,
          gameId: game.id,
          gameType: game.gameType,
          status: 1,
          drawTime: currentRound.drawTime,
          stopBetTime: currentRound.stopBetTime,
          serverTime: Date.now(),
        });

        this.logger.log(
          `Betting closed: game=${game.gameType} round=${currentRound.roundNo}`,
        );

        if (
          game.gameType === 'race' &&
          !currentRound.result &&
          game.resultHoldForApproval !== 1
        ) {
          await this.raceFrameScheduler.predecideRaceResult(game, currentRound);
        }
      }
      return;
    }

    if (currentRound.status === 1) {
      const drawTs = new Date(currentRound.drawTime).getTime();
      const delayMs = config.drawDelay * 1000;

      if (now < drawTs + delayMs) return;

      await this.performDrawAndSettle(game, currentRound, config);
    }
  }

  private isInstantGame(game: GameList): boolean {
    return resolveFamily(game.gameType) === GameFamily.Custom;
  }

  private isManualLottery(game: GameList): boolean {
    return game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;
  }

  private async processManualLottery(
    game: GameList,
    config: GameConfig,
  ): Promise<void> {
    // A manual lottery owns N admin-scheduled draw-time rounds and NEVER
    // auto-regenerates (the admin adds draw times explicitly). Close betting on
    // each open round once it passes its own stop-bet time, then leave it for
    // the admin to draw.
    const openRounds = await this.gameEngine.getOpenRounds(game.id);
    const now = Date.now();

    for (const round of openRounds) {
      const stopBetTs = round.stopBetTime
        ? new Date(round.stopBetTime).getTime()
        : new Date(round.drawTime).getTime() - config.stopBetBefore * 1000;
      if (now < stopBetTs) continue;

      await this.gameEngine.closeBetting(round.id);
      this.gameInfoCache.invalidateAll();

      this.wsGateway.broadcastGameUpdate(game.id, {
        type: 'betting_closed',
        roundNo: round.roundNo,
        gameId: game.id,
        gameType: game.gameType,
        status: 1,
        drawTime: round.drawTime,
        stopBetTime: round.stopBetTime,
        serverTime: Date.now(),
      });

      this.logger.log(
        `Manual lottery betting closed: game=${game.gameType} ` +
          `round=${round.roundNo} — awaiting admin draw`,
      );
    }
  }

  private async createNewRound(game: GameList): Promise<GameRound> {
    const existing = await this.gameEngine.getCurrentRound(game.id);
    if (existing) return existing;

    const round = await this.gameEngine.createRound(game);
    this.lastRoundCreated.set(game.id, Date.now());

    // A new round just rolled in — drop any cached getGameInfo so polling
    // clients immediately see the new round/countdown, not the old one.
    this.gameInfoCache.invalidateAll();

    this.wsGateway.broadcastGameUpdate(game.id, {
      type: 'new_round',
      roundNo: round.roundNo,
      gameId: game.id,
      gameType: game.gameType,
      status: 0,
      drawTime: round.drawTime,
      stopBetTime: round.stopBetTime,
      serverTime: Date.now(),
    });

    this.logger.log(
      `New round created: game=${game.gameType} round=${round.roundNo} ` +
        `draw=${round.drawTime?.toISOString()}`,
    );

    return round;
  }

  private async performDrawAndSettle(
    game: GameList,
    round: GameRound,
    config: GameConfig,
  ): Promise<void> {
    if (round.resultStatus === 'proposed') {
      return;
    }

    if (!round.result) {
      const decision = await this.resultEngine.decideForRound(round.id);
      const holdForApproval =
        game.resultHoldForApproval === 1 || decision.mode === 'manual';

      if (holdForApproval) {
        await this.roundRepo.update(round.id, {
          proposedResult: decision.result,
          proposedBy: 'scheduler',
          resultStatus: 'proposed',
          resultMode: decision.mode,
        });
        await this.resultEngine.recordDecision(
          round.id,
          game.id,
          game.gameType,
          decision,
          'scheduler',
        );
        this.wsGateway.broadcastGameUpdate(game.id, {
          type: 'awaiting_approval',
          roundNo: round.roundNo,
          gameId: game.id,
          gameType: game.gameType,
          serverTime: Date.now(),
        });
        this.logger.log(
          `Round ${round.roundNo} proposed (mode=${decision.mode}) — awaiting admin approval`,
        );
        return;
      }

      await this.gameEngine.setDrawResult(
        round.id,
        decision.result,
        'scheduler',
        decision.mode,
      );
      await this.resultEngine.recordDecision(
        round.id,
        game.id,
        game.gameType,
        decision,
        'scheduler',
      );
      round.result = decision.result;

      this.logger.log(
        `Draw decided: game=${game.gameType} round=${round.roundNo} ` +
          `mode=${decision.mode} result=${decision.result?.drawResult} ` +
          `payout=${decision.totalPayout}/${decision.totalStake}`,
      );

      if (game.gameType === 'race') {
        await this.raceFrameScheduler.storeRaceFrames(
          game.id,
          round.roundNo,
          decision.result,
        );
      }
    }

    // The round just drew — drop cached getGameInfo so the polling fallback
    // serves the fresh result instead of the previous round's.
    this.gameInfoCache.invalidateAll();

    this.wsGateway.broadcastDrawResult(game.id, {
      roundNo: round.roundNo,
      gameId: game.id,
      gameType: game.gameType,
      result: round.result,
      serverTime: Date.now(),
    });

    try {
      const report: SettlementReport = await this.settlement.settleRound(
        round.id,
      );

      this.wsGateway.broadcastGameUpdate(game.id, {
        type: 'settlement_complete',
        roundNo: round.roundNo,
        gameId: game.id,
        gameType: game.gameType,
        status: 2,
        totalOrders: report.totalOrders,
        wonOrders: report.wonOrders,
        totalPayout: report.totalPayout,
        serverTime: Date.now(),
      });
    } catch (err) {
      const settleErr = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Settlement failed for round ${round.roundNo}: ${settleErr.message}`,
        settleErr.stack,
      );

      try {
        const dataSource = this.gameEngine.getDataSource();
        await dataSource.getRepository(GameRound).update(round.id, {
          status: 2,
          settledAt: new Date(),
        });
      } catch (markErr) {
        this.logger.error(
          `Failed to mark round ${round.roundNo} as completed: ${markErr instanceof Error ? markErr.message : String(markErr)}`,
        );
      }
    }

    if (this.isManualLottery(game)) return;

    await this.createNewRound(game);
  }
}
