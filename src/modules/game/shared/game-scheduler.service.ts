import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { GameEngineService } from './game-engine.service';
import { RoundProgressionService } from './round-progression.service';
import { ConfigLoaderService } from '../../config/config-loader.service';
import { GameList } from '../../../entities/game-list.entity';

@Injectable()
export class GameSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(GameSchedulerService.name);

  private processingGames = new Set<number>();

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly roundProgression: RoundProgressionService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async onModuleInit() {
    let tickMs = 1000;
    try {
      const configured = await this.configLoader.getSchedulerTickMs();
      if (Number.isFinite(configured) && configured >= 250) {
        tickMs = configured;
      } else {
        this.logger.warn(
          `Invalid schedulerTickMs (${configured}); falling back to ${tickMs}ms`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to read schedulerTickMs; falling back to ${tickMs}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const interval = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.error(`Scheduler tick failed: ${err.message}`),
      );
    }, tickMs);
    this.schedulerRegistry.addInterval('game-scheduler-tick', interval);
    this.logger.log(`Game scheduler initialised — tick every ${tickMs}ms`);

    this.tick().catch((err) =>
      this.logger.error(`Initial scheduler catch-up failed: ${err.message}`),
    );
  }

  async tick() {
    let games: GameList[];
    try {
      games = await this.gameEngine.getActiveGames();
    } catch (err) {
      this.logger.error(
        `Failed to load active games: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    for (const game of games) {
      if (this.processingGames.has(game.id)) continue;

      this.processingGames.add(game.id);
      this.roundProgression
        .processGame(game)
        .catch((err) =>
          this.logger.error(
            `Error processing game ${game.id} (${game.gameType}): ${err.message}`,
            err.stack,
          ),
        )
        .finally(() => this.processingGames.delete(game.id));
    }
  }
}
