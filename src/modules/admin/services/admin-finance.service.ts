import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../../entities/withdrawal-record.entity';
import { BankCard } from '../../../entities/bank-card.entity';
import { RebateRecord } from '../../../entities/rebate-record.entity';
import { WageRecord } from '../../../entities/wage-record.entity';
import { AgentCommission } from '../../../entities/agent-commission.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import { ThirdPartyTransaction } from '../../../entities/third-party-transaction.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { PaymentGatewayMode, RechargeStatus } from '../../../common/enums';
import { AdminAuditService } from './admin-audit.service';
import { PaymentService } from '../../payment/payment.service';

interface UsernameInfo {
  nickname: string;
  phone: string;
  avatar: string;
  balance: number;
}

export interface ThirdPartyTransactionQuery {
  pageNo: number;
  pageSize: number;
  memberId?: number;
  gameRound?: string;
  startDate?: string;
  endDate?: string;
}

export interface ThirdPartyTransactionRow {
  id: number;
  txnKey: string;
  serialNumber: string | null;
  memberId: number;
  userId: string;
  username: string;
  gameRound: string | null;
  betAmount: number;
  winAmount: number;
  net: number;
  createdAt: Date;
}

export interface ThirdPartyTransactionSummary {
  totalWagered: number;
  totalWon: number;
  netProfit: number;
}

export interface ThirdPartyTransactionListResult {
  list: ThirdPartyTransactionRow[];
  total: number;
  pageNo: number;
  pageSize: number;
  summary: ThirdPartyTransactionSummary;
}

export interface RechargeStatusCount {
  status: number;
  count: number;
  amount: number;
}

interface RechargeStatusCountRaw {
  status: string | number;
  count: string | number;
  amount: string | number | null;
}

export interface RechargeRecordRow extends RechargeRecord {
  username: string;
  phone: string;
  userBalance: number;
  channel: string;
  gatewayMode: string;
  additionalVerification: number;
  manualFallback: number;
  proofUrl?: string;
}

export interface RechargeRecordListResult
  extends PaginatedResponse<RechargeRecordRow> {
  statusCounts: RechargeStatusCount[];
}

export interface WithdrawStatusCount {
  status: number;
  count: number;
  amount: number;
}

export interface WithdrawRecordRow extends WithdrawalRecord {
  username: string;
  userBalance: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  ifscCode: string;
  upiId: string;
  gpayId: string;
  phonepeId: string;
}

export interface WithdrawRecordListResult
  extends PaginatedResponse<WithdrawRecordRow> {
  statusCounts: WithdrawStatusCount[];
}

