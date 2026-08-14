import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In, IsNull, Not } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Order } from '../../entities/order.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { Transaction } from '../../entities/transaction.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { PaymentService } from '../payment/payment.service';
import { WebhookStatus } from '../payment/gateways/payment-gateway.interface';
import {
  RechargeStatus,
  PaymentGatewayMode,
  PaymentGatewayCode,
  CronJobName,
} from '../../common/enums';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { resolveVipLevel } from './vip-level.util';
import { CronRunRecorderService } from '../cron/cron-run-recorder.service';

@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(VipConfig) private vipRepo: Repository<VipConfig>,
    @InjectRepository(RebateRecord)
    private rebateRepo: Repository<RebateRecord>,
    @InjectRepository(CommissionConfig)
    private commConfigRepo: Repository<CommissionConfig>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
    private dataSource: DataSource,
    private paymentService: PaymentService,
    private recorder: CronRunRecorderService,
  ) {}

  @Cron('30 */5 * * * *', { name: CronJobName.RechargeReconcile })
  async reconcilePendingRecharges() {
    await this.recorder.run(CronJobName.RechargeReconcile, () =>
      this.reconcilePendingRechargesImpl(),
    );
  }

  private async reconcilePendingRechargesImpl() {
    const now = Date.now();
    const minAgeMs = 8 * 60 * 1000;
    const abandonMs = 24 * 60 * 60 * 1000;
    const lookbackMs = 3 * 24 * 60 * 60 * 1000;

    const pending = await this.rcRepo.find({
      where: {
        status: RechargeStatus.Pending,
        channelId: Not(IsNull()),
        createdAt: Between(
          new Date(now - lookbackMs),
          new Date(now - minAgeMs),
        ),
      },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    if (pending.length === 0) return;

    const channelIds = [
      ...new Set(pending.map((r) => r.channelId).filter(Boolean)),
    ];
    const gateways = channelIds.length
      ? await this.gatewayRepo.find({ where: { id: In(channelIds) } })
      : [];
    const gatewayById = new Map(gateways.map((g) => [g.id, g]));

    let credited = 0;
    let failed = 0;
    let abandoned = 0;
    let skipped = 0;

    for (const record of pending) {
      const gateway = gatewayById.get(record.channelId);
      if (
        !gateway ||
        gateway.mode === PaymentGatewayMode.Manual ||
        gateway.providerCode === PaymentGatewayCode.Manual
      ) {
        skipped++;
        continue;
      }

      const ageMs = now - new Date(record.createdAt).getTime();
      try {
        const result = await this.paymentService.verifyPaymentOrder(
          record.orderNo,
          record.userId,
          gateway,
        );

        if (result.status === WebhookStatus.Success) {
          await this.paymentService.processWebhookResult(result);
          credited++;
        } else if (result.status === WebhookStatus.Failed) {
          await this.paymentService.processWebhookResult(result);
          failed++;
        } else if (ageMs >= abandonMs) {
          await this.paymentService.processWebhookResult({
            ...result,
            status: WebhookStatus.Failed,
            reason:
              result.reason === ''
                ? 'Abandoned: payment not completed within 24h'
                : `Abandoned after 24h: ${result.reason}`,
          });
          abandoned++;
        } else {
          skipped++;
        }
      } catch (error) {
        skipped++;
        this.logger.warn(
          `Reconcile skipped order ${record.orderNo}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Recharge reconcile: ${credited} credited, ${failed} failed, ${abandoned} abandoned, ${skipped} skipped (${pending.length} scanned)`,
    );
  }

  @Cron('0 5 0 * * *', { name: CronJobName.DailyRebate })
  async calculateDailyRebate() {
    await this.recorder.run(CronJobName.DailyRebate, () =>
      this.calculateDailyRebateImpl(),
    );
  }

  private async calculateDailyRebateImpl() {
    this.logger.log('Starting daily rebate calculation...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toISOString().slice(0, 10);

    const yesterdayStart = new Date(dateKey + 'T00:00:00');
    const yesterdayEnd = new Date(dateKey + 'T23:59:59');

    try {
      const betTotals = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'userId')
        .addSelect('o.game_type', 'gameType')
        .addSelect('SUM(o.total_amount)', 'totalBet')
        .where('o.created_at >= :start AND o.created_at <= :end', {
          start: yesterdayStart,
          end: yesterdayEnd,
        })
        .groupBy('o.user_id')
        .addGroupBy('o.game_type')
        .getRawMany();

      if (betTotals.length === 0) {
        this.logger.log('No bets found for yesterday — skipping rebate');
        return;
      }

      const userIds = [...new Set(betTotals.map((bt) => bt.userId))];
      const users = await this.userRepo
        .createQueryBuilder('u')
        .where('u.user_id IN (:...ids)', { ids: userIds })
        .getMany();
      const userMap = new Map(users.map((u) => [u.userId, u]));

      const vipConfigs = await this.vipRepo.find({
        where: { status: 1 },
        order: { level: 'ASC' },
      });
      const vipRateMap = new Map(
        vipConfigs.map((v) => [v.level, Number(v.rebateRate)]),
      );

      let insertedCount = 0;

      for (const row of betTotals) {
        const user = userMap.get(row.userId);
        if (!user) continue;

        const rebateRate = vipRateMap.get(user.vipLevel);
        if (rebateRate === undefined || rebateRate <= 0) continue;

        const betAmount = Number(row.totalBet);
        const rebateAmount = Number((betAmount * rebateRate).toFixed(2));
        if (rebateAmount <= 0) continue;

        const existing = await this.rebateRepo.findOne({
          where: { userId: row.userId, dateKey, gameType: row.gameType },
        });
        if (existing) continue;

        await this.rebateRepo.save(
          this.rebateRepo.create({
            userId: row.userId,
            dateKey,
            gameType: row.gameType,
            betAmount,
            rebateRate,
            rebateAmount,
            status: 0,
          }),
        );
        insertedCount++;
      }

      this.logger.log(
        `Daily rebate complete: ${insertedCount} records created for ${dateKey}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Daily rebate failed: ${err.message}`, err.stack);
    }
  }

  @Cron('0 10 0 * * *', { name: CronJobName.VipLevelUpdate })
  async updateVipLevels() {
    await this.recorder.run(CronJobName.VipLevelUpdate, () =>
      this.updateVipLevelsImpl(),
    );
  }

  private async updateVipLevelsImpl() {
    this.logger.log('Starting VIP level update...');

    try {
      const vipConfigs = await this.vipRepo.find({
        where: { status: 1 },
        order: { level: 'DESC' },
      });

      if (vipConfigs.length === 0) return;

      const rechargeRows = await this.txnRepo
        .createQueryBuilder('t')
        .select('t.user_id', 'userId')
        .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
        .where('t.source_type = :type', { type: 'recharge' })
        .groupBy('t.user_id')
        .getRawMany<{ userId: string; total: string }>();
      const rechargeMap = new Map<string, number>(
        rechargeRows.map((r) => [r.userId, Number(r.total)]),
      );

      const betRows = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'userId')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'total')
        .where('o.status NOT IN (:...excluded)', {
          excluded: [OrderStatus.Cancelled, OrderStatus.Refunded],
        })
        .groupBy('o.user_id')
        .getRawMany<{ userId: string; total: string }>();
      const betMap = new Map<string, number>(
        betRows.map((r) => [r.userId, Number(r.total)]),
      );

      const users = await this.userRepo.find({
        where: { status: 1 },
        select: ['userId', 'vipLevel'],
      });
      let updatedCount = 0;

      for (const user of users) {
        const userRecharge = rechargeMap.get(user.userId);
        const userBet = betMap.get(user.userId);
        const newLevel = resolveVipLevel(
          vipConfigs,
          userRecharge === undefined ? 0 : userRecharge,
          userBet === undefined ? 0 : userBet,
        );
        if (newLevel > user.vipLevel) {
          await this.userRepo.update(
            { userId: user.userId },
            { vipLevel: newLevel },
          );
          updatedCount++;
          this.logger.log(
            `User ${user.userId} VIP upgraded: ${user.vipLevel} -> ${newLevel}`,
          );
        }
      }

      this.logger.log(`VIP update complete: ${updatedCount} users upgraded`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`VIP level update failed: ${err.message}`, err.stack);
    }
  }

  @Cron('0 15 0 * * *', { name: CronJobName.DailyCommission })
  async settleDailyCommission() {
    await this.recorder.run(CronJobName.DailyCommission, () =>
      this.settleDailyCommissionImpl(),
    );
  }

  private async settleDailyCommissionImpl() {
    this.logger.log('Starting daily commission settlement...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toISOString().slice(0, 10);
    const yesterdayStart = new Date(dateKey + 'T00:00:00');
    const yesterdayEnd = new Date(dateKey + 'T23:59:59');

    try {
      const commConfigs = await this.commConfigRepo.find({
        where: { status: 1 },
      });
      if (commConfigs.length === 0) {
        this.logger.log('No commission config found — skipping');
        return;
      }

      const defaultRates = new Map<number, number>();
      const gameRates = new Map<string, number>();
      for (const cfg of commConfigs) {
        if (cfg.gameType) {
          gameRates.set(`${cfg.level}_${cfg.gameType}`, Number(cfg.rate));
        } else {
          defaultRates.set(cfg.level, Number(cfg.rate));
        }
      }

      const betTotals = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'userId')
        .addSelect('o.game_type', 'gameType')
        .addSelect('SUM(o.total_amount)', 'totalBet')
        .where('o.created_at >= :start AND o.created_at <= :end', {
          start: yesterdayStart,
          end: yesterdayEnd,
        })
        .groupBy('o.user_id')
        .addGroupBy('o.game_type')
        .getRawMany();

      if (betTotals.length === 0) {
        this.logger.log('No bets for commission — skipping');
        return;
      }

      let commissionCount = 0;

      for (const row of betTotals) {
        const betAmount = Number(row.totalBet);
        if (betAmount <= 0) continue;

        const bettingUser = await this.userRepo.findOne({
          where: { userId: row.userId },
        });
        if (!bettingUser?.invitedBy) continue;

        const l1User = await this.userRepo.findOne({
          where: { inviteCode: bettingUser.invitedBy },
        });
        if (l1User) {
          const l1Key = `1_${row.gameType}`;
          const l1Rate = gameRates.has(l1Key)
            ? gameRates.get(l1Key)
            : defaultRates.get(1);
          const rate = l1Rate === undefined ? 0 : l1Rate;
          if (rate > 0) {
            await this.creditCommission(
              l1User.userId,
              betAmount,
              rate,
              row.userId,
              dateKey,
              1,
            );
            commissionCount++;
          }

          if (l1User.invitedBy) {
            const l2User = await this.userRepo.findOne({
              where: { inviteCode: l1User.invitedBy },
            });
            if (l2User) {
              const l2Key = `2_${row.gameType}`;
              const l2Rate = gameRates.has(l2Key)
                ? gameRates.get(l2Key)
                : defaultRates.get(2);
              const rate2 = l2Rate === undefined ? 0 : l2Rate;
              if (rate2 > 0) {
                await this.creditCommission(
                  l2User.userId,
                  betAmount,
                  rate2,
                  row.userId,
                  dateKey,
                  2,
                );
                commissionCount++;
              }

              if (l2User.invitedBy) {
                const l3User = await this.userRepo.findOne({
                  where: { inviteCode: l2User.invitedBy },
                });
                if (l3User) {
                  const l3Key = `3_${row.gameType}`;
                  const l3Rate = gameRates.has(l3Key)
                    ? gameRates.get(l3Key)
                    : defaultRates.get(3);
                  const rate3 = l3Rate === undefined ? 0 : l3Rate;
                  if (rate3 > 0) {
                    await this.creditCommission(
                      l3User.userId,
                      betAmount,
                      rate3,
                      row.userId,
                      dateKey,
                      3,
                    );
                    commissionCount++;
                  }
                }
              }
            }
          }
        }
      }

      this.logger.log(
        `Commission settlement complete: ${commissionCount} records for ${dateKey}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Commission settlement failed: ${err.message}`,
        err.stack,
      );
    }
  }

  private async creditCommission(
    agentUserId: string,
    betAmount: number,
    rate: number,
    fromUserId: string,
    dateKey: string,
    level: number,
  ): Promise<void> {
    const amount = Number((betAmount * rate).toFixed(2));
    if (amount <= 0) return;

    const refId = `comm_L${level}_${fromUserId}_${dateKey}`;

    const existing = await this.txnRepo.findOne({
      where: { userId: agentUserId, refId },
    });
    if (existing) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${amount}`,
          withdrawableBalance: () => `withdrawable_balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId: agentUserId })
        .execute();

      const user = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId: agentUserId } });
      if (!user) {
        throw new Error(
          `Agent ${agentUserId} not found after commission credit`,
        );
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId: agentUserId,
          sourceType: 'commission',
          amount,
          balance: Number(user.balance),
          refId,
          description: `L${level} commission from ${fromUserId} (${dateKey})`,
        }),
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Commission credit failed for ${agentUserId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
