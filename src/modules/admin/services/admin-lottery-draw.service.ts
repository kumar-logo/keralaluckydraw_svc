import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { Message } from '../../../entities/message.entity';
import {
  GameEngineService,
  DrawResult,
} from '../../game/shared/game-engine.service';
import { SettlementService } from '../../game/shared/settlement.service';
import { DrawAnalysisService } from '../../game/shared/draw-analysis.service';
import { ResultEngineService } from '../../game/shared/result-engine.service';
import { ResultMode } from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminLotteryDrawService {
  constructor(
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private gameEngine: GameEngineService,
    private settlement: SettlementService,
    private drawAnalysis: DrawAnalysisService,
    private resultEngine: ResultEngineService,
    private dataSource: DataSource,
    private audit: AdminAuditService,
  ) {}

  async triggerDraw(roundId: number, adminId: number) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      throw new BadRequestException('Round already settled');

    if (round.status === 0) {
      await this.gameEngine.closeBetting(round.id);
    }

    if (!round.result) {
      const decision = await this.resultEngine.decideForRound(round.id);
      await this.resultEngine.recordDecision(
        round.id,
        round.gameId,
        round.gameType,
        decision,
        `admin_${adminId}`,
      );
      await this.gameEngine.setDrawResult(
        round.id,
        decision.result,
        `admin_${adminId}`,
      );
    }

    const report = await this.settlement.settleRound(round.id);
    await this.audit.createAuditLog(
      adminId,
      'trigger_draw',
      'game_round',
      String(roundId),
      { report },
    );
    return report;
  }

  async setDrawResult(roundId: number, result: DrawResult, adminId: number) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      throw new BadRequestException('Round already settled');

    if (round.status === 0) {
      await this.gameEngine.closeBetting(round.id);
    }

    await this.gameEngine.setDrawResult(round.id, result, `admin_${adminId}`);
    await this.audit.createAuditLog(
      adminId,
      'set_draw_result',
      'game_round',
      String(roundId),
      { result },
    );

    return this.settlement.settleRound(round.id);
  }

  async cancelRound(roundId: number, adminId: number) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      throw new BadRequestException('Cannot cancel settled round');

    const pendingOrders = await this.orderRepo.find({
      where: { gameId: round.gameId, roundNo: round.roundNo, status: 0 },
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const order of pendingOrders) {
        const balanceField = order.isBonus ? 'bonus_balance' : 'balance';
        await queryRunner.manager
          .getRepository(User)
          .createQueryBuilder()
          .update(User)
          .set({
            [order.isBonus ? 'bonusBalance' : 'balance']: () =>
              `${balanceField} + ${order.totalAmount}`,
            version: () => 'version + 1',
          })
          .where('user_id = :userId', { userId: order.userId })
          .execute();

        await queryRunner.manager
          .getRepository(Order)
          .update(order.id, { status: 3, settledAt: new Date() });

        const user = await queryRunner.manager
          .getRepository(User)
          .findOne({ where: { userId: order.userId } });
        if (!user) {
          throw new NotFoundException(
            `User ${order.userId} not found during refund`,
          );
        }
        await queryRunner.manager.getRepository(Transaction).save(
          queryRunner.manager.getRepository(Transaction).create({
            userId: order.userId,
            sourceType: 'refund',
            amount: Number(order.totalAmount),
            balance: Number(user.balance),
            refId: order.orderNo,
            description: `Refund: round ${round.roundNo} cancelled`,
          }),
        );
      }

      await queryRunner.manager
        .getRepository(GameRound)
        .update(roundId, { status: 3, settledAt: new Date() });
      await queryRunner.commitTransaction();

      await this.audit.createAuditLog(
        adminId,
        'cancel_round',
        'game_round',
        String(roundId),
        { refundedOrders: pendingOrders.length },
      );
      return { refundedOrders: pendingOrders.length };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async retrySettlement(roundId: number, adminId: number) {
    const report = await this.settlement.resettleRound(roundId);
    await this.audit.createAuditLog(
      adminId,
      'retry_settlement',
      'game_round',
      String(roundId),
      { report },
    );
    return report;
  }


  async getDrawAnalysis(roundId: number) {
    return this.drawAnalysis.analyzeRound(roundId);
  }

  async previewDrawResult(roundId: number, proposedResult: DrawResult) {
    return this.drawAnalysis.previewResult(roundId, proposedResult);
  }

  async getDrawRecommendations(roundId: number) {
    return this.drawAnalysis.recommendResult(roundId);
  }

  async getResultDecisions(dto: {
    gameId?: number;
    mode?: string;
    pageNo?: number;
    pageSize?: number;
  }) {
    return this.resultEngine.listDecisions(dto);
  }

  async confirmDrawResult(
    roundId: number,
    drawResult: DrawResult,
    adminId: number,
  ) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      return {
        success: true,
        roundNo: round.roundNo,
        totalBet: Number(round.totalBet),
        totalPayout: Number(round.totalPayout),
        profitLoss: Number(
          (Number(round.totalBet) - Number(round.totalPayout)).toFixed(2),
        ),
        winnersNotified: 0,
        alreadySettled: true,
      };

    await this.gameEngine.setDrawResult(roundId, drawResult, String(adminId));
    await this.settlement.settleRound(roundId);
    const notified = await this.notifyWinners(round);
    await this.audit.createAuditLog(
      adminId,
      'confirm_draw_result',
      'game_round',
      String(roundId),
      { result: drawResult },
    );

    const settled = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!settled) {
      throw new NotFoundException('Round not found after settlement');
    }
    return {
      success: true,
      roundNo: settled.roundNo,
      totalBet: Number(settled.totalBet),
      totalPayout: Number(settled.totalPayout),
      profitLoss: Number(
        (Number(settled.totalBet) - Number(settled.totalPayout)).toFixed(2),
      ),
      winnersNotified: notified,
    };
  }

  async proposeDrawResult(
    roundId: number,
    adminId: number,
    body?: { result?: DrawResult; mode?: string },
  ) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      throw new BadRequestException('Round already settled');

    let proposed = body?.result;
    let mode = body && body.mode ? body.mode : ResultMode.Manual;
    if (!proposed) {
      const decision = await this.resultEngine.decideForRound(roundId);
      proposed = decision.result;
      mode = decision.mode;
      await this.resultEngine.recordDecision(
        roundId,
        round.gameId,
        round.gameType,
        decision,
        `admin_${adminId}`,
      );
    }

    await this.roundRepo.update(roundId, {
      proposedResult: proposed,
      proposedBy: `admin_${adminId}`,
      resultStatus: 'proposed',
      resultMode: mode,
    });
    await this.audit.createAuditLog(
      adminId,
      'propose_draw_result',
      'game_round',
      String(roundId),
      { mode },
    );
    return { success: true, roundId, proposedResult: proposed, mode };
  }

  async approveDrawResult(
    roundId: number,
    adminId: number,
    overrideResult?: DrawResult,
  ) {
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status === 2)
      return {
        success: true,
        report: null,
        winnersNotified: 0,
        alreadySettled: true,
      };

    const result: DrawResult | null =
      overrideResult !== undefined && overrideResult !== null
        ? overrideResult
        : (round.proposedResult as DrawResult | null);
    if (!result)
      throw new BadRequestException(
        'No proposed result to approve — supply a result to override',
      );

    if (round.status === 0) {
      await this.gameEngine.closeBetting(round.id);
    }

    await this.gameEngine.setDrawResult(roundId, result, `admin_${adminId}`);
    await this.roundRepo.update(roundId, {
      approvedBy: `admin_${adminId}`,
      approvedAt: new Date(),
      resultStatus: 'approved',
    });
    const report = await this.settlement.settleRound(roundId);
    const notified = await this.notifyWinners(round);
    await this.audit.createAuditLog(
      adminId,
      'approve_draw_result',
      'game_round',
      String(roundId),
      {
        override: !!overrideResult,
        report,
      },
    );
    return { success: true, report, winnersNotified: notified };
  }

  private async notifyWinners(round: GameRound): Promise<number> {
    try {
      const winners = await this.orderRepo.find({
        where: { gameId: round.gameId, roundNo: round.roundNo, status: 1 },
      });
      const game = await this.gameRepo.findOne({ where: { id: round.gameId } });
      const label = game && game.gameName ? game.gameName : round.gameType;
      const rows = winners
        .filter((o) => Number(o.winAmount) > 0)
        .map((o) =>
          this.messageRepo.create({
            userId: o.userId,
            title: 'Congratulations — you won!',
            content: `Your bet on ${label} round ${round.roundNo} won ₹${Number(o.winAmount).toFixed(2)}. The amount has been credited to your balance.`,
            msgType: 'win',
          }),
        );
      if (rows.length) await this.messageRepo.save(rows);
      return rows.length;
    } catch {
      return 0;
    }
  }
}