@Injectable()
export class AdminFinanceService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(BankCard)
    private cardRepo: Repository<BankCard>,
    @InjectRepository(RebateRecord)
    private rebateRepo: Repository<RebateRecord>,
    @InjectRepository(WageRecord) private wageRepo: Repository<WageRecord>,
    @InjectRepository(AgentCommission)
    private agentCommRepo: Repository<AgentCommission>,
    @InjectRepository(PaymentGateway)
    private gatewayRepo: Repository<PaymentGateway>,
    @InjectRepository(ThirdPartyTransaction)
    private thirdPartyTxnRepo: Repository<ThirdPartyTransaction>,
    private audit: AdminAuditService,
    private dataSource: DataSource,
    private payment: PaymentService,
  ) {}

  private applyRechargeFilters(
    qb: ReturnType<Repository<RechargeRecord>['createQueryBuilder']>,
    filters: { search: string; startDate: string; endDate: string },
  ): ReturnType<Repository<RechargeRecord>['createQueryBuilder']> {
    if (filters.search) {
      qb.andWhere('(r.user_id LIKE :q OR r.order_no LIKE :q)', {
        q: `%${filters.search}%`,
      });
    }
    if (filters.startDate) {
      qb.andWhere('r.created_at >= :rcStart', {
        rcStart: `${filters.startDate} 00:00:00`,
      });
    }
    if (filters.endDate) {
      qb.andWhere('r.created_at <= :rcEnd', {
        rcEnd: `${filters.endDate} 23:59:59`,
      });
    }
    return qb;
  }

  async getRechargeRecords(dto: {
    pageNo: number;
    pageSize: number;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<RechargeRecordListResult> {
    const status =
      dto.status === undefined || dto.status === null
        ? undefined
        : Number(dto.status);
    const filters = {
      search: dto.search ? dto.search.trim() : '',
      startDate: dto.startDate ? dto.startDate.trim() : '',
      endDate: dto.endDate ? dto.endDate.trim() : '',
    };
    const applySearch = (
      qb: ReturnType<Repository<RechargeRecord>['createQueryBuilder']>,
    ) => this.applyRechargeFilters(qb, filters);
    const qb = applySearch(
      this.rcRepo
        .createQueryBuilder('r')
        .addSelect('r.proofImage')
        .orderBy('r.created_at', 'DESC'),
    );
    if (status !== undefined) {
      qb.andWhere('r.status = :s', { s: status });
    }
    const statusCounts = await this.loadRechargeStatusCounts(applySearch);
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    const userMap = await this.loadUsernameMap(
      list.map((record) => record.userId),
    );
    const channelIds = [
      ...new Set(
        list.map((record) => record.channelId).filter((id) => id != null),
      ),
    ];
    const gateways = channelIds.length
      ? await this.gatewayRepo.find({ where: { id: In(channelIds) } })
      : [];
    const gatewayMap = new Map(gateways.map((g) => [g.id, g]));
    const withUsername = list.map((record) => {
      const gateway = gatewayMap.get(record.channelId);
      const userInfo = userMap.get(record.userId);
      return {
        ...record,
        username: this.resolveUsername(userInfo),
        phone: userInfo ? userInfo.phone : '',
        userBalance: this.resolveBalance(userInfo),
        channel: gateway ? gateway.gatewayName : '',
        gatewayMode: gateway ? gateway.mode : '',
        additionalVerification: gateway
          ? Number(gateway.additionalVerification)
          : 0,
        manualFallback: gateway ? Number(gateway.manualFallback) : 0,
        proofUrl: record.proofImage ? record.proofImage : undefined,
      };
    });
    const paginated = new PaginatedResponse(
      withUsername,
      total,
      dto.pageNo,
      dto.pageSize,
    );
    return { ...paginated, statusCounts };
  }

  private async loadRechargeStatusCounts(
    applySearch: (
      qb: ReturnType<Repository<RechargeRecord>['createQueryBuilder']>,
    ) => ReturnType<Repository<RechargeRecord>['createQueryBuilder']>,
  ): Promise<RechargeStatusCount[]> {
    const rows = await applySearch(this.rcRepo.createQueryBuilder('r'))
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'amount')
      .groupBy('r.status')
      .getRawMany<RechargeStatusCountRaw>();
    return rows.map((row) => ({
      status: Number(row.status),
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  private cardField(
    card: BankCard | undefined,
    key:
      | 'bankName'
      | 'cardNumber'
      | 'holderName'
      | 'ifscCode'
      | 'upiAddress'
      | 'gpayId'
      | 'phonepeId',
  ): string {
    if (!card) return '';
    const value = card[key];
    if (value) return value;
    return '';
  }

  private async loadUsernameMap(
    userIds: string[],
  ): Promise<Map<string, UsernameInfo>> {
    const map = new Map<string, UsernameInfo>();
    const distinctIds = [...new Set(userIds.filter(Boolean))];
    if (distinctIds.length === 0) return map;
    const users = await this.userRepo.find({
      where: { userId: In(distinctIds) },
      select: ['userId', 'nickname', 'phone', 'avatar', 'balance'],
    });
    for (const user of users) {
      map.set(user.userId, {
        nickname: user.nickname,
        phone: user.phone,
        avatar: user.avatar,
        balance: Number(user.balance),
      });
    }
    return map;
  }

  private resolveUsername(info: UsernameInfo | undefined): string {
    if (!info) return '';
    if (info.nickname) return info.nickname;
    if (info.phone) return info.phone;
    return '';
  }

  private resolveBalance(info: UsernameInfo | undefined): number {
    if (!info) return 0;
    return info.balance;
  }

  private resolveThirdPartyUsername(user: User | undefined): string {
    if (!user) return '';
    if (user.nickname) return user.nickname;
    if (user.phone) return user.phone;
    return '';
  }

  async approveRecharge(orderNo: string, adminId: number) {
    let rechargeUserId = '';
    let rechargeAmount = 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const record = await queryRunner.manager
        .getRepository(RechargeRecord)
        .findOne({ where: { orderNo } });
      if (!record) throw new NotFoundException('Record not found');
      rechargeUserId = record.userId;
      rechargeAmount = Number(record.amount);

      const gateway = await queryRunner.manager
        .getRepository(PaymentGateway)
        .findOne({ where: { id: record.channelId } });
      const isManualGateway =
        gateway !== null && gateway.mode === PaymentGatewayMode.Manual;
      const isHeldForReview =
        gateway !== null && Number(gateway.additionalVerification) === 1;
      const isManualFallback =
        gateway !== null && Number(gateway.manualFallback) === 1;
      if (
        !gateway ||
        (!isManualGateway && !isHeldForReview && !isManualFallback)
      ) {
        throw new BadRequestException(
          'Only manual-gateway, additional-verification, or manual-fallback recharges can be approved; auto-gateway recharges settle automatically.',
        );
      }

      if (record.paymentRef) {
        const alreadyCredited = await queryRunner.manager
          .getRepository(RechargeRecord)
          .findOne({
            where: {
              paymentRef: record.paymentRef,
              status: RechargeStatus.Approved,
            },
            select: { id: true },
          });
        if (alreadyCredited) {
          throw new BadRequestException(
            'This UTR number was already approved on another recharge',
          );
        }
      }

      const approveResult = await queryRunner.manager
        .getRepository(RechargeRecord)
        .createQueryBuilder()
        .update(RechargeRecord)
        .set({ status: 1, actualAmount: record.amount, approvedAt: new Date() })
        .where('order_no = :orderNo AND status = 0', { orderNo })
        .execute();

      if (approveResult.affected !== 1) {
        throw new BadRequestException('Recharge not pending');
      }

      const bonusAmount = Number(record.bonusAmount);
      const creditTotal = Number(record.amount) + bonusAmount;
      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${creditTotal}`,
          version: () => 'version + 1',
          isRecharge: 1,
        })
        .where('user_id = :userId', { userId: record.userId })
        .execute();

      const creditedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId: record.userId } });
      if (!creditedUser) {
        throw new BadRequestException(
          'User not found after recharge approval credit',
        );
      }

      const txn = queryRunner.manager.getRepository(Transaction).create({
        userId: record.userId,
        sourceType: 'recharge',
        amount: record.amount,
        balance: Number(creditedUser.balance) - bonusAmount,
        refId: orderNo,
        description: 'Recharge approved',
      });
      await queryRunner.manager.getRepository(Transaction).save(txn);
      if (bonusAmount > 0) {
        const bonusTxn = queryRunner.manager.getRepository(Transaction).create({
          userId: record.userId,
          sourceType: 'recharge_bonus',
          amount: bonusAmount,
          balance: Number(creditedUser.balance),
          refId: orderNo,
          description: 'Recharge offer bonus',
        });
        await queryRunner.manager.getRepository(Transaction).save(bonusTxn);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.audit.createAuditLog(
      adminId,
      'approve_recharge',
      'recharge',
      orderNo,
    );

    await this.payment.creditRechargeCommission(
      rechargeUserId,
      rechargeAmount,
      orderNo,
    );
  }

  async rejectRecharge(orderNo: string, adminId: number, remark: string) {
    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (!record) throw new NotFoundException('Record not found');
    const result = await this.rcRepo.update(
      { orderNo, status: RechargeStatus.Pending },
      { status: RechargeStatus.Rejected, remark },
    );
    if (result.affected !== 1) {
      throw new BadRequestException('Recharge not pending');
    }
    await this.audit.createAuditLog(
      adminId,
      'reject_recharge',
      'recharge',
      orderNo,
      { remark },
    );
  }

  private applyWithdrawFilters(
    qb: ReturnType<Repository<WithdrawalRecord>['createQueryBuilder']>,
    filters: { search: string; startDate: string; endDate: string },
  ): ReturnType<Repository<WithdrawalRecord>['createQueryBuilder']> {
    if (filters.search) {
      qb.andWhere('(w.user_id LIKE :q OR w.order_no LIKE :q)', {
        q: `%${filters.search}%`,
      });
    }
    if (filters.startDate) {
      qb.andWhere('w.created_at >= :wdStart', {
        wdStart: `${filters.startDate} 00:00:00`,
      });
    }
    if (filters.endDate) {
      qb.andWhere('w.created_at <= :wdEnd', {
        wdEnd: `${filters.endDate} 23:59:59`,
      });
    }
    return qb;
  }

  async getWithdrawRecords(dto: {
    pageNo: number;
    pageSize: number;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<WithdrawRecordListResult> {
    const status =
      dto.status === undefined || dto.status === null
        ? undefined
        : Number(dto.status);
    const filters = {
      search: dto.search ? dto.search.trim() : '',
      startDate: dto.startDate ? dto.startDate.trim() : '',
      endDate: dto.endDate ? dto.endDate.trim() : '',
    };
    const applySearch = (
      qb: ReturnType<Repository<WithdrawalRecord>['createQueryBuilder']>,
    ) => this.applyWithdrawFilters(qb, filters);
    const qb = applySearch(
      this.wdRepo.createQueryBuilder('w').orderBy('w.created_at', 'DESC'),
    );
    if (status !== undefined) {
      qb.andWhere('w.status = :s', { s: status });
    }
    const statusCounts = await this.loadWithdrawStatusCounts(applySearch);
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    const userMap = await this.loadUsernameMap(
      list.map((record) => record.userId),
    );
    const cardIds = [
      ...new Set(
        list.map((record) => record.bankcardId).filter((id) => id != null),
      ),
    ];
    const cards = cardIds.length
      ? await this.cardRepo.find({ where: { id: In(cardIds) } })
      : [];
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const withUsername = list.map((record) => {
      const card = cardMap.get(record.bankcardId);
      const userInfo = userMap.get(record.userId);
      return {
        ...record,
        username: this.resolveUsername(userInfo),
        userBalance: this.resolveBalance(userInfo),
        bankName: this.cardField(card, 'bankName'),
        bankAccount: this.cardField(card, 'cardNumber'),
        bankHolder: this.cardField(card, 'holderName'),
        ifscCode: this.cardField(card, 'ifscCode'),
        upiId: this.cardField(card, 'upiAddress'),
        gpayId: this.cardField(card, 'gpayId'),
        phonepeId: this.cardField(card, 'phonepeId'),
      };
    });
    const paginated = new PaginatedResponse(
      withUsername,
      total,
      dto.pageNo,
      dto.pageSize,
    );
    return { ...paginated, statusCounts };
  }

  private async loadWithdrawStatusCounts(
    applySearch: (
      qb: ReturnType<Repository<WithdrawalRecord>['createQueryBuilder']>,
    ) => ReturnType<Repository<WithdrawalRecord>['createQueryBuilder']>,
  ): Promise<WithdrawStatusCount[]> {
    const rows = await applySearch(this.wdRepo.createQueryBuilder('w'))
      .select('w.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(w.amount), 0)', 'amount')
      .groupBy('w.status')
      .getRawMany<RechargeStatusCountRaw>();
    return rows.map((row) => ({
      status: Number(row.status),
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  private csvField(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  private csvRow(fields: unknown[]): string {
    return `${fields.map((f) => this.csvField(f)).join(',')}\n`;
  }

  private async writeCsvChunk(res: Response, buffer: string): Promise<void> {
    if (!res.write(buffer)) {
      await new Promise<void>((resolve) => res.once('drain', () => resolve()));
    }
  }

  async streamRechargeCsv(
    res: Response,
    dto: {
      status?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recharge-records-${Date.now()}.csv"`,
    );
    const header = [
      'orderNo',
      'userId',
      'username',
      'phone',
      'amount',
      'actualAmount',
      'channel',
      'status',
      'paymentRef',
      'remark',
      'createdAt',
    ];
    res.write(`${header.join(',')}\n`);

    const status =
      dto.status === undefined || dto.status === null
        ? undefined
        : Number(dto.status);
    const filters = {
      search: dto.search ? dto.search.trim() : '',
      startDate: dto.startDate ? dto.startDate.trim() : '',
      endDate: dto.endDate ? dto.endDate.trim() : '',
    };
    const chunkSize = 5000;
    let lastId = 0;
    for (;;) {
      const qb = this.applyRechargeFilters(
        this.rcRepo.createQueryBuilder('r'),
        filters,
      )
        .andWhere('r.id > :lastId', { lastId })
        .orderBy('r.id', 'ASC')
        .limit(chunkSize);
      if (status !== undefined) {
        qb.andWhere('r.status = :s', { s: status });
      }
      const rows = await qb.getMany();
      if (rows.length === 0) break;

      const userMap = await this.loadUsernameMap(rows.map((r) => r.userId));
      const channelIds = [
        ...new Set(rows.map((r) => r.channelId).filter((id) => id != null)),
      ];
      const gateways = channelIds.length
        ? await this.gatewayRepo.find({ where: { id: In(channelIds) } })
        : [];
      const gatewayMap = new Map(gateways.map((g) => [g.id, g]));

      let buffer = '';
      for (const r of rows) {
        const gateway = gatewayMap.get(r.channelId);
        const userInfo = userMap.get(r.userId);
        buffer += this.csvRow([
          r.orderNo,
          r.userId,
          this.resolveUsername(userInfo),
          userInfo ? userInfo.phone : '',
          r.amount,
          r.actualAmount,
          gateway ? gateway.gatewayName : '',
          r.status,
          r.paymentRef,
          r.remark,
          new Date(r.createdAt).toISOString(),
        ]);
      }
      await this.writeCsvChunk(res, buffer);
      lastId = Number(rows[rows.length - 1].id);
      if (rows.length < chunkSize) break;
    }
    res.end();
  }

  async streamWithdrawCsv(
    res: Response,
    dto: {
      status?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="withdraw-records-${Date.now()}.csv"`,
    );
    const header = [
      'orderNo',
      'userId',
      'username',
      'amount',
      'fee',
      'actualAmount',
      'bankName',
      'bankAccount',
      'bankHolder',
      'ifscCode',
      'upiId',
      'status',
      'remark',
      'createdAt',
    ];
    res.write(`${header.join(',')}\n`);

    const status =
      dto.status === undefined || dto.status === null
        ? undefined
        : Number(dto.status);
    const filters = {
      search: dto.search ? dto.search.trim() : '',
      startDate: dto.startDate ? dto.startDate.trim() : '',
      endDate: dto.endDate ? dto.endDate.trim() : '',
    };
    const chunkSize = 5000;
    let lastId = 0;
    for (;;) {
      const qb = this.applyWithdrawFilters(
        this.wdRepo.createQueryBuilder('w'),
        filters,
      )
        .andWhere('w.id > :lastId', { lastId })
        .orderBy('w.id', 'ASC')
        .limit(chunkSize);
      if (status !== undefined) {
        qb.andWhere('w.status = :s', { s: status });
      }
      const rows = await qb.getMany();
      if (rows.length === 0) break;

      const userMap = await this.loadUsernameMap(rows.map((r) => r.userId));
      const cardIds = [
        ...new Set(rows.map((r) => r.bankcardId).filter((id) => id != null)),
      ];
      const cards = cardIds.length
        ? await this.cardRepo.find({ where: { id: In(cardIds) } })
        : [];
      const cardMap = new Map(cards.map((card) => [card.id, card]));

      let buffer = '';
      for (const w of rows) {
        const card = cardMap.get(w.bankcardId);
        const userInfo = userMap.get(w.userId);
        buffer += this.csvRow([
          w.orderNo,
          w.userId,
          this.resolveUsername(userInfo),
          w.amount,
          w.fee,
          w.actualAmount,
          this.cardField(card, 'bankName'),
          this.cardField(card, 'cardNumber'),
          this.cardField(card, 'holderName'),
          this.cardField(card, 'ifscCode'),
          this.cardField(card, 'upiAddress'),
          w.status,
          w.remark,
          new Date(w.createdAt).toISOString(),
        ]);
      }
      await this.writeCsvChunk(res, buffer);
      lastId = Number(rows[rows.length - 1].id);
      if (rows.length < chunkSize) break;
    }
    res.end();
  }

  async approveWithdraw(orderNo: string, adminId: number) {
    const approveResult = await this.wdRepo
      .createQueryBuilder()
      .update(WithdrawalRecord)
      .set({ status: 1, adminId })
      .where('order_no = :orderNo AND status = 0', { orderNo })
      .execute();

    if (approveResult.affected !== 1) {
      throw new BadRequestException('Withdrawal not pending');
    }

    await this.audit.createAuditLog(
      adminId,
      'approve_withdraw',
      'withdraw',
      orderNo,
    );
  }

  async rejectWithdraw(orderNo: string, adminId: number, remark: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const record = await queryRunner.manager
        .getRepository(WithdrawalRecord)
        .findOne({ where: { orderNo } });
      if (!record) throw new NotFoundException('Record not found');

      const rejectResult = await queryRunner.manager
        .getRepository(WithdrawalRecord)
        .createQueryBuilder()
        .update(WithdrawalRecord)
        .set({ status: 2, adminId, remark })
        .where('order_no = :orderNo AND status = 0', { orderNo })
        .execute();

      if (rejectResult.affected !== 1) {
        throw new BadRequestException('Withdrawal not pending');
      }

      await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({
          balance: () => `balance + ${record.amount}`,
          withdrawableBalance: () => `withdrawable_balance + ${record.amount}`,
          version: () => 'version + 1',
        })
        .where('user_id = :userId', { userId: record.userId })
        .execute();

      const refundedUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId: record.userId } });
      if (!refundedUser) {
        throw new BadRequestException('User not found after withdrawal refund');
      }

      const refundTxn = queryRunner.manager.getRepository(Transaction).create({
        userId: record.userId,
        sourceType: 'withdraw_refund',
        amount: record.amount,
        balance: Number(refundedUser.balance),
        refId: orderNo,
        description: 'Withdrawal rejected, amount refunded',
      });
      await queryRunner.manager.getRepository(Transaction).save(refundTxn);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.audit.createAuditLog(
      adminId,
      'reject_withdraw',
      'withdraw',
      orderNo,
      {
        remark,
      },
    );
  }

  async getRebateRecords(dto: {
    pageNo: number;
    pageSize: number;
    userId?: string;
    dateKey?: string;
  }) {
    const qb = this.rebateRepo
      .createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC');
    if (dto.userId) qb.andWhere('r.user_id = :uid', { uid: dto.userId });
    if (dto.dateKey) qb.andWhere('r.date_key = :dk', { dk: dto.dateKey });
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async getWageRecords(body: {
    pageNo: number;
    pageSize: number;
    search?: string;
    weekKey?: string;
  }) {
    const { pageNo = 1, pageSize = 20, search, weekKey } = body;
    const qb = this.wageRepo
      .createQueryBuilder('w')
      .orderBy('w.created_at', 'DESC');
    if (search) qb.andWhere('w.userId LIKE :s', { s: `%${search}%` });
    if (weekKey) qb.andWhere('w.weekKey = :wk', { wk: weekKey });
    const [list, total] = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { list, total, pageNo, pageSize };
  }

  async getAgentCommissions(body: {
    pageNo: number;
    pageSize: number;
    search?: string;
    sourceType?: string;
  }) {
    const { pageNo = 1, pageSize = 20, search, sourceType } = body;
    const qb = this.agentCommRepo
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC');
    if (search)
      qb.andWhere('(c.userId LIKE :s OR c.fromUser LIKE :s)', {
        s: `%${search}%`,
      });
    if (sourceType) qb.andWhere('c.sourceType = :st', { st: sourceType });
    const [list, total] = await qb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { list, total, pageNo, pageSize };
  }

  async getThirdPartyTransactions(
    dto: ThirdPartyTransactionQuery,
  ): Promise<ThirdPartyTransactionListResult> {
    const pageNo = Number(dto.pageNo) > 0 ? Number(dto.pageNo) : 1;
    const pageSize = Number(dto.pageSize) > 0 ? Number(dto.pageSize) : 20;

    const applyFilters = (
      qb: ReturnType<Repository<ThirdPartyTransaction>['createQueryBuilder']>,
    ) => {
      if (dto.memberId !== undefined && dto.memberId !== null) {
        qb.andWhere('t.member_id = :memberId', {
          memberId: Number(dto.memberId),
        });
      }
      if (dto.gameRound) {
        qb.andWhere('t.game_round = :gameRound', { gameRound: dto.gameRound });
      }
      if (dto.startDate) {
        qb.andWhere('t.created_at >= :startDate', {
          startDate: `${dto.startDate} 00:00:00`,
        });
      }
      if (dto.endDate) {
        qb.andWhere('t.created_at <= :endDate', {
          endDate: `${dto.endDate} 23:59:59`,
        });
      }
      return qb;
    };

    const listQb = applyFilters(
      this.thirdPartyTxnRepo.createQueryBuilder('t'),
    ).orderBy('t.created_at', 'DESC');

    const [rows, total] = await listQb
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const summaryRaw = await applyFilters(
      this.thirdPartyTxnRepo.createQueryBuilder('t'),
    )
      .select('COALESCE(SUM(t.bet_amount), 0)', 'totalWagered')
      .addSelect('COALESCE(SUM(t.win_amount), 0)', 'totalWon')
      .getRawOne<{ totalWagered: string; totalWon: string }>();
    if (!summaryRaw) {
      throw new NotFoundException('Third-party summary not available');
    }

    const totalWagered = Number(summaryRaw.totalWagered);
    const totalWon = Number(summaryRaw.totalWon);

    const memberIds = [...new Set(rows.map((r) => Number(r.memberId)))];
    const users = memberIds.length
      ? await this.userRepo.find({
          where: { id: In(memberIds) },
          select: ['id', 'userId', 'nickname', 'phone'],
        })
      : [];
    const userMap = new Map(users.map((u) => [Number(u.id), u]));

    const list: ThirdPartyTransactionRow[] = rows.map((r) => {
      const user = userMap.get(Number(r.memberId));
      const betAmount = Number(r.betAmount);
      const winAmount = Number(r.winAmount);
      return {
        id: Number(r.id),
        txnKey: r.txnKey,
        serialNumber: r.serialNumber,
        memberId: Number(r.memberId),
        userId: user ? user.userId : '',
        username: this.resolveThirdPartyUsername(user),
        gameRound: r.gameRound,
        betAmount,
        winAmount,
        net: Number((betAmount - winAmount).toFixed(6)),
        createdAt: r.createdAt,
      };
    });

    return {
      list,
      total,
      pageNo,
      pageSize,
      summary: {
        totalWagered: Number(totalWagered.toFixed(6)),
        totalWon: Number(totalWon.toFixed(6)),
        netProfit: Number((totalWagered - totalWon).toFixed(6)),
      },
    };
  }
}
