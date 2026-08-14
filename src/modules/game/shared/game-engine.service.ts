import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, QueryRunner } from 'typeorm';
import {
  GAME_MECHANIC,
  GameMechanic,
  buildMechanicMap,
  resolveFamily,
} from './mechanics';
import { nextRoundNo, nextRoundNoForGame } from './round-number.util';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { GameKeralaConfig } from '../../../entities/game-kerala-config.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { TinyFlag } from '../../../common/enums/tiny-flag.enum';
export interface DrawResult {
  drawResult: string;
  [key: string]: unknown;
}

export interface GameConfig {
  roundDuration: number;
  stopBetBefore: number;
  autoGenerate: boolean;
  drawDelay: number;
  digitCount?: number;
  ticketLength?: number;
  runnerCount?: number;
  raceFrames?: number;
  prizeCounts?: {
    third?: number;
    fourth?: number;
    fifth?: number;
    consolation?: number;
  };
  minPrize?: number;
  maxPrize?: number;
  colorMap?: Record<string, string[]>;
  bigSmallThreshold?: number;
  diceCount?: number;
  [key: string]: unknown;
}

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);
  private readonly mechanicByFamily: Map<string, GameMechanic>;

  constructor(
    @InjectRepository(GameList) private gameListRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    private dataSource: DataSource,
    @Inject(GAME_MECHANIC) private readonly mechanics: GameMechanic[],
  ) {
    this.mechanicByFamily = buildMechanicMap(this.mechanics);
  }

  getMechanic(gameType: string): GameMechanic | undefined {
    return this.mechanicByFamily.get(resolveFamily(gameType));
  }

  async getActiveGames(): Promise<GameList[]> {
    return this.gameListRepo.find({ where: { status: 1 } });
  }

  async getGameById(gameId: number): Promise<GameList | null> {
    return this.gameListRepo.findOne({ where: { id: gameId, status: 1 } });
  }

  assertPlayable(game: GameList): void {
    if (game.isHidden === TinyFlag.Yes || game.emergencyStop === TinyFlag.Yes) {
      throw new BadRequestException('Game not available');
    }
  }

  assertBetWithinLimits(game: GameList, totalAmount: number): void {
    const min = Number(game.minBet);
    const max = Number(game.maxBet);
    if (min > 0 && totalAmount < min) {
      throw new BadRequestException(`Minimum bet amount is ${min}`);
    }
    if (max > 0 && totalAmount > max) {
      throw new BadRequestException(`Maximum bet amount is ${max}`);
    }
  }

  isBeforeStartDate(game: GameList): boolean {
    if (game.isLottery !== TinyFlag.Yes || game.autoGenerate !== TinyFlag.No) {
      return false;
    }
    if (!game.startDate) return false;
    return new Date(game.startDate).getTime() > Date.now();
  }

  assertLotteryStarted(game: GameList): void {
    if (this.isBeforeStartDate(game)) {
      throw new BadRequestException('This lottery has not started yet');
    }
  }

  buildNotStartedLotteryInfo(game: GameList) {
    const startMs = game.startDate
      ? new Date(game.startDate).getTime()
      : Date.now();
    const startSec = Math.floor(startMs / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      gameId: game.id,
      gameName: game.gameName,
      gameCode: game.gameCode,
      gameType: game.gameType,
      icon: game.iconUrl,
      sellingPrice: Number(game.sellingPrice),
      minBet: Number(game.minBet),
      maxBet: Number(game.maxBet),
      drawInterval: game.drawInterval,
      isQuick: game.isQuick === 1,
      isManual: true,
      notStarted: true,
      startDate: game.startDate,
      startTimeSec: startSec,
      drawNo: '',
      roundNo: '',
      drawTimeSec: startSec,
      drawTimeLong: Math.max(1, startSec - nowSec),
      stopBetSec: game.stopBetBeforeSec,
      status: -1,
      pickTimes: [] as unknown[],
      tabs: [] as unknown[],
      pickInfos: [] as unknown[],
      slatProducts: [] as unknown[],
      digitCount: game.digitCount,
      positionLabels: [] as unknown[],
      positionColors: [] as unknown[],
      positionGradients: [] as unknown[],
      payRate: [] as unknown[],
      lastRoundNo: '',
      lastResult: null,
    };
  }

  assertBettingOpen(round: GameRound): void {
    const closeMs = round.stopBetTime
      ? new Date(round.stopBetTime).getTime()
      : round.drawTime
        ? new Date(round.drawTime).getTime()
        : 0;
    if (closeMs > 0 && closeMs <= Date.now()) {
      throw new BadRequestException('Betting has closed for this round');
    }
  }

  getGameConfig(game: GameList): GameConfig {
    return {
      roundDuration: game.drawInterval,
      stopBetBefore: game.stopBetBeforeSec,
      autoGenerate: game.autoGenerate === 1,
      drawDelay: game.drawDelaySec,
      digitCount: game.digitCount,
    };
  }

  async getCurrentRound(gameId: number): Promise<GameRound | null> {
    return this.roundRepo.findOne({
      where: [
        { gameId, status: 0 },
        { gameId, status: 1 },
      ],
      order: { drawTime: 'ASC' },
    });
  }

  async getLastCompletedRound(gameId: number): Promise<GameRound | null> {
    return this.roundRepo.findOne({
      where: { gameId, status: 2 },
      order: { createdAt: 'DESC' },
    });
  }

  // All still-open (betting) rounds for a game, soonest draw first. Used by the
  // manual-lottery scheduler to close betting on each of its N draw-time rounds.
  async getOpenRounds(gameId: number): Promise<GameRound[]> {
    return this.roundRepo.find({
      where: { gameId, status: 0 },
      order: { drawTime: 'ASC' },
    });
  }

  async getManualRounds(gameId: number): Promise<GameRound[]> {
    return this.roundRepo.find({
      where: { gameId, status: In([0, 1, 2]) },
      order: { drawTime: 'ASC' },
    });
  }

  async createRound(game: GameList): Promise<GameRound> {
    const config = this.getGameConfig(game);
    const now = new Date();

    const isManualLottery =
      game.isLottery === TinyFlag.Yes && game.autoGenerate === TinyFlag.No;

    let drawTime: Date;
    if (isManualLottery && game.scheduledDrawTime) {
      drawTime = new Date(game.scheduledDrawTime);
    } else {
      if (!(config.roundDuration > 0)) {
        throw new BadRequestException('Game has no round duration configured');
      }
      const roundDurationMs = config.roundDuration * 1000;
      const previous = await this.roundRepo.findOne({
        where: { gameId: game.id },
        order: { drawTime: 'DESC' },
      });
      if (previous?.drawTime) {
        const previousDrawMs = new Date(previous.drawTime).getTime();
        let nextDrawMs = previousDrawMs + roundDurationMs;
        if (nextDrawMs <= now.getTime()) {
          const intervalsBehind = Math.ceil(
            (now.getTime() - nextDrawMs) / roundDurationMs,
          );
          nextDrawMs += intervalsBehind * roundDurationMs;
        }
        drawTime = new Date(nextDrawMs);
      } else {
        drawTime = new Date(now.getTime() + roundDurationMs);
      }
    }

    const stopBetTime = new Date(
      drawTime.getTime() - config.stopBetBefore * 1000,
    );

    const keralaChar =
      game.gameType === 'kerala'
        ? (
            await this.gameListRepo.manager.findOne(GameKeralaConfig, {
              where: { gameId: game.id },
            })
          )?.prefix1st
        : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const roundNo = await nextRoundNoForGame(
        this.roundRepo,
        drawTime,
        game,
        keralaChar,
      );
      const round = this.roundRepo.create({
        gameId: game.id,
        roundNo,
        gameType: game.gameType,
        status: 0,
        drawTime,
        stopBetTime,
      });
      try {
        return await this.roundRepo.save(round);
      } catch (error) {
        if (this.isDuplicateRoundError(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error(
      `Unable to allocate a unique round number for game ${game.id}`,
    );
  }

  private isDuplicateRoundError(error: unknown): boolean {
    const e = error as {
      code?: string;
      driverError?: { code?: string };
      message?: string;
    };
    const code = e?.code ?? e?.driverError?.code;
    return code === 'ER_DUP_ENTRY' || /duplicate entry/i.test(e?.message ?? '');
  }

  async closeBetting(roundId: number): Promise<void> {
    await this.roundRepo.update(roundId, { status: 1 });
    this.logger.log(`Betting closed for round ${roundId}`);
  }

  async setDrawResult(
    roundId: number,
    result: DrawResult,
    settledBy = 'system',
    resultMode?: string,
  ): Promise<GameRound> {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new BadRequestException('Round not found');

    const game = await this.gameListRepo.findOne({
      where: { id: round.gameId },
    });
    if (
      game &&
      (game.gameType === 'three_digit' || game.gameType === 'four_five_digit')
    ) {
      if (!game.digitCount) {
        throw new BadRequestException(
          `Game ${game.id} is missing digit_count required to validate the result`,
        );
      }
      const digitCount = Number(game.digitCount);
      const drawn = String(
        (result as { number?: unknown; drawResult?: unknown })?.number ??
          (result as { drawResult?: unknown })?.drawResult ??
          '',
      );
      if (!/^\d+$/.test(drawn) || drawn.length !== digitCount) {
        throw new BadRequestException(
          `Result must be exactly ${digitCount} digits for this game; got "${drawn}".`,
        );
      }
    }

    const isManual = settledBy !== 'system' && settledBy !== 'scheduler';

    await this.roundRepo.update(roundId, {
      result,
      manualResult: isManual ? 1 : 0,
      settledBy,
      resultStatus: isManual ? 'approved' : 'auto',
      ...(resultMode ? { resultMode } : {}),
    });

    const updated = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!updated) throw new BadRequestException('Round not found after update');
    return updated;
  }

  async deductBalance(
    userId: string,
    amount: number,
    isBonus: boolean,
    queryRunner?: QueryRunner,
  ): Promise<User> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid bet amount');
    }

    const repo = queryRunner
      ? queryRunner.manager.getRepository(User)
      : this.userRepo;
    const user = await repo.findOne({ where: { userId } });

    if (!user) throw new BadRequestException('User not found');
    if (user.status === 0) {
      throw new BadRequestException('Account disabled');
    }

    const balanceField = isBonus ? 'bonusBalance' : 'balance';
    if (Number(user[balanceField]) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const setClause = isBonus
      ? {
          bonusBalance: () => `bonus_balance - ${amount}`,
          version: () => 'version + 1',
        }
      : {
          withdrawableBalance: () =>
            `LEAST(withdrawable_balance, balance - ${amount})`,
          balance: () => `balance - ${amount}`,
          version: () => 'version + 1',
        };

    const result = await repo
      .createQueryBuilder()
      .update(User)
      .set(setClause)
      .where('user_id = :userId AND version = :version', {
        userId,
        version: user.version,
      })
      .andWhere(`${isBonus ? 'bonus_balance' : 'balance'} >= :amount`, {
        amount,
      })
      .execute();

    if (result.affected === 0) {
      throw new BadRequestException(
        'Balance update failed — concurrent modification or insufficient funds',
      );
    }

    const updatedUser = await repo.findOne({ where: { userId } });
    if (!updatedUser) {
      throw new BadRequestException('User not found after balance update');
    }
    return updatedUser;
  }

  async creditBalance(
    userId: string,
    amount: number,
    refId: string,
    description: string,
    queryRunner?: QueryRunner,
    isBonus = false,
    options?: { withdrawable?: boolean; sourceType?: string },
  ): Promise<User> {
    const userRepo = queryRunner
      ? queryRunner.manager.getRepository(User)
      : this.userRepo;
    const txnRepo = queryRunner
      ? queryRunner.manager.getRepository(Transaction)
      : this.txnRepo;

    const setClause = isBonus
      ? {
          bonusBalance: () => `bonus_balance + ${amount}`,
          version: () => 'version + 1',
        }
      : options?.withdrawable
        ? {
            balance: () => `balance + ${amount}`,
            withdrawableBalance: () => `withdrawable_balance + ${amount}`,
            version: () => 'version + 1',
          }
        : {
            balance: () => `balance + ${amount}`,
            version: () => 'version + 1',
          };

    await userRepo
      .createQueryBuilder()
      .update(User)
      .set(setClause)
      .where('user_id = :userId', { userId })
      .execute();

    const updatedUser = await userRepo.findOne({ where: { userId } });
    if (!updatedUser) {
      throw new BadRequestException('User not found after balance credit');
    }

    await txnRepo.save(
      txnRepo.create({
        userId,
        sourceType: options?.sourceType ?? (isBonus ? 'win_bonus' : 'win'),
        amount,
        balance: Number(updatedUser.balance),
        refId,
        description,
      }),
    );

    return updatedUser;
  }

  async getOddsForGame(gameId: number): Promise<Record<string, number>> {
    const configs = await this.oddsRepo.find({
      where: { gameId, status: 1 },
    });

    const oddsMap: Record<string, number> = {};
    for (const cfg of configs) {
      oddsMap[cfg.betType] = Number(cfg.odds);
    }
    return oddsMap;
  }

  async getOddsForBet(gameId: number, betType: string): Promise<number> {
    const cfg = await this.oddsRepo.findOne({
      where: { gameId, betType, status: 1 },
    });
    return cfg ? Number(cfg.odds) : 0;
  }

  async getPendingOrdersForRound(
    gameId: number,
    roundNo: string,
  ): Promise<Order[]> {
    return this.orderRepo.find({
      where: { gameId, roundNo, status: 0 },
    });
  }

  async generateRoundNo(date: Date, gameId: number): Promise<string> {
    return nextRoundNo(this.roundRepo, date, gameId);
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}
