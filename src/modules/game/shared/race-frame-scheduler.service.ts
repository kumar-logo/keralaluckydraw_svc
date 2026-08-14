import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEngineService } from './game-engine.service';
import { ResultEngineService } from './result-engine.service';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { RaceRunnerFrame } from '../../../entities/race-runner-frame.entity';
import { generateRaceFrames } from './draw-generators/race.generator';
import { DrawResult } from './mechanics/mechanic.types';

@Injectable()
export class RaceFrameSchedulerService {
  private readonly logger = new Logger(RaceFrameSchedulerService.name);

  constructor(
    private readonly gameEngine: GameEngineService,
    private readonly resultEngine: ResultEngineService,
    @InjectRepository(RaceRunnerFrame)
    private readonly raceFrameRepo: Repository<RaceRunnerFrame>,
  ) {}

  async predecideRaceResult(game: GameList, round: GameRound): Promise<void> {
    try {
      const decision = await this.resultEngine.decideForRound(round.id);
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
      await this.storeRaceFrames(game.id, round.roundNo, decision.result);
      this.logger.log(
        `Race result pre-decided at betting close: round=${round.roundNo} top3=${decision.result?.top3}`,
      );
    } catch (err) {
      this.logger.error(
        `Race pre-decide failed for round ${round.roundNo}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async storeRaceFrames(
    gameId: number,
    roundNo: string,
    result: DrawResult,
  ): Promise<void> {
    try {
      const positions = result.positions;
      if (!positions) return;

      const frames = generateRaceFrames(positions);

      const existing = await this.raceFrameRepo.findOne({
        where: { gameId, roundNo },
      });

      if (!existing) {
        await this.raceFrameRepo.save(
          this.raceFrameRepo.create({ gameId, roundNo, frames }),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to store race frames for round ${roundNo}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
