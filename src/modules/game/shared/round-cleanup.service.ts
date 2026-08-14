import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { ResultDecision } from '../../../entities/result-decision.entity';
import { RoundStatus } from '../../../common/enums/round-status.enum';
import { CronJobName } from '../../../common/enums/cron-job-name.enum';
import { CronRunRecorderService } from '../../cron/cron-run-recorder.service';

export interface CleanupRangeInput {
  fromDate: string;
  toDate: string;
  dryRun: boolean;
  protectManual: boolean;
}

export interface CleanupRangeResult {
  dryRun: boolean;
  deletable?: number;
  deleted?: number;
  skipped: number;
  totalInRange: number;
}

enum RoundChildTable {
  RaceRunnerFrames = 'race_runner_frames',
  LotteryDrawDetails = 'lottery_draw_details',
  CashrainRecords = 'cashrain_records',
  RankRecords = 'rank_records',
  LotterySalesRollup = 'lottery_sales_rollup',
}

@Injectable()
export class RoundCleanupService {
  private readonly logger = new Logger(RoundCleanupService.name);

  private static readonly DELETE_CHUNK_SIZE = 500;

  private static readonly FINISHED_STATUSES = [
    RoundStatus.Settled,
    RoundStatus.Cancelled,
  ];

  private static readonly CHILD_TABLES_BY_ROUND_NO = [
    RoundChildTable.RaceRunnerFrames,
    RoundChildTable.LotteryDrawDetails,
    RoundChildTable.CashrainRecords,
    RoundChildTable.RankRecords,
    RoundChildTable.LotterySalesRollup,
  ];

  constructor(
    @InjectRepository(GameRound)
    private readonly gameRoundRepo: Repository<GameRound>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(ResultDecision)
    private readonly resultDecisionRepo: Repository<ResultDecision>,
    private readonly recorder: CronRunRecorderService,
  ) {}

  async cleanupRange(input: CleanupRangeInput): Promise<CleanupRangeResult> {
    const { fromDate, toDate, dryRun, protectManual } = input;
    if (!fromDate || !toDate) {
      throw new BadRequestException('fromDate and toDate are required');
    }
    const from = `${fromDate} 00:00:00`;
    const to = `${toDate} 23:59:59`;
    if (from > to) {
      throw new BadRequestException('fromDate must not be after toDate');
    }

    const ordersTable = this.orderRepo.metadata.tableName;

    const baseQuery = () => {
      const qb = this.gameRoundRepo
        .createQueryBuilder('r')
        .where('COALESCE(r.draw_time, r.created_at) BETWEEN :from AND :to', {
          from,
          to,
        })
        .andWhere('r.status IN (:...statuses)', {
          statuses: RoundCleanupService.FINISHED_STATUSES,
        })
        .andWhere('r.deletedAt IS NULL');
      if (protectManual) {
        qb.andWhere(
          '(r.status = :cancelled OR r.game_id IN (SELECT id FROM game_list WHERE auto_generate = 1))',
          { cancelled: RoundStatus.Cancelled },
        );
      }
      return qb;
    };

    const totalInRange = await baseQuery().getCount();

    const deletable = await baseQuery()
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM ${ordersTable} o WHERE o.game_id = r.game_id AND o.round_no = r.round_no)`,
      )
      .getMany();

    const skipped = totalInRange - deletable.length;

    if (dryRun) {
      return {
        dryRun: true,
        deletable: deletable.length,
        skipped,
        totalInRange,
      };
    }

    await this.deleteRoundsWithChildren(deletable);

    return {
      dryRun: false,
      deleted: deletable.length,
      skipped,
      totalInRange,
    };
  }

  private async deleteRoundsWithChildren(
    deletable: GameRound[],
  ): Promise<void> {
    const chunkSize = RoundCleanupService.DELETE_CHUNK_SIZE;
    const decisionTable = this.resultDecisionRepo.metadata.tableName;
    const roundsTable = this.gameRoundRepo.metadata.tableName;
    await this.gameRoundRepo.manager.transaction(async (manager) => {
      for (let i = 0; i < deletable.length; i += chunkSize) {
        const chunk = deletable.slice(i, i + chunkSize);
        const ids = chunk.map((r) => r.id);
        const roundNos = chunk.map((r) => r.roundNo);
        for (const table of RoundCleanupService.CHILD_TABLES_BY_ROUND_NO) {
          await manager
            .createQueryBuilder()
            .delete()
            .from(table)
            .where('round_no IN (:...roundNos)', { roundNos })
            .execute();
        }
        await manager
          .createQueryBuilder()
          .delete()
          .from(decisionTable)
          .where('round_id IN (:...ids)', { ids })
          .execute();
        await manager
          .createQueryBuilder()
          .delete()
          .from(roundsTable)
          .where('id IN (:...ids)', { ids })
          .execute();
      }
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: CronJobName.RoundCleanup })
  async cleanupYesterday(): Promise<void> {
    await this.recorder.run(CronJobName.RoundCleanup, async () => {
      const yesterday = this.resolveYesterdayDate();
      const result = await this.cleanupRange({
        fromDate: yesterday,
        toDate: yesterday,
        dryRun: false,
        protectManual: false,
      });
      this.logger.log(
        `Daily round cleanup for ${yesterday}: deleted=${result.deleted} ` +
          `skipped=${result.skipped} totalInRange=${result.totalInRange}`,
      );
    });
  }

  private resolveYesterdayDate(): string {
    const now = new Date();
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
