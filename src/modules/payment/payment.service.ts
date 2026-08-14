import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { ConfigLoaderService } from '../config/config-loader.service';
import { RechargeStatus } from '../../common/enums';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import {
  PaymentOrder,
  WebhookResult,
  WebhookStatus,
} from './gateways/payment-gateway.interface';

export type {
  PaymentOrder,
  WebhookResult,
} from './gateways/payment-gateway.interface';

const AMOUNT_MATCH_TOLERANCE = 0.01;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
    @InjectRepository(CommissionConfig)
    private commConfigRepo: Repository<CommissionConfig>,
    private configLoader: ConfigLoaderService,
    private dataSource: DataSource,
    private readonly registry: PaymentGatewayRegistry,
  ) {}

  async createPaymentOrder(
    orderNo: string,
    amount: number,
    userId: string,
    gateway?: PaymentGateway,
  ): Promise<PaymentOrder> {
    const row = gateway === undefined ? await this.getActiveGateway() : gateway;
    if (!row) {
      throw new BadRequestException('Payment gateway not configured');
    }
    const gatewayType =
      row.gatewayType === null ? row.providerCode : row.gatewayType;
    return this.registry
      .getGateway(gatewayType)
      .createOrder(orderNo, amount, userId, row.providerCode);
  }

  async getActiveGateway(): Promise<PaymentGateway | null> {
    const code = await this.configLoader.getActivePaymentGateway();
    return this.gatewayRepo.findOne({
      where: { providerCode: code, status: 1 },
    });
  }

  async resolveOrderGateway(orderNo: string): Promise<PaymentGateway | null> {
    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (record?.channelId) {
      return this.gatewayRepo.findOne({ where: { id: record.channelId } });
    }
    return null;
  }

  async verifyPaymentOrder(
    orderNo: string,
    callerUserId: string,
    gateway: PaymentGateway,
  ): Promise<WebhookResult> {
    const gatewayType =
      gateway.gatewayType === null ? gateway.providerCode : gateway.gatewayType;
    return this.registry
      .getVerifiableGateway(gatewayType)
      .verifyPayment(orderNo, callerUserId, gateway.providerCode);
  }

  async processWebhookResult(result: WebhookResult): Promise<boolean> {
    if (result.status === WebhookStatus.Pending) {
      this.logger.log(
        `Webhook: order still pending, no action: ${result.orderNo}`,
      );
      return false;
    }

    const record = await this.rcRepo.findOne({
      where: { orderNo: result.orderNo },
    });
    if (!record) {
      this.logger.warn(`Webhook: order not found: ${result.orderNo}`);
      return false;
    }

    if (record.status !== 0) {
      this.logger.log(
        `Webhook: order already processed: ${result.orderNo} status=${record.status}`,
      );
      return true;
    }

    await this.rcRepo.update(record.id, {
      callbackData: result.rawData,
    });

    if (result.status !== WebhookStatus.Success) {
      const reason =
        result.reason === ''
          ? 'Gateway reported a failed payment'
          : result.reason;
      await this.rcRepo.update(record.id, {
        status: RechargeStatus.Rejected,
        remark: reason,
      });
      const failUser = await this.userRepo.findOne({
        where: { userId: record.userId },
      });
      if (!failUser) {
        throw new BadRequestException('User not found for failed recharge');
      }
      await this.txnRepo.save(
        this.txnRepo.create({
          userId: record.userId,
          sourceType: 'recharge_failed',
          amount: 0,
          balance: Number(failUser.balance),
          refId: result.orderNo,
          description: `Recharge failed: ${reason}`,
        }),
      );
      return false;
    }

    const expectedAmount = Number(record.amount);
    const reportedAmount = Number(result.amount);
    if (
      !Number.isFinite(reportedAmount) ||
      Math.abs(reportedAmount - expectedAmount) >= AMOUNT_MATCH_TOLERANCE
    ) {
      this.logger.error(
        `Webhook: amount mismatch for order ${result.orderNo}: expected=${expectedAmount} reported=${result.amount}`,
      );
      throw new BadRequestException('Webhook amount does not match order');
    }

    if (record.channelId) {
      const gateway = await this.gatewayRepo.findOne({
        where: { id: record.channelId },
      });
      if (gateway && Number(gateway.additionalVerification) === 1) {
        this.logger.log(
          `Webhook: order ${result.orderNo} held for manual review (gateway ${gateway.providerCode} additional_verification=1); not crediting`,
        );
        return false;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const flipResult = await queryRunner.manager
        .getRepository(RechargeRecord)
        .update(
          { id: record.id, status: 0 },
          {
            status: 1,
            actualAmount: reportedAmount,
            approvedAt: new Date(),
          },
        );

      if (flipResult.affected !== 1) {
        await queryRunner.commitTransaction();
        this.logger.log(
          `Webhook: order already processed concurrently: ${result.orderNo}`,
        );
        return true;
      }

      const requestedAmount = Number(record.amount);
      const rawBonus = Number(record.bonusAmount);
      const bonusAmount =
        requestedAmount > 0 && reportedAmount < requestedAmount
          ? Number(((rawBonus * reportedAmount) / requestedAmount).toFixed(2))
          : rawBonus;
      const creditAmount = reportedAmount + bonusAmount;

      if (
        result.paymentRef !== undefined &&
        result.paymentRef !== '' &&
        (record.paymentRef === null || record.paymentRef === '')
      ) {
        const utrTaken = await queryRunner.manager
          .getRepository(RechargeRecord)
          .findOne({
            where: { paymentRef: result.paymentRef },
            select: { id: true },
          });
        if (!utrTaken) {
          await queryRunner.manager
            .getRepository(RechargeRecord)
            .update({ id: record.id }, { paymentRef: result.paymentRef });
        }
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${creditAmount}`,
          isRecharge: 1,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId: record.userId })
        .execute();

      const updatedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId: record.userId } });
      if (!updatedUser) {
        throw new BadRequestException('User not found after recharge credit');
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId: record.userId,
          sourceType: 'recharge',
          amount: reportedAmount,
          balance: Number(updatedUser.balance) - bonusAmount,
          refId: result.orderNo,
          description: `Recharge via ${result.gatewayRef}`,
        }),
      );
      if (bonusAmount > 0) {
        await queryRunner.manager.getRepository(Transaction).save(
          queryRunner.manager.getRepository(Transaction).create({
            userId: record.userId,
            sourceType: 'recharge_bonus',
            amount: bonusAmount,
            balance: Number(updatedUser.balance),
            refId: result.orderNo,
            description: 'Recharge offer bonus',
          }),
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Webhook: credited ${creditAmount} to user ${record.userId} for order ${result.orderNo}`,
      );

      await this.creditRechargeCommission(
        record.userId,
        reportedAmount,
        result.orderNo,
      );

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Webhook: failed to process ${result.orderNo}: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async creditRechargeCommission(
    rechargingUserId: string,
    rechargeAmount: number,
    orderNo: string,
  ): Promise<void> {
    try {
      if (rechargeAmount <= 0) return;

      const commConfigs = await this.commConfigRepo.find({
        where: { status: 1 },
      });
      if (commConfigs.length === 0) return;

      const defaultRates = new Map<number, number>();
      for (const cfg of commConfigs) {
        if (!cfg.gameType) defaultRates.set(cfg.level, Number(cfg.rate));
      }

      const rechargingUser = await this.userRepo.findOne({
        where: { userId: rechargingUserId },
      });
      if (!rechargingUser?.invitedBy) return;

      const l1User = await this.userRepo.findOne({
        where: { inviteCode: rechargingUser.invitedBy },
      });
      if (!l1User) return;

      const rate1 = defaultRates.get(1);
      if (rate1 !== undefined && rate1 > 0) {
        await this.creditCommissionToAgent(
          l1User.userId,
          rechargeAmount,
          rate1,
          rechargingUserId,
          orderNo,
          1,
        );
      }

      if (!l1User.invitedBy) return;
      const l2User = await this.userRepo.findOne({
        where: { inviteCode: l1User.invitedBy },
      });
      if (!l2User) return;

      const rate2 = defaultRates.get(2);
      if (rate2 !== undefined && rate2 > 0) {
        await this.creditCommissionToAgent(
          l2User.userId,
          rechargeAmount,
          rate2,
          rechargingUserId,
          orderNo,
          2,
        );
      }

      if (!l2User.invitedBy) return;
      const l3User = await this.userRepo.findOne({
        where: { inviteCode: l2User.invitedBy },
      });
      if (!l3User) return;

      const rate3 = defaultRates.get(3);
      if (rate3 !== undefined && rate3 > 0) {
        await this.creditCommissionToAgent(
          l3User.userId,
          rechargeAmount,
          rate3,
          rechargingUserId,
          orderNo,
          3,
        );
      }
    } catch (error) {
      this.logger.error(
        `Recharge commission failed for order ${orderNo}: ${(error as Error).message}`,
      );
    }
  }

  private async creditCommissionToAgent(
    agentUserId: string,
    rechargeAmount: number,
    rate: number,
    fromUserId: string,
    orderNo: string,
    level: number,
  ): Promise<void> {
    const amount = Number((rechargeAmount * rate).toFixed(2));
    if (amount <= 0) return;

    const refId = `comm_rc_L${level}_${orderNo}`;

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
        throw new BadRequestException(
          'Agent not found after commission credit',
        );
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId: agentUserId,
          sourceType: 'commission',
          amount,
          balance: Number(user.balance),
          refId,
          description: `L${level} recharge commission from ${fromUserId} (order ${orderNo})`,
        }),
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Recharge commission credit failed for ${agentUserId} order ${orderNo}: ${(error as Error).message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
