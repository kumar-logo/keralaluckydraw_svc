import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../../entities/user.entity';
import { Order } from '../../../entities/order.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../../entities/withdrawal-record.entity';
import { TransferRecord } from '../../../entities/transfer-record.entity';
import { AppConfig } from '../../../entities/app-config.entity';
import { PaginatedResponse } from '../../../common/dto/response.dto';
import { AdminAuditService } from './admin-audit.service';
import { CreateUserDto, UpdateUserDto } from '../dto/admin.dto';
import {
  UserBetsQuery,
  UserTransactionsQuery,
  UserTransfersQuery,
  trimDate,
} from './admin-filter.types';

const PASSWORD_SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 100;
const INVITE_CODE_DIGITS = 7;
const INVITE_CODE_MAX_ATTEMPTS = 12;

interface UserBetStatsRow {
  totalOrders: string;
  totalBet: string;
  totalWin: string;
  wonOrders: string;
}

interface UserAmountStatsRow {
  total: string;
  count: string;
}

export interface UserTransferRow {
  id: number;
  amount: number;
  giveAmount: number;
  credited: number;
  balanceAfter: number | null;
  orderNo: string;
  status: number;
  createdAt: Date;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(TransferRecord)
    private transferRepo: Repository<TransferRecord>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
    private audit: AdminAuditService,
    private dataSource: DataSource,
  ) {}

  async getUsers(dto: { pageNo: number; pageSize: number; search?: string }) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC');
    if (dto.search)
      qb.where('u.phone LIKE :s OR u.nickname LIKE :s OR u.user_id LIKE :s', {
        s: `%${dto.search}%`,
      });
    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async createUser(dto: CreateUserDto, adminId: number) {
    const phone = dto.phone.trim();
    const existing = await this.userRepo.findOne({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('This phone number is already registered');
    }

    const inviteCode = await this.generateInviteCode();
    const invitedBy = this.normalizeInvite(dto.inviteCode);
    const user = this.userRepo.create({
      userId: this.generateUserId(),
      phone,
      passwordHash: await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS),
      nickname: `User${phone.slice(-4)}`,
      inviteCode,
      invitedBy,
    });
    await this.userRepo.save(user);

    await this.audit.createAuditLog(adminId, 'create_user', 'user', user.userId, {
      phone,
      invitedBy: invitedBy ? invitedBy : null,
    });

    return {
      userId: user.userId,
      phone: user.phone,
      nickname: user.nickname,
      inviteCode: user.inviteCode,
      invitedBy: user.invitedBy,
    };
  }

  private normalizeInvite(inviteCode: string | undefined): string | undefined {
    if (inviteCode === undefined) return undefined;
    const trimmed = inviteCode.trim();
    if (trimmed.length === 0) return undefined;
    return trimmed;
  }

  private generateUserId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  private async generateInviteCode(): Promise<string> {
    const cfg = await this.appConfigRepo.findOne({ where: { id: 1 } });
    if (!cfg) {
      throw new BadRequestException('Configuration unavailable');
    }
    const prefix = cfg.referralPrefix.trim().slice(0, 12);
    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
      let digits = '';
      for (let i = 0; i < INVITE_CODE_DIGITS; i++) {
        digits += Math.floor(Math.random() * 10).toString();
      }
      const code = `${prefix}${digits}`;
      const exists = await this.userRepo.findOne({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('Could not allocate invite code');
  }

  async updateUser(userId: string, data: UpdateUserDto, adminId: number) {
    await this.userRepo.update({ userId }, data);
    await this.audit.createAuditLog(
      adminId,
      'update_user',
      'user',
      userId,
      data,
    );
  }

  async setUserPassword(userId: string, newPassword: string, adminId: number) {
    const password = typeof newPassword === 'string' ? newPassword : '';
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
      );
    }

    const user = await this.userRepo.findOne({
      where: { userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    await this.userRepo.update({ userId }, { passwordHash });

    await this.audit.createAuditLog(
      adminId,
      'set_user_password',
      'user',
      userId,
    );
    return { success: true };
  }

  async deleteUser(userId: string, adminId: number) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');

    const balance = Number(user.balance);
    const withdrawableBalance = Number(user.withdrawableBalance);
    const bonusBalance = Number(user.bonusBalance);
    const appAward = Number(user.appAward);
    if (
      balance !== 0 ||
      withdrawableBalance !== 0 ||
      bonusBalance !== 0 ||
      appAward !== 0
    ) {
      throw new BadRequestException(
        'Cannot delete: user has a non-zero wallet balance',
      );
    }

    const [orderCount, rechargeCount, withdrawCount, txnCount] =
      await Promise.all([
        this.orderRepo.count({ where: { userId } }),
        this.rcRepo.count({ where: { userId } }),
        this.wdRepo.count({ where: { userId } }),
        this.txnRepo.count({ where: { userId } }),
      ]);
    if (
      orderCount > 0 ||
      rechargeCount > 0 ||
      withdrawCount > 0 ||
      txnCount > 0
    ) {
      throw new BadRequestException(
        'Cannot delete: user has orders/transactions',
      );
    }

    await this.userRepo.delete({ userId });
    await this.audit.createAuditLog(adminId, 'delete_user', 'user', userId, {
      phone: user.phone,
    });
    return { deleted: true };
  }

  async adjustBalance(
    userId: string,
    amount: number,
    type: 'add' | 'subtract',
    adminId: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (type === 'add') {
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
      } else {
        const deductResult = await queryRunner.manager
          .getRepository(User)
          .createQueryBuilder()
          .update(User)
          .set({
            withdrawableBalance: () =>
              `LEAST(withdrawable_balance, balance - ${amount})`,
            balance: () => `balance - ${amount}`,
            version: () => 'version + 1',
          })
          .where('user_id = :userId', { userId })
          .andWhere('balance >= :amount', { amount })
          .execute();

        if (deductResult.affected !== 1) {
          throw new BadRequestException('Insufficient balance to deduct');
        }
      }

      const txn = queryRunner.manager.getRepository(Transaction).create({
        userId,
        sourceType: 'adjustment',
        amount: type === 'add' ? amount : -amount,
      });
      await queryRunner.manager.getRepository(Transaction).save(txn);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const reason =
        error instanceof BadRequestException ? error.message : 'error';
      await this.audit.createAuditLog(
        adminId,
        'adjust_balance_failed',
        'user',
        userId,
        { amount, type, reason },
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.audit.createAuditLog(adminId, 'adjust_balance', 'user', userId, {
      amount,
      type,
    });
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');

    const betStats = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'totalOrders')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalBet')
      .addSelect('COALESCE(SUM(o.win_amount), 0)', 'totalWin')
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status = 1 THEN 1 ELSE 0 END), 0)',
        'wonOrders',
      )
      .where('o.user_id = :userId', { userId })
      .getRawOne<UserBetStatsRow>();

    const rechargeStats = await this.rcRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('r.user_id = :userId AND r.status = 1', { userId })
      .getRawOne<UserAmountStatsRow>();

    const withdrawStats = await this.wdRepo
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('w.user_id = :userId AND w.status = 1', { userId })
      .getRawOne<UserAmountStatsRow>();

    if (!betStats || !rechargeStats || !withdrawStats) {
      throw new NotFoundException('User statistics not available');
    }

    const directCount = await this.userRepo.count({
      where: { invitedBy: this.referralCodeFilter(user.inviteCode) },
    });

    return {
      userId: user.userId,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      balance: Number(user.balance),
      bonusBalance: Number(user.bonusBalance),
      vipLevel: user.vipLevel,
      inviteCode: user.inviteCode,
      invitedBy: user.invitedBy,
      channelId: user.channelId,
      isRecharge: user.isRecharge,
      status: user.status,
      createdAt: user.createdAt,
      totalOrders: Number(betStats.totalOrders),
      totalBet: Number(betStats.totalBet),
      totalWin: Number(betStats.totalWin),
      wonOrders: Number(betStats.wonOrders),
      totalRecharge: Number(rechargeStats.total),
      rechargeCount: Number(rechargeStats.count),
      totalWithdraw: Number(withdrawStats.total),
      withdrawCount: Number(withdrawStats.count),
      directReferrals: directCount,
    };
  }

  private referralCodeFilter(inviteCode: string | null): string {
    if (inviteCode) return inviteCode;
    return '__none__';
  }

  async getUserBets(userId: string, dto: UserBetsQuery) {
    const startDate = trimDate(dto.startDate);
    const endDate = trimDate(dto.endDate);
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .orderBy('o.created_at', 'DESC');

    if (dto.gameType) qb.andWhere('o.game_type = :gt', { gt: dto.gameType });
    if (dto.gameIds && dto.gameIds.length > 0)
      qb.andWhere('o.game_id IN (:...gids)', { gids: dto.gameIds });
    if (dto.status !== undefined && dto.status !== null)
      qb.andWhere('o.status = :s', { s: dto.status });
    if (startDate)
      qb.andWhere('o.created_at >= :obStart', {
        obStart: `${startDate} 00:00:00`,
      });
    if (endDate)
      qb.andWhere('o.created_at <= :obEnd', { obEnd: `${endDate} 23:59:59` });

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async getUserTransactions(userId: string, dto: UserTransactionsQuery) {
    const startDate = trimDate(dto.startDate);
    const endDate = trimDate(dto.endDate);
    const qb = this.txnRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.created_at', 'DESC');

    if (dto.sourceType)
      qb.andWhere('t.source_type = :type', { type: dto.sourceType });
    if (startDate)
      qb.andWhere('t.created_at >= :otStart', {
        otStart: `${startDate} 00:00:00`,
      });
    if (endDate)
      qb.andWhere('t.created_at <= :otEnd', { otEnd: `${endDate} 23:59:59` });

    const total = await qb.getCount();
    const list = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();
    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async getUserTransfers(
    userId: string,
    dto: UserTransfersQuery,
  ): Promise<PaginatedResponse<UserTransferRow>> {
    const startDate = trimDate(dto.startDate);
    const endDate = trimDate(dto.endDate);
    const qb = this.transferRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.created_at', 'DESC');

    if (startDate)
      qb.andWhere('t.created_at >= :ofStart', {
        ofStart: `${startDate} 00:00:00`,
      });
    if (endDate)
      qb.andWhere('t.created_at <= :ofEnd', { ofEnd: `${endDate} 23:59:59` });

    const total = await qb.getCount();
    const records = await qb
      .skip((dto.pageNo - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getMany();

    const list: UserTransferRow[] = records.map((t) => {
      const amount = Number(t.amount);
      const giveAmount = Number(t.giveAmount);
      const balanceAfter =
        t.balanceAfter === null || t.balanceAfter === undefined
          ? null
          : Number(t.balanceAfter);
      return {
        id: Number(t.id),
        amount,
        giveAmount,
        credited: Math.round((amount + giveAmount) * 100) / 100,
        balanceAfter,
        orderNo: t.orderNo,
        status: t.status,
        createdAt: t.createdAt,
      };
    });

    return new PaginatedResponse(list, total, dto.pageNo, dto.pageSize);
  }

  async getUserReferrals(userId: string) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');

    const directUsers = await this.userRepo.find({
      where: { invitedBy: this.referralCodeFilter(user.inviteCode) },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const directCodes = directUsers.map((u) => u.inviteCode).filter(Boolean);
    let indirectUsers: User[] = [];
    if (directCodes.length > 0) {
      indirectUsers = await this.userRepo
        .createQueryBuilder('u')
        .where('u.invited_by IN (:...codes)', { codes: directCodes })
        .orderBy('u.created_at', 'DESC')
        .take(100)
        .getMany();
    }

    const mapUser = (u: User) => ({
      userId: u.userId,
      nickname: u.nickname,
      phone: u.phone,
      balance: Number(u.balance),
      vipLevel: u.vipLevel,
      isRecharge: u.isRecharge,
      createdAt: u.createdAt,
    });

    return {
      direct: directUsers.map(mapUser),
      indirect: indirectUsers.map(mapUser),
    };
  }
}
