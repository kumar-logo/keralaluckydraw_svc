import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  IsNull,
  FindOptionsWhere,
  SelectQueryBuilder,
} from 'typeorm';
import { User } from '../../entities/user.entity';
import { Transaction } from '../../entities/transaction.entity';
import { BankCard } from '../../entities/bank-card.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../entities/withdrawal-record.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { TransactionType as TransactionTypeConfig } from '../../entities/transaction-type.entity';
import { Order } from '../../entities/order.entity';
import { TransferTier } from '../../entities/transfer-tier.entity';
import { TransferRecord } from '../../entities/transfer-record.entity';
import { PaginatedResponse } from '../../common/dto/response.dto';
import { ConfigLoaderService } from '../config/config-loader.service';
import { PaymentService } from '../payment/payment.service';
import {
  AddBankCardDto,
  EditBankCardDto,
  UTR_PATTERN,
  AgentReportDto,
  AgentTableDto,
} from './dto';
import { PaymentGatewayMode, RechargeStatus } from '../../common/enums';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { resolveVipLevel } from './vip-level.util';
import { buildOrderNo } from '../../common/order-no.generator';

export interface AgentTierConfig {
  tier: string;
  amount: number;
  bonus: number;
  rate: number;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(TransactionTypeConfig)
    private txnTypeRepo: Repository<TransactionTypeConfig>,
    @InjectRepository(BankCard) private cardRepo: Repository<BankCard>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(VipConfig) private vipRepo: Repository<VipConfig>,
    @InjectRepository(RebateRecord)
    private rebateRepo: Repository<RebateRecord>,
    @InjectRepository(PaymentGateway)
    private paymentGatewayRepo: Repository<PaymentGateway>,
    @InjectRepository(CommissionConfig)
    private commConfigRepo: Repository<CommissionConfig>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(TransferTier)
    private transferTierRepo: Repository<TransferTier>,
    @InjectRepository(TransferRecord)
    private transferRecordRepo: Repository<TransferRecord>,
    private configLoader: ConfigLoaderService,
    private paymentService: PaymentService,
    private dataSource: DataSource,
  ) {}

  async getWallet(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const balance = Number(user.balance);
    const withdrawableBalance = Number(user.withdrawableBalance);
    const bonusBalance = Number(user.bonusBalance);
    const rechargeBalance = Math.max(0, balance - withdrawableBalance);
    return {
      balance,
      bonusBalance,
      isRecharge: user.isRecharge,
      rechargeBalance,
      withdrawBalance: withdrawableBalance,
      wageringRequired: 0,
      wageringCompleted: 0,
      bonusRules: [],
    };
  }

  async getRechargePanel() {
    const gateways = await this.paymentGatewayRepo.find({
      where: { status: 1 },
      order: { sortOrder: 'ASC' },
    });

    const channelList = gateways.map((gateway) => ({
      id: gateway.id,
      name: gateway.gatewayName,
      channelName: gateway.gatewayName,
      channelCode: gateway.providerCode,
      channelType: gateway.providerCode,
      icon: gateway.iconUrl,
      mode: gateway.mode,
      qr: gateway.qrImageUrl,
      requireProof: Number(gateway.requireProof) === 1,
      minAmount: Number(gateway.minAmount),
      maxAmount: Number(gateway.maxAmount),
      feeRate: Number(gateway.feeRate),
      isCustom: 0,
    }));

    const amountsJson = await this.configLoader.getRechargePresets();

    return {
      rechargeChannelList: channelList,
      channels: channelList,
      payChannelList: channelList,
      amountBtnList: amountsJson,
      amounts: amountsJson,
      rcgAwardList: [],
      rechargeExtra: {
        recharge1stAward: [],
        depositPerList: [],
        rechargePerList: [],
      },
    };
  }

  private async computeRechargeBonus(amount: number): Promise<number> {
    const presets = await this.configLoader.getRechargePresets();
    const preset = presets.find((p) => Number(p.amount) === amount);
    if (!preset) return 0;
    const pct = Number(preset.bonusPct);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    return Number(((amount * pct) / 100).toFixed(2));
  }

  async createRecharge(
    userId: string,
    dto: {
      payChannelId: number;
      amount: number;
      proofImage?: string;
      paymentRef?: string;
    },
  ) {
    const gateway = await this.paymentGatewayRepo.findOne({
      where: { id: dto.payChannelId, status: 1 },
    });
    if (!gateway) {
      throw new BadRequestException('Invalid pay channel');
    }

    const amount = Number(dto.amount);
    const minAmount = Number(gateway.minAmount);
    const maxAmount = Number(gateway.maxAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (amount < minAmount) {
      throw new BadRequestException('Amount below minimum');
    }
    if (amount > maxAmount) {
      throw new BadRequestException('Amount above maximum');
    }

    const bonusAmount = await this.computeRechargeBonus(amount);

    const orderNo = buildOrderNo('RC');

    if (gateway.mode === PaymentGatewayMode.Manual) {
      const proofRequired = Number(gateway.requireProof) === 1;
      if (proofRequired && !dto.proofImage) {
        throw new BadRequestException('Payment proof is required');
      }
      if (!dto.paymentRef) {
        throw new BadRequestException('Reference number is required');
      }
      if (!UTR_PATTERN.test(dto.paymentRef)) {
        throw new BadRequestException('UTR must be exactly 12 digits');
      }
      const duplicateUtr = await this.rcRepo.findOne({
        where: { paymentRef: dto.paymentRef },
        select: { id: true },
      });
      if (duplicateUtr) {
        throw new BadRequestException(
          'This UTR number has already been submitted',
        );
      }
      await this.rcRepo.save(
        this.rcRepo.create({
          orderNo,
          userId,
          channelId: dto.payChannelId,
          amount: dto.amount,
          bonusAmount,
          status: RechargeStatus.Pending,
          proofImage: dto.proofImage,
          paymentRef: dto.paymentRef,
        }),
      );
      return { success: true, orderNo };
    }

    const record = this.rcRepo.create({
      orderNo,
      userId,
      channelId: dto.payChannelId,
      amount: dto.amount,
      bonusAmount,
      status: RechargeStatus.Pending,
    });
    await this.rcRepo.save(record);

    try {
      const paymentOrder = await this.paymentService.createPaymentOrder(
        orderNo,
        dto.amount,
        userId,
        gateway,
      );
      return { payLink: paymentOrder.payUrl, payUrl: paymentOrder.payUrl };
    } catch (error) {
      await this.rcRepo.update(record.id, {
        status: RechargeStatus.Rejected,
      });
      throw error;
    }
  }

  async getRechargeRecords(
    userId: string,
    dto: { pageNo: number; pageSize: number; status?: number },
  ) {
    const where: FindOptionsWhere<RechargeRecord> = { userId };
    if (dto.status !== undefined && dto.status !== null) {
      where.status = Number(dto.status);
    }
    const [list, total] = await this.rcRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (dto.pageNo - 1) * dto.pageSize,
      take: dto.pageSize,
    });
    const mapped = list.map((r) => ({
      id: String(r.id),
      orderId: r.orderNo,
      amount: Number(r.amount),
      status: r.status,
      createTime: r.createdAt,
      remark: r.remark,
      channel: '',
    }));
    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async getBankCards(userId: string) {
    const cards = await this.cardRepo.find({ where: { userId, status: 1 } });
    const list = cards.map((card) => ({
      id: card.id,
      holderName: card.holderName,
      bankName: card.bankName,
      cardNo: card.cardNumber,
      ifscCode: card.ifscCode,
      upiAddress: card.upiAddress,
      gpayId: card.gpayId,
      phonepeId: card.phonepeId,
      userEmail: card.userEmail,
      isDefault: card.isDefault,
    }));
    return { list };
  }

  async addBankCard(userId: string, dto: AddBankCardDto) {
    const card = this.cardRepo.create({
      userId,
      holderName: dto.holderName,
      bankName: dto.bankName,
      cardNumber: dto.cardNo,
      ifscCode: dto.ifscCode,
      upiAddress: dto.upiAddress,
      gpayId: dto.gpayId,
      phonepeId: dto.phonepeId,
      userEmail: dto.userEmail,
    });
    await this.cardRepo.save(card);
  }

  async updateBankCard(userId: string, dto: EditBankCardDto) {
    const result = await this.cardRepo.update(
      { id: dto.id, userId, status: 1 },
      {
        holderName: dto.holderName,
        bankName: dto.bankName,
        cardNumber: dto.cardNo,
        ifscCode: dto.ifscCode,
        upiAddress: dto.upiAddress,
        gpayId: dto.gpayId,
        phonepeId: dto.phonepeId,
        userEmail: dto.userEmail,
      },
    );
    if (!result.affected) {
      throw new BadRequestException('Bank card not found');
    }
  }

  async getWithdrawPanel(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const vipLevel = user.vipLevel;

    const feeRate = await this.configLoader.getWithdrawFeeRate();
    const minAmount = await this.configLoader.getWithdrawMinAmount();
    const defaultMaxAmount = await this.configLoader.getWithdrawMaxAmount();

    const vipConfig = await this.vipRepo.findOne({
      where: { level: vipLevel, status: 1 },
    });
    const maxAmount =
      vipConfig && Number(vipConfig.withdrawLimit) > 0
        ? Number(vipConfig.withdrawLimit)
        : defaultMaxAmount;

    const todayWithdrawn = await this.getTodayWithdrawnAmount(userId);
    const withdrawCountLimit = await this.configLoader.getWithdrawDailyCount();
    const todayCount = await this.getTodayWithdrawCount(userId);
    const balance = Number(user.withdrawableBalance);
    const withdrawExplain = await this.configLoader.getWithdrawExplain();

    return {
      withdrawFeeRate: feeRate,
      withdrawMinAmount: minAmount,
      minAmount,
      maxAmount,
      balance,
      withdrawBalance: balance,
      todayWithdrawn,
      todayRemainTimes: Math.max(0, withdrawCountLimit - todayCount),
      todayRemainAmount: Math.max(0, maxAmount - todayWithdrawn),
      withdrawCountLimit,
      withdrawCountSurplus: Math.max(0, withdrawCountLimit - todayCount),
      withdrawExplain,
    };
  }

  private async getTodayWithdrawnAmount(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await this.wdRepo
      .createQueryBuilder('wd')
      .select('COALESCE(SUM(wd.amount), 0)', 'total')
      .where('wd.user_id = :userId', { userId })
      .andWhere('wd.status IN (:...statuses)', { statuses: [0, 1] })
      .andWhere('wd.created_at >= :start', { start: todayStart })
      .getRawOne<{ total: string }>();
    if (!result) {
      throw new BadRequestException('Failed to aggregate withdrawn amount');
    }
    return Number(result.total);
  }

  private async getTodayWithdrawCount(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await this.wdRepo
      .createQueryBuilder('wd')
      .select('COUNT(*)', 'cnt')
      .where('wd.user_id = :userId', { userId })
      .andWhere('wd.created_at >= :start', { start: todayStart })
      .getRawOne<{ cnt: string }>();
    if (!result) {
      throw new BadRequestException('Failed to aggregate withdraw count');
    }
    return Number(result.cnt);
  }

  async createWithdrawal(
    userId: string,
    dto: { bankcardId: number; amount: number },
  ) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('Insufficient withdrawable balance');
    }
    if (user.status === 0) {
      throw new BadRequestException('Account disabled');
    }
    if (Number(user.withdrawableBalance) < dto.amount) {
      throw new BadRequestException('Insufficient withdrawable balance');
    }

    const card = await this.cardRepo.findOne({
      where: { id: dto.bankcardId, userId, status: 1 },
    });
    if (!card) {
      throw new BadRequestException('Invalid bank card');
    }

    const feeRate = await this.configLoader.getWithdrawFeeRate();
    const minAmount = await this.configLoader.getWithdrawMinAmount();
    const defaultMaxAmount = await this.configLoader.getWithdrawMaxAmount();

    const vipConfig = await this.vipRepo.findOne({
      where: { level: user.vipLevel, status: 1 },
    });
    const maxAmount =
      vipConfig && Number(vipConfig.withdrawLimit) > 0
        ? Number(vipConfig.withdrawLimit)
        : defaultMaxAmount;

    if (dto.amount < minAmount) {
      throw new BadRequestException('Amount below minimum');
    }
    if (dto.amount > maxAmount) {
      throw new BadRequestException('Amount above maximum');
    }

    const withdrawCountLimit = await this.configLoader.getWithdrawDailyCount();
    const todayCount = await this.getTodayWithdrawCount(userId);
    if (todayCount >= withdrawCountLimit) {
      throw new BadRequestException('Daily withdrawal count exceeded');
    }

    const todayWithdrawn = await this.getTodayWithdrawnAmount(userId);
    if (todayWithdrawn + dto.amount > maxAmount) {
      throw new BadRequestException('Daily withdrawal amount exceeded');
    }

    const fee = Math.ceil(dto.amount * feeRate);
    const actual = dto.amount - fee;
    const orderNo = buildOrderNo('WD');

    const deductResult = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        balance: () => `balance - ${dto.amount}`,
        withdrawableBalance: () => `withdrawable_balance - ${dto.amount}`,
        version: () => 'version + 1',
      })
      .where('user_id = :userId AND version = :version', {
        userId,
        version: user.version,
      })
      .andWhere('withdrawable_balance >= :amount', { amount: dto.amount })
      .andWhere('balance >= :amount', { amount: dto.amount })
      .execute();

    if (deductResult.affected === 0) {
      throw new BadRequestException(
        'Insufficient withdrawable balance or concurrent modification',
      );
    }

    const record = this.wdRepo.create({
      orderNo,
      userId,
      bankcardId: dto.bankcardId,
      amount: dto.amount,
      fee,
      actualAmount: actual,
      status: 0,
    });
    await this.wdRepo.save(record);

    await this.createTransaction(userId, 'withdraw', -dto.amount, orderNo);
  }

  async getWithdrawRecords(
    userId: string,
    dto: { pageNo: number; pageSize: number; status?: number },
  ) {
    const where: FindOptionsWhere<WithdrawalRecord> = { userId };
    if (dto.status !== undefined && dto.status !== null) {
      where.status = Number(dto.status);
    }
    const [list, total] = await this.wdRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (dto.pageNo - 1) * dto.pageSize,
      take: dto.pageSize,
    });
    const mapped = list.map((r) => ({
      id: String(r.id),
      orderId: r.orderNo,
      amount: Number(r.amount),
      status: r.status,
      createTime: r.createdAt,
      remark: r.remark,
      channel: '',
    }));
    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async transferBalance(userId: string, dto: { amount: number }) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const tiers = await this.transferTierRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const minAmount = tiers.length
      ? Math.min(...tiers.map((tier) => Number(tier.minAmount)))
      : await this.configLoader.getTransferMinAmount();
    const maxAmount = tiers.length
      ? Math.max(...tiers.map((tier) => Number(tier.maxAmount)))
      : await this.configLoader.getTransferMaxAmount();
    if (amount < minAmount || amount > maxAmount) {
      throw new BadRequestException(
        `Amount must be between ${minAmount} and ${maxAmount}`,
      );
    }

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user || Number(user.withdrawableBalance) < amount) {
      throw new BadRequestException('Insufficient withdrawable balance');
    }

    const tier = tiers.find(
      (t) => Number(t.minAmount) <= amount && Number(t.maxAmount) >= amount,
    );
    if (!tier) {
      throw new BadRequestException('Amount does not match any transfer tier');
    }
    const pct = Number(tier.pct);
    const giveAmount = Math.round(amount * pct * 100) / 100;
    const credit = Math.round((amount + giveAmount) * 100) / 100;

    const transferResult = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        withdrawableBalance: () => `withdrawable_balance - ${amount}`,
        balance: () => `balance + ${giveAmount}`,
        version: () => 'version + 1',
      })
      .where('user_id = :userId AND version = :version', {
        userId,
        version: user.version,
      })
      .andWhere('withdrawable_balance >= :amount', { amount })
      .execute();

    if (transferResult.affected === 0) {
      throw new BadRequestException(
        'Insufficient withdrawable balance or concurrent modification',
      );
    }

    const orderNo = buildOrderNo('TR');
    const after = await this.userRepo.findOne({ where: { userId } });
    if (!after) {
      throw new BadRequestException('User not found after transfer');
    }
    const balanceAfter = Number(after.balance);
    await this.transferRecordRepo.save(
      this.transferRecordRepo.create({
        userId,
        amount,
        giveAmount,
        direction: 'withdrawable_to_main',
        status: 1,
        orderNo,
        balanceAfter,
      }),
    );
    await this.createTransaction(
      userId,
      'transfer',
      giveAmount,
      orderNo,
      `Withdrawable to main: ${amount} converted (+${giveAmount} reward)`,
    );

    return { amount, giveAmount, credit, orderNo };
  }

  async getTransferList(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const tiers = await this.transferTierRepo.find({
      order: { sortOrder: 'ASC' },
    });
    const list = tiers.map((tier) => ({
      minAmount: Number(tier.minAmount),
      maxAmount: Number(tier.maxAmount),
      pct: Number(tier.pct),
    }));
    const minAmount = list.length
      ? Math.min(...list.map((tier) => tier.minAmount))
      : await this.configLoader.getTransferMinAmount();
    const maxAmount = list.length
      ? Math.max(...list.map((tier) => tier.maxAmount))
      : await this.configLoader.getTransferMaxAmount();
    return {
      mainBalance: Number(user.balance),
      withdrawableBalance: Number(user.withdrawableBalance),
      minAmount,
      maxAmount,
      list,
    };
  }

  async getTransferRecords(
    userId: string,
    dto: { pageNo: number; pageSize: number },
  ) {
    const [list, total] = await this.transferRecordRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (dto.pageNo - 1) * dto.pageSize,
      take: dto.pageSize,
    });
    const mapped = list.map((t) => ({
      id: String(t.id),
      orderId: t.orderNo,
      orderNo: t.orderNo,
      amount: Number(t.amount),
      giveAmount: Number(t.giveAmount),
      status: t.status,
      createTime: t.createdAt,
      direction: t.direction,
    }));
    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async getTransactionTypes() {
    const labels: Record<string, string> = {
      win: 'Winnings',
      recharge: 'Recharge',
      bet: 'Bets',
      withdraw: 'Withdraw',
    };
    const order = ['win', 'recharge', 'bet', 'withdraw'];
    const rows = await this.txnTypeRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.filter_group', 'g')
      .where("t.filter_group <> ''")
      .getRawMany();
    const present = new Set(rows.map((r) => r.g));
    return order
      .filter((g) => present.has(g))
      .map((g) => ({ type: g, name: labels[g] }));
  }

  async getTransactionRecords(
    userId: string,
    dto: {
      pageNo: number;
      pageSize: number;
      sourceType?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    let memberTypes: string[] | null = null;
    if (dto.sourceType && dto.sourceType !== 'all') {
      const groupRows = await this.txnTypeRepo.find({
        where: { filterGroup: dto.sourceType },
      });
      memberTypes = groupRows.length
        ? groupRows.map((r) => r.typeCode)
        : [dto.sourceType];
    }

    const applyFilters = (qb: SelectQueryBuilder<Transaction>) => {
      qb.where('t.user_id = :userId', { userId });
      if (memberTypes)
        qb.andWhere('t.source_type IN (:...types)', { types: memberTypes });
      if (dto.startDate)
        qb.andWhere('t.created_at >= :start', {
          start: `${dto.startDate} 00:00:00`,
        });
      if (dto.endDate)
        qb.andWhere('t.created_at <= :end', { end: `${dto.endDate} 23:59:59` });
      return qb;
    };

    const total = await applyFilters(
      this.txnRepo.createQueryBuilder('t'),
    ).getCount();

    const sumRow = await applyFilters(this.txnRepo.createQueryBuilder('t'))
      .select('COALESCE(SUM(t.amount), 0)', 'sum')
      .getRawOne<{ sum: string }>();
    if (!sumRow) {
      throw new BadRequestException('Failed to aggregate transaction total');
    }

    const list = await applyFilters(this.txnRepo.createQueryBuilder('t'))
      .orderBy('t.created_at', 'DESC')
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();

    const mapped = list.map((t) => ({
      ...t,
      remark: t.description,
      createTime: t.createdAt,
    }));
    const page = new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
    return { ...page, totalAmount: Number(sumRow.sum) };
  }

  async getRebateRecords(
    userId: string,
    dto: {
      pageNo: number;
      pageSize: number;
      status?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const qb = this.rebateRepo
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC');

    if (dto.status !== undefined && dto.status !== null) {
      qb.andWhere('r.status = :status', { status: dto.status });
    }
    if (dto.startDate)
      qb.andWhere('r.created_at >= :start', {
        start: `${dto.startDate} 00:00:00`,
      });
    if (dto.endDate)
      qb.andWhere('r.created_at <= :end', { end: `${dto.endDate} 23:59:59` });

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();

    const mapped = list.map((r) => ({
      id: r.id,
      dateKey: r.dateKey,
      gameType: r.gameType,
      betAmount: Number(r.betAmount),
      rebateRate: Number(r.rebateRate),
      rebateAmount: Number(r.rebateAmount),
      status: r.status,
      createdAt: r.createdAt,
    }));

    return new PaginatedResponse(mapped, total, dto.pageNo, dto.pageSize);
  }

  async claimRebate(userId: string, id: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const record = await queryRunner.manager
        .getRepository(RebateRecord)
        .findOne({ where: { id, userId } });

      if (!record)
        throw new BadRequestException('Rebate not found or already claimed');

      const amount = Number(record.rebateAmount);

      const claimResult = await queryRunner.manager
        .getRepository(RebateRecord)
        .createQueryBuilder()
        .update(RebateRecord)
        .set({ status: 1 })
        .where('id = :id AND user_id = :userId AND status = 0', { id, userId })
        .execute();

      if (claimResult.affected !== 1) {
        throw new BadRequestException('Rebate not found or already claimed');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();

      const user = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });
      if (!user) {
        throw new BadRequestException('User not found after rebate credit');
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId,
          sourceType: 'rebate',
          amount,
          balance: Number(user.balance),
          refId: `rebate_${id}`,
          description: `Rebate for ${record.dateKey} ${record.gameType}`,
        }),
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async computeVipTurnover(
    userId: string,
  ): Promise<{ totalRecharge: number; totalBet: number }> {
    const rcResult = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'recharge' })
      .getRawOne<{ total: string }>();
    const betResult = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'total')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.Cancelled, OrderStatus.Refunded],
      })
      .getRawOne<{ total: string }>();
    if (!rcResult || !betResult) {
      throw new BadRequestException('Failed to aggregate VIP turnover');
    }
    return {
      totalRecharge: Number(rcResult.total),
      totalBet: Number(betResult.total),
    };
  }

  private async promoteVipLevel(
    userId: string,
    storedLevel: number,
    totalRecharge: number,
    totalBet: number,
    levels: VipConfig[],
  ): Promise<number> {
    const live = resolveVipLevel(levels, totalRecharge, totalBet);
    if (live > storedLevel) {
      await this.userRepo.update({ userId }, { vipLevel: live });
      return live;
    }
    return storedLevel;
  }

  private async ensureVipLevel(userId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) return 0;
    const levels = await this.vipRepo.find({ where: { status: 1 } });
    const { totalRecharge, totalBet } = await this.computeVipTurnover(userId);
    return this.promoteVipLevel(
      userId,
      user.vipLevel,
      totalRecharge,
      totalBet,
      levels,
    );
  }

  async getVipPanel(userId?: string) {
    const levels = await this.vipRepo.find({
      where: { status: 1 },
      order: { level: 'ASC' },
    });

    let currentLevel = 0;
    let totalRecharge = 0;
    let totalBet = 0;

    if (userId) {
      const user = await this.userRepo.findOne({ where: { userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }
      const turnover = await this.computeVipTurnover(userId);
      totalRecharge = turnover.totalRecharge;
      totalBet = turnover.totalBet;
      currentLevel = await this.promoteVipLevel(
        userId,
        user.vipLevel,
        totalRecharge,
        totalBet,
        levels,
      );
    }

    const levelData = levels.map((lv) => ({
      level: lv.level,
      name: lv.levelName,
      levelName: lv.levelName,
      requiredBet: Number(lv.minBet),
      requiredRecharge: Number(lv.minRecharge),
      minRecharge: Number(lv.minRecharge),
      minBet: Number(lv.minBet),
      upgradeBonus: Number(lv.dailyReward),
      monthlyBonus: Number(lv.monthlyReward),
      dailyReward: Number(lv.dailyReward),
      monthlyReward: Number(lv.monthlyReward),
      rebateRate: Number(lv.rebateRate),
      withdrawLimit: Number(lv.withdrawLimit),
      iconUrl: lv.iconUrl,
      levelColor: lv.levelColor,
      reached: currentLevel >= lv.level,
    }));

    const nextLevel = levelData.find((lv) => lv.level > currentLevel);

    const claimedLevels: number[] = [];
    const monthlyClaimedLevels: number[] = [];
    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayKey = todayStart.toISOString().slice(0, 10);
      const monthKey = todayKey.slice(0, 7);
      const claimTxns = await this.txnRepo.find({
        where: { userId, sourceType: 'vip_reward' },
      });
      for (const t of claimTxns) {
        const daily = t.refId?.match(/vip_daily_.+_(\d+)_(\d{4}-\d{2}-\d{2})$/);
        if (daily && daily[2] === todayKey) {
          const lvl = Number(daily[1]);
          if (!claimedLevels.includes(lvl)) claimedLevels.push(lvl);
        }
        const monthly = t.refId?.match(/vip_monthly_.+_(\d+)_(\d{4}-\d{2})$/);
        if (monthly && monthly[2] === monthKey) {
          const lvl = Number(monthly[1]);
          if (!monthlyClaimedLevels.includes(lvl)) {
            monthlyClaimedLevels.push(lvl);
          }
        }
      }
    }

    return {
      currentLevel,
      vipLevel: currentLevel,
      currentBet: totalBet,
      totalBet,
      currentRecharge: totalRecharge,
      totalRecharge,
      nextLevelBet: nextLevel ? nextLevel.requiredBet : 0,
      nextBet: nextLevel ? nextLevel.requiredBet : 0,
      nextLevelRecharge: nextLevel ? nextLevel.requiredRecharge : 0,
      nextRecharge: nextLevel ? nextLevel.requiredRecharge : 0,
      levels: levelData,
      vipList: levelData,
      claimedLevels,
      receivedList: claimedLevels,
      monthlyClaimedLevels,
    };
  }

  async claimVipAward(userId: string, vipLevel: number) {
    if (!(await this.configLoader.getVipEnabled())) {
      throw new BadRequestException('VIP feature is disabled');
    }
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    const effectiveLevel = await this.ensureVipLevel(userId);
    if (vipLevel < 1 || effectiveLevel < vipLevel) {
      throw new BadRequestException('VIP level not reached');
    }

    const vipConfig = await this.vipRepo.findOne({
      where: { level: vipLevel, status: 1 },
    });
    if (!vipConfig) throw new BadRequestException('VIP level config not found');

    const amount = Number(vipConfig.dailyReward);
    if (amount <= 0) throw new BadRequestException('No reward for this level');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const awardDate = todayStart.toISOString().slice(0, 10);
    const refId = `vip_daily_${userId}_${vipLevel}_${awardDate}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertResult = await queryRunner.manager.query(
        `INSERT IGNORE INTO vip_awards (user_id, vip_level, award_date, award_type, amount)
         VALUES (?, ?, ?, 'daily', ?)`,
        [userId, vipLevel, awardDate, amount],
      );

      if (Number(insertResult.affectedRows) !== 1) {
        throw new BadRequestException('Already claimed today');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();

      const updatedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });
      if (!updatedUser) {
        throw new BadRequestException('User not found after VIP daily reward');
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId,
          sourceType: 'vip_reward',
          amount,
          balance: Number(updatedUser.balance),
          refId,
          description: `VIP ${vipLevel} daily reward`,
        }),
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async claimVipMonthly(userId: string, vipLevel: number) {
    if (!(await this.configLoader.getVipEnabled())) {
      throw new BadRequestException('VIP feature is disabled');
    }
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    const effectiveLevel = await this.ensureVipLevel(userId);
    if (vipLevel < 1 || effectiveLevel < vipLevel) {
      throw new BadRequestException('VIP level not reached');
    }

    const vipConfig = await this.vipRepo.findOne({
      where: { level: vipLevel, status: 1 },
    });
    if (!vipConfig) throw new BadRequestException('VIP level config not found');

    const amount = Number(vipConfig.monthlyReward);
    if (amount <= 0) throw new BadRequestException('No reward for this level');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthKey = todayStart.toISOString().slice(0, 7);
    const awardDate = `${monthKey}-01`;
    const refId = `vip_monthly_${userId}_${vipLevel}_${monthKey}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertResult = await queryRunner.manager.query(
        `INSERT IGNORE INTO vip_awards (user_id, vip_level, award_date, award_type, amount)
         VALUES (?, ?, ?, 'monthly', ?)`,
        [userId, vipLevel, awardDate, amount],
      );

      if (Number(insertResult.affectedRows) !== 1) {
        throw new BadRequestException('Already claimed this month');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();

      const updatedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });
      if (!updatedUser) {
        throw new BadRequestException(
          'User not found after VIP monthly reward',
        );
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId,
          sourceType: 'vip_reward',
          amount,
          balance: Number(updatedUser.balance),
          refId,
          description: `VIP ${vipLevel} monthly reward`,
        }),
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getWageInfo(userId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(
      now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
    );
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    const thisWeekBets = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.created_at >= :start', { start: thisWeekStart })
      .getRawOne<{ totalBet: string }>();

    const lastWeekBets = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.created_at >= :start AND o.created_at <= :end', {
        start: lastWeekStart,
        end: lastWeekEnd,
      })
      .getRawOne<{ totalBet: string }>();

    const thisWeekRc = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId AND t.source_type = :type', {
        userId,
        type: 'recharge',
      })
      .andWhere('t.created_at >= :start', { start: thisWeekStart })
      .getRawOne<{ total: string }>();

    const lastWeekRc = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId AND t.source_type = :type', {
        userId,
        type: 'recharge',
      })
      .andWhere('t.created_at >= :start AND t.created_at <= :end', {
        start: lastWeekStart,
        end: lastWeekEnd,
      })
      .getRawOne<{ total: string }>();

    if (!thisWeekBets || !lastWeekBets || !thisWeekRc || !lastWeekRc) {
      throw new BadRequestException('Failed to aggregate wage info');
    }

    const thisWeekBetAmount = Number(thisWeekBets.totalBet);
    const lastWeekBetAmount = Number(lastWeekBets.totalBet);

    const wageRate = await this.configLoader.getWageRate();
    const wageMinBet = await this.configLoader.getWageMinBet();

    const lastWeekKey = lastWeekStart.toISOString().slice(0, 10);
    const claimedTxn = await this.txnRepo.findOne({
      where: { userId, sourceType: 'wage', refId: `wage_${lastWeekKey}` },
    });

    const lastWeekWage =
      lastWeekBetAmount >= wageMinBet
        ? Number((lastWeekBetAmount * wageRate).toFixed(2))
        : 0;
    const thisWeekWage =
      thisWeekBetAmount >= wageMinBet
        ? Number((thisWeekBetAmount * wageRate).toFixed(2))
        : 0;

    return {
      wageMinBet,
      lastWeek: {
        condAmount: lastWeekBetAmount,
        isClaim: claimedTxn ? 1 : 0,
        rcAmount: Number(lastWeekRc.total),
        wageAmount: lastWeekWage,
      },
      thisWeek: {
        condAmount: thisWeekBetAmount,
        rcAmount: Number(thisWeekRc.total),
        wageAmount: thisWeekWage,
      },
    };
  }

  async claimWageAward(userId: string) {
    if (!(await this.configLoader.getVipEnabled())) {
      throw new BadRequestException('VIP feature is disabled');
    }
    const wageInfo = await this.getWageInfo(userId);

    if (wageInfo.lastWeek.isClaim === 1) {
      throw new BadRequestException('Already claimed');
    }
    if (wageInfo.lastWeek.wageAmount <= 0) {
      throw new BadRequestException('No wage to claim');
    }

    const amount = wageInfo.lastWeek.wageAmount;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(
      now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
    );
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const weekKey = lastWeekStart.toISOString().slice(0, 10);
    const refId = `wage_${weekKey}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertResult = await queryRunner.manager.query(
        `INSERT IGNORE INTO wage_records
           (user_id, week_key, cond_amount, rc_amount, wage_amount, is_claim)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          userId,
          weekKey,
          wageInfo.lastWeek.condAmount,
          wageInfo.lastWeek.rcAmount,
          amount,
        ],
      );

      if (Number(insertResult.affectedRows) !== 1) {
        throw new BadRequestException('Already claimed');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId })
        .execute();

      const updatedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId } });
      if (!updatedUser) {
        throw new BadRequestException('User not found after wage reward');
      }

      await queryRunner.manager.getRepository(Transaction).save(
        queryRunner.manager.getRepository(Transaction).create({
          userId,
          sourceType: 'wage',
          amount,
          balance: Number(updatedUser.balance),
          refId,
          description: 'Weekly wage reward',
        }),
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createTransaction(
    userId: string,
    sourceType: string,
    amount: number,
    refId?: string,
    description?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const txn = this.txnRepo.create({
      userId,
      sourceType,
      amount,
      balance: Number(user.balance),
      refId,
      description,
    });
    await this.txnRepo.save(txn);
    return txn;
  }

  async getAgentPanel(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');

    const directCount = await this.userRepo.count({
      where: { invitedBy: user.inviteCode },
    });

    const directUsers = await this.userRepo.find({
      where: { invitedBy: user.inviteCode },
    });
    const directCodes = directUsers.map((u) => u.inviteCode).filter(Boolean);
    const downlineUserIds = new Set<string>(
      directUsers.map((u) => u.userId).filter(Boolean),
    );
    const downlineLevelByUserId = new Map<string, number>();
    for (const u of directUsers) {
      if (u.userId) downlineLevelByUserId.set(u.userId, 1);
    }

    let teamCount = directCount;
    let level2Users: User[] = [];
    if (directCodes.length > 0) {
      level2Users = await this.userRepo
        .createQueryBuilder('u')
        .where('u.invited_by IN (:...codes)', { codes: directCodes })
        .getMany();
      teamCount += level2Users.length;
      for (const u of level2Users) {
        downlineUserIds.add(u.userId);
        if (u.userId && !downlineLevelByUserId.has(u.userId)) {
          downlineLevelByUserId.set(u.userId, 2);
        }
      }
    }

    const level2Codes = level2Users.map((u) => u.inviteCode).filter(Boolean);
    if (level2Codes.length > 0) {
      const level3Users = await this.userRepo
        .createQueryBuilder('u')
        .where('u.invited_by IN (:...codes)', { codes: level2Codes })
        .getMany();
      teamCount += level3Users.length;
      for (const u of level3Users) {
        downlineUserIds.add(u.userId);
        if (u.userId && !downlineLevelByUserId.has(u.userId)) {
          downlineLevelByUserId.set(u.userId, 3);
        }
      }
    }

    const downlineIds = [...downlineUserIds];

    const todayBoundary = new Date();
    todayBoundary.setHours(0, 0, 0, 0);

    let rcgAmountTotal = 0;
    let rcgAmountCurrent = 0;
    let betAmountTotal = 0;
    let betAmountCurrent = 0;

    if (downlineIds.length > 0) {
      const rcgTotalRow = await this.rcRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.actual_amount), 0)', 'total')
        .where('r.user_id IN (:...ids)', { ids: downlineIds })
        .andWhere('r.status = :status', { status: RechargeStatus.Approved })
        .getRawOne<{ total: string }>();

      const rcgTodayRow = await this.rcRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.actual_amount), 0)', 'total')
        .where('r.user_id IN (:...ids)', { ids: downlineIds })
        .andWhere('r.status = :status', { status: RechargeStatus.Approved })
        .andWhere('r.updated_at >= :start', { start: todayBoundary })
        .getRawOne<{ total: string }>();

      const betTotalRow = await this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_amount), 0)', 'total')
        .where('o.user_id IN (:...ids)', { ids: downlineIds })
        .getRawOne<{ total: string }>();

      const betTodayRow = await this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_amount), 0)', 'total')
        .where('o.user_id IN (:...ids)', { ids: downlineIds })
        .andWhere('o.created_at >= :start', { start: todayBoundary })
        .getRawOne<{ total: string }>();

      if (!rcgTotalRow || !rcgTodayRow || !betTotalRow || !betTodayRow) {
        throw new BadRequestException('Failed to aggregate downline totals');
      }
      rcgAmountTotal = Number(rcgTotalRow.total);
      rcgAmountCurrent = Number(rcgTodayRow.total);
      betAmountTotal = Number(betTotalRow.total);
      betAmountCurrent = Number(betTodayRow.total);
    }

    const commissionResult = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'commission' })
      .getRawOne<{ total: string }>();
    if (!commissionResult) {
      throw new BadRequestException('Failed to aggregate commission total');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let pendingCommission = 0;
    if (downlineIds.length > 0) {
      const commConfigs = await this.commConfigRepo.find({
        where: { status: 1 },
      });
      const defaultRates = new Map<number, number>();
      const gameRates = new Map<string, number>();
      for (const cfg of commConfigs) {
        if (cfg.gameType) {
          gameRates.set(`${cfg.level}_${cfg.gameType}`, Number(cfg.rate));
        } else {
          defaultRates.set(cfg.level, Number(cfg.rate));
        }
      }

      const todayBets = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.user_id', 'userId')
        .addSelect('o.game_type', 'gameType')
        .addSelect('SUM(o.total_amount)', 'totalBet')
        .where('o.user_id IN (:...ids)', { ids: downlineIds })
        .andWhere('o.created_at >= :start', { start: todayStart })
        .groupBy('o.user_id')
        .addGroupBy('o.game_type')
        .getRawMany();

      for (const row of todayBets) {
        const betAmount = Number(row.totalBet);
        if (betAmount <= 0) continue;
        const depth = downlineLevelByUserId.get(row.userId);
        if (!depth) continue;
        const gameKey = `${depth}_${row.gameType}`;
        const rate = gameRates.has(gameKey)
          ? gameRates.get(gameKey)
          : defaultRates.get(depth);
        if (rate === undefined || rate <= 0) continue;
        pendingCommission += Number((betAmount * rate).toFixed(2));
      }
      pendingCommission = Number(pendingCommission.toFixed(2));
    }

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const yesterdayComm = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'commission' })
      .andWhere('t.created_at >= :start AND t.created_at <= :end', {
        start: yesterdayStart,
        end: yesterdayEnd,
      })
      .getRawOne<{ total: string }>();
    if (!yesterdayComm) {
      throw new BadRequestException('Failed to aggregate yesterday commission');
    }

    const yesterdayNewAccounts = await this.userRepo
      .createQueryBuilder('u')
      .where('u.invited_by = :code', { code: user.inviteCode })
      .andWhere('u.created_at >= :start AND u.created_at <= :end', {
        start: yesterdayStart,
        end: yesterdayEnd,
      })
      .getCount();

    const todayNewAccounts = await this.userRepo
      .createQueryBuilder('u')
      .where('u.invited_by = :code', { code: user.inviteCode })
      .andWhere('u.created_at >= :start', { start: todayStart })
      .getCount();

    return {
      inviteCode: user.inviteCode,
      level: user.vipLevel,
      amountLast: Number(yesterdayComm.total),
      accountLast: yesterdayNewAccounts,
      amountTotal: Number(commissionResult.total),
      amountCurrent: pendingCommission,
      accountTotal: teamCount,
      accountCurrent: todayNewAccounts,
      rcgAmountTotal,
      rcgAmountCurrent,
      betAmountTotal,
      betAmountCurrent,
      directCount,
      teamCount,
      totalCommission: Number(commissionResult.total),
      todayCommission: pendingCommission,
      balance: Number(user.balance),
    };
  }

  async getAgentRule() {
    const configs = await this.commConfigRepo.find({
      where: { status: 1, gameType: IsNull() },
      order: { level: 'ASC' },
    });

    const levels = configs.map((c) => ({
      level: c.level,
      name: `Agent L${c.level}`,
      commissionRate: Number(c.rate),
      description: `Level ${c.level} referral commission`,
    }));

    const rulesJson = await this.configLoader.getJson<string[]>('agent_rules', [
      'Commission is calculated based on subordinate betting volume',
      'Commission is settled daily',
      'Minimum withdrawal amount for commission: 100',
    ]);

    const gameConfigs: Record<string, AgentTierConfig[]> = {};
    const gameTypes = ['color', 'dice', 'race', 'lottery', 'digit', 'wheel'];
    for (const gt of gameTypes) {
      gameConfigs[gt] = levels.map((lv) => ({
        tier: `L${lv.level}`,
        amount: 0,
        bonus: 0,
        rate: lv.commissionRate,
      }));
    }

    const rcgConfigs = levels.map((lv) => ({
      tier: `L${lv.level}`,
      amount: 0,
      bonus: 0,
      rate: lv.commissionRate,
    }));

    return { levels, rules: rulesJson, gameConfigs, rcgConfigs };
  }

  async getAgentReport(userId: string, dto: AgentReportDto) {
    const pageNo = dto.pageNo;
    const pageSize = dto.pageSize;

    const qb = this.txnRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'commission' })
      .orderBy('t.created_at', 'DESC');

    if (dto.startDate)
      qb.andWhere('t.created_at >= :start', {
        start: new Date(dto.startDate * 1000),
      });
    if (dto.endDate)
      qb.andWhere('t.created_at <= :end', {
        end: new Date(dto.endDate * 1000),
      });

    const total = await qb.getCount();
    const list = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const mapped = list.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      refId: t.refId,
      description: t.description,
      createdAt: t.createdAt,
    }));

    const summaryQb = this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'totalAmount')
      .addSelect('COUNT(*)', 'count')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'commission' });

    if (dto.startDate)
      summaryQb.andWhere('t.created_at >= :start', {
        start: new Date(dto.startDate * 1000),
      });
    if (dto.endDate)
      summaryQb.andWhere('t.created_at <= :end', {
        end: new Date(dto.endDate * 1000),
      });

    const summary = await summaryQb.getRawOne<{
      totalAmount: string;
      count: string;
    }>();
    if (!summary) {
      throw new BadRequestException('Failed to aggregate agent report summary');
    }

    const commTotal = Number(summary.totalAmount);
    const tierList = ['A', 'B', 'C', 'D'].map((tier) => ({
      tier,
      comm: tier === 'A' ? commTotal : 0,
      data: {
        invites: { value: 0, comm: 0 },
        recharge: { value: 0, comm: 0 },
        bets: { value: 0, comm: tier === 'A' ? commTotal : 0 },
      },
    }));

    return {
      commTotal,
      tierList,
      summary: {
        totalAmount: commTotal,
        count: Number(summary.count),
      },
      ...new PaginatedResponse(mapped, total, pageNo, pageSize),
    };
  }

  async getAgentTable(userId: string, dto: AgentTableDto) {
    const pageNo = dto.pageNo;
    const pageSize = dto.pageSize;
    const level = dto.level;

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user || !user.inviteCode) {
      return new PaginatedResponse([], 0, pageNo, pageSize);
    }

    let targetCodes: string[];

    if (level === 1) {
      targetCodes = [user.inviteCode];
    } else {
      const directUsers = await this.userRepo.find({
        where: { invitedBy: user.inviteCode },
      });
      targetCodes = directUsers.map((u) => u.inviteCode).filter(Boolean);
      if (targetCodes.length === 0) {
        return new PaginatedResponse([], 0, pageNo, pageSize);
      }
    }

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.invited_by IN (:...codes)', { codes: targetCodes })
      .orderBy('u.created_at', 'DESC');

    const total = await qb.getCount();
    const subordinates = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const list = subordinates.map((s) => ({
      userId: s.userId,
      nickname: s.nickname,
      phone: s.phone ? s.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '',
      avatar: s.avatar,
      balance: Number(s.balance),
      vipLevel: s.vipLevel,
      isRecharge: s.isRecharge,
      registeredAt: s.createdAt,
    }));

    return new PaginatedResponse(list, total, pageNo, pageSize);
  }

  async getAgentDetail(userId: string, dto: { targetUserId: string }) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user || !user.inviteCode)
      throw new BadRequestException('Agent not found');

    const target = await this.userRepo.findOne({
      where: { userId: dto.targetUserId },
    });
    if (!target) throw new BadRequestException('User not found');

    if (target.invitedBy !== user.inviteCode) {
      const directUsers = await this.userRepo.find({
        where: { invitedBy: user.inviteCode },
      });
      const directCodes = directUsers.map((u) => u.inviteCode).filter(Boolean);
      if (!directCodes.includes(target.invitedBy)) {
        throw new BadRequestException('User is not your subordinate');
      }
    }

    const betStats = await this.txnRepo
      .createQueryBuilder('t')
      .select(
        'COALESCE(ABS(SUM(CASE WHEN t.source_type = :bet THEN t.amount ELSE 0 END)), 0)',
        'totalBet',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.source_type = :win THEN t.amount ELSE 0 END), 0)',
        'totalWin',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.source_type = :rc THEN t.amount ELSE 0 END), 0)',
        'totalRecharge',
      )
      .where('t.user_id = :targetUserId', { targetUserId: dto.targetUserId })
      .setParameters({ bet: 'bet', win: 'win', rc: 'recharge' })
      .getRawOne<{
        totalBet: string;
        totalWin: string;
        totalRecharge: string;
      }>();

    const commissionFromTarget = await this.txnRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source_type = :type', { type: 'commission' })
      .andWhere('t.ref_id LIKE :ref', { ref: `%${dto.targetUserId}%` })
      .getRawOne<{ total: string }>();

    if (!betStats || !commissionFromTarget) {
      throw new BadRequestException('Failed to aggregate agent detail');
    }

    return {
      userId: target.userId,
      nickname: target.nickname,
      phone: target.phone
        ? target.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
        : '',
      avatar: target.avatar,
      vipLevel: target.vipLevel,
      balance: Number(target.balance),
      isRecharge: target.isRecharge,
      registeredAt: target.createdAt,
      totalBet: Number(betStats.totalBet),
      totalWin: Number(betStats.totalWin),
      totalRecharge: Number(betStats.totalRecharge),
      commissionEarned: Number(commissionFromTarget.total),
    };
  }
}
