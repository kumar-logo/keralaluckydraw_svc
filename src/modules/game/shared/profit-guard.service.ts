import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { GamePayoutLedger } from '../../../entities/game-payout-ledger.entity';
import { GameList } from '../../../entities/game-list.entity';
import { ConfigLoaderService } from '../../config/config-loader.service';
import {
  DEFAULT_HOUSE_EDGE,
  MIN_HOUSE_EDGE,
  MAX_HOUSE_EDGE,
} from './profit-guard.constants';

@Injectable()
export class ProfitGuardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async resolveHouseEdge(game: GameList): Promise<number> {
    const perGame = Number(game.resultHouseEdgeTarget);
    if (Number.isFinite(perGame) && perGame > 0) {
      return this.clampEdge(perGame);
    }
    const fallback = await this.configLoader.getResultHouseEdgeDefault();
    if (Number.isFinite(fallback) && fallback > 0) {
      return this.clampEdge(fallback);
    }
    return DEFAULT_HOUSE_EDGE;
  }

  async applyHouseEdge(
    gameId: number,
    stake: number,
    intendedPrize: number,
    houseEdge: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const safeStake = Number.isFinite(stake) && stake > 0 ? stake : 0;
    const safePrize =
      Number.isFinite(intendedPrize) && intendedPrize > 0 ? intendedPrize : 0;
    const edge = this.clampEdge(houseEdge);

    if (queryRunner) {
      return this.applyWithinTransaction(
        queryRunner,
        gameId,
        safeStake,
        safePrize,
        edge,
      );
    }

    const owned = this.dataSource.createQueryRunner();
    await owned.connect();
    await owned.startTransaction();
    try {
      const granted = await this.applyWithinTransaction(
        owned,
        gameId,
        safeStake,
        safePrize,
        edge,
      );
      await owned.commitTransaction();
      return granted;
    } catch (error) {
      if (owned.isTransactionActive) {
        await owned.rollbackTransaction();
      }
      throw error;
    } finally {
      await owned.release();
    }
  }

  private async applyWithinTransaction(
    queryRunner: QueryRunner,
    gameId: number,
    stake: number,
    intendedPrize: number,
    edge: number,
  ): Promise<number> {
    const ledgerRepo = queryRunner.manager.getRepository(GamePayoutLedger);

    let ledger = await ledgerRepo
      .createQueryBuilder('ledger')
      .setLock('pessimistic_write')
      .where('ledger.gameId = :gameId', { gameId })
      .getOne();

    if (!ledger) {
      await ledgerRepo
        .createQueryBuilder()
        .insert()
        .into(GamePayoutLedger)
        .values({ gameId, cumulativeStake: 0, cumulativePayout: 0 })
        .orIgnore()
        .execute();
      ledger = await ledgerRepo
        .createQueryBuilder('ledger')
        .setLock('pessimistic_write')
        .where('ledger.gameId = :gameId', { gameId })
        .getOne();
    }

    if (!ledger) {
      throw new Error(
        `Payout ledger for game ${gameId} could not be loaded after insert`,
      );
    }

    const priorStake = Number(ledger.cumulativeStake);
    const priorPayout = Number(ledger.cumulativePayout);
    const nextStake = priorStake + stake;

    const allowedRoom = nextStake * (1 - edge) - priorPayout;
    const granted = Math.min(
      Math.max(0, intendedPrize),
      Math.max(0, allowedRoom),
    );
    const nextPayout = priorPayout + granted;

    await ledgerRepo.update(
      { gameId },
      { cumulativeStake: nextStake, cumulativePayout: nextPayout },
    );

    return granted;
  }

  private clampEdge(edge: number): number {
    if (!Number.isFinite(edge)) return DEFAULT_HOUSE_EDGE;
    return Math.min(MAX_HOUSE_EDGE, Math.max(MIN_HOUSE_EDGE, edge));
  }
}
