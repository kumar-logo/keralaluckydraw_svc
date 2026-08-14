import type { Response } from 'express';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AdminUser } from '../../entities/admin-user.entity';
import { User } from '../../entities/user.entity';
import { GameList } from '../../entities/game-list.entity';
import { TinyFlag } from '../../common/enums';
import { GameRound } from '../../entities/game-round.entity';
import { Order } from '../../entities/order.entity';
import { Banner } from '../../entities/banner.entity';
import { Announcement } from '../../entities/announcement.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../entities/withdrawal-record.entity';
import { Transaction } from '../../entities/transaction.entity';
import { GameOddsConfig } from '../../entities/game-odds-config.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { GameFeeConfig } from '../../entities/game-fee-config.entity';
import { Popup } from '../../entities/popup.entity';
import { Activity } from '../../entities/activity.entity';
import { CheckinConfig } from '../../entities/checkin-config.entity';
import { RechargeAward } from '../../entities/recharge-award.entity';
import { RankConfig } from '../../entities/rank-config.entity';
import { Avatar } from '../../entities/avatar.entity';
import { WageRecord } from '../../entities/wage-record.entity';
import { AgentCommission } from '../../entities/agent-commission.entity';
import { CdkeyCode } from '../../entities/cdkey-code.entity';
import { ShareConfig } from '../../entities/share-config.entity';
import { SharePoster } from '../../entities/share-poster.entity';
import { TransactionType } from '../../entities/transaction-type.entity';
import { GameProvider } from '../../entities/game-provider.entity';
import { RaceRunnerFrame } from '../../entities/race-runner-frame.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { SpaWsService } from '../websocket/spa-ws.service';
import { AdminAuditService } from './services/admin-audit.service';
import { FcmService } from '../fcm/fcm.service';
import { AppVersionService } from '../app-version/app-version.service';
import { SaveAppVersionDto } from './dto/app-version.dto';
import { AdminContentService } from './services/admin-content.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminSystemService } from './services/admin-system.service';
import {
  SchedulerService,
  CronJobStatus,
} from './services/scheduler.service';
import { AdminConfigService } from './services/admin-config.service';
import {
  AdminRewardConfigService,
  UpsertRankConfigInput,
} from './services/admin-reward-config.service';
import { AdminPresentationService } from './services/admin-presentation.service';
import {
  AdminGameService,
  GameCategoryControlField,
  GameMutationInput,
} from './services/admin-game.service';
import { AdminGameConfigService } from './services/admin-game-config.service';
import { AdminAuthService } from './services/admin-auth.service';
import {
  OrdersListQuery,
  GameRoundsListQuery,
  UserBetsQuery,
  UserTransactionsQuery,
  UserTransfersQuery,
  GameOptionsQuery,
} from './services/admin-filter.types';
import {
  CreateMessageDto,
  SaveFirebaseConfigDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateAdminUserDto,
  OddsUpdateInput,
  TestSmsDto,
  TestWhatsappDto,
  UpdateGameResultConfigDto,
  UpdateCronJobDto,
} from './dto/admin.dto';
import { AdminUsersService } from './services/admin-users.service';
import { AdminOperationsService } from './services/admin-operations.service';
import {
  AdminFinanceService,
  ThirdPartyTransactionQuery,
  RechargeRecordListResult,
  WithdrawRecordListResult,
} from './services/admin-finance.service';
import { AdminLotteryManagementService } from './services/admin-lottery-management.service';
import { AdminLotteryDrawService } from './services/admin-lottery-draw.service';
import { DrawResult } from '../game/shared/game-engine.service';
import { AdminLotteryReportingService } from './services/admin-lottery-reporting.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(AdminUser) private adminRepo: Repository<AdminUser>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Banner) private bannerRepo: Repository<Banner>,
    @InjectRepository(Announcement) private annoRepo: Repository<Announcement>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(RechargeRecord)
    private rcRepo: Repository<RechargeRecord>,
    @InjectRepository(WithdrawalRecord)
    private wdRepo: Repository<WithdrawalRecord>,
    @InjectRepository(Transaction) private txnRepo: Repository<Transaction>,
    @InjectRepository(GameOddsConfig)
    private oddsRepo: Repository<GameOddsConfig>,
    @InjectRepository(VipConfig) private vipRepo: Repository<VipConfig>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(CommissionConfig)
    private commConfigRepo: Repository<CommissionConfig>,
    @InjectRepository(RebateRecord)
    private rebateRepo: Repository<RebateRecord>,
    @InjectRepository(GameFeeConfig) private feeRepo: Repository<GameFeeConfig>,
    @InjectRepository(Popup) private popupRepo: Repository<Popup>,
    @InjectRepository(Activity) private activityRepo: Repository<Activity>,
    @InjectRepository(CheckinConfig)
    private checkinRepo: Repository<CheckinConfig>,
    @InjectRepository(RechargeAward)
    private rechargeAwardRepo: Repository<RechargeAward>,
    @InjectRepository(RankConfig)
    private rankConfigRepo: Repository<RankConfig>,
    @InjectRepository(Avatar) private avatarRepo: Repository<Avatar>,
    @InjectRepository(WageRecord) private wageRepo: Repository<WageRecord>,
    @InjectRepository(AgentCommission)
    private agentCommRepo: Repository<AgentCommission>,
    @InjectRepository(CdkeyCode) private cdkeyRepo: Repository<CdkeyCode>,
    @InjectRepository(ShareConfig)
    private shareConfigRepo: Repository<ShareConfig>,
    @InjectRepository(TransactionType)
    private txnTypeRepo: Repository<TransactionType>,
    @InjectRepository(GameProvider)
    private gameProviderRepo: Repository<GameProvider>,
    @InjectRepository(RaceRunnerFrame)
    private raceFrameRepo: Repository<RaceRunnerFrame>,
    @InjectRepository(PaymentGateway)
    private payGatewayRepo: Repository<PaymentGateway>,
    private dataSource: DataSource,
    private spaWsService: SpaWsService,
    private audit: AdminAuditService,
    private content: AdminContentService,
    private reports: AdminReportsService,
    private system: AdminSystemService,
    private scheduler: SchedulerService,
    private config: AdminConfigService,
    private rewardConfig: AdminRewardConfigService,
    private presentation: AdminPresentationService,
    private games: AdminGameService,
    private gameConfig: AdminGameConfigService,
    private auth: AdminAuthService,
    private users: AdminUsersService,
    private operations: AdminOperationsService,
    private finance: AdminFinanceService,
    private lotteryManagement: AdminLotteryManagementService,
    private lotteryDraw: AdminLotteryDrawService,
    private lotteryReporting: AdminLotteryReportingService,
    private fcm: FcmService,
    private appVersion: AppVersionService,
  ) {}

  async login(username: string, password: string) {
    return this.auth.login(username, password);
  }

  async getDashboard(range: { startDate?: string; endDate?: string }) {
    return this.reports.getDashboard(range);
  }

  async getUsers(dto: { pageNo: number; pageSize: number; search?: string }) {
    return this.users.getUsers(dto);
  }

  async createUser(dto: CreateUserDto, adminId: number) {
    return this.users.createUser(dto, adminId);
  }

  async updateUser(userId: string, data: UpdateUserDto, adminId: number) {
    return this.users.updateUser(userId, data, adminId);
  }

  async deleteUser(userId: string, adminId: number) {
    return this.users.deleteUser(userId, adminId);
  }

  async setUserPassword(userId: string, newPassword: string, adminId: number) {
    return this.users.setUserPassword(userId, newPassword, adminId);
  }

  async adjustBalance(
    userId: string,
    amount: number,
    type: 'add' | 'subtract',
    adminId: number,
  ) {
    return this.users.adjustBalance(userId, amount, type, adminId);
  }

  async getUserDetail(userId: string) {
    return this.users.getUserDetail(userId);
  }

  async getUserBets(userId: string, dto: UserBetsQuery) {
    return this.users.getUserBets(userId, dto);
  }

  async getUserTransactions(userId: string, dto: UserTransactionsQuery) {
    return this.users.getUserTransactions(userId, dto);
  }

  async getUserTransfers(userId: string, dto: UserTransfersQuery) {
    return this.users.getUserTransfers(userId, dto);
  }

  async getUserReferrals(userId: string) {
    return this.users.getUserReferrals(userId);
  }

  async getGames(dto: {
    pageNo: number;
    pageSize: number;
    search?: string;
    gameType?: string;
    status?: number;
    category?: string;
  }) {
    return this.games.getGames(dto);
  }

  async getGameOptions(dto: GameOptionsQuery) {
    return this.games.getGameOptions(dto);
  }

  async createGame(data: GameMutationInput, adminId: number) {
    return this.games.createGame(data, adminId);
  }

  async updateGame(id: number, data: GameMutationInput, adminId: number) {
    return this.games.updateGame(id, data, adminId);
  }

  async getGameDetail(id: number) {
    return this.games.getGameDetail(id);
  }

  async getGameStats(id: number, dto: { startDate: string; endDate: string }) {
    return this.games.getGameStats(id, dto);
  }

  async getGameRounds(dto: GameRoundsListQuery) {
    return this.games.getGameRounds(dto);
  }

  async getOrders(dto: OrdersListQuery) {
    return this.operations.getOrders(dto);
  }

  async getBanners() {
    return this.content.getBanners();
  }

  async createBanner(data: Partial<Banner>, adminId: number) {
    return this.content.createBanner(data, adminId);
  }

  async updateBanner(id: number, data: Partial<Banner>, adminId: number) {
    return this.content.updateBanner(id, data, adminId);
  }

  async deleteBanner(id: number, adminId: number) {
    return this.content.deleteBanner(id, adminId);
  }

  async getAnnouncements() {
    return this.content.getAnnouncements();
  }

  async createAnnouncement(data: Partial<Announcement>, adminId: number) {
    return this.content.createAnnouncement(data, adminId);
  }

  async updateAnnouncement(
    id: number,
    data: Partial<Announcement>,
    adminId: number,
  ) {
    return this.content.updateAnnouncement(id, data, adminId);
  }

  async deleteAnnouncement(id: number, adminId: number) {
    return this.content.deleteAnnouncement(id, adminId);
  }

  async getRechargeRecords(dto: {
    pageNo: number;
    pageSize: number;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<RechargeRecordListResult> {
    return this.finance.getRechargeRecords(dto);
  }

  streamRechargeCsv(
    res: Response,
    dto: {
      status?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    return this.finance.streamRechargeCsv(res, dto);
  }

  async approveRecharge(orderNo: string, adminId: number) {
    return this.finance.approveRecharge(orderNo, adminId);
  }

  async getWithdrawRecords(dto: {
    pageNo: number;
    pageSize: number;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<WithdrawRecordListResult> {
    return this.finance.getWithdrawRecords(dto);
  }

  streamWithdrawCsv(
    res: Response,
    dto: {
      status?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    return this.finance.streamWithdrawCsv(res, dto);
  }

  async approveWithdraw(orderNo: string, adminId: number) {
    return this.finance.approveWithdraw(orderNo, adminId);
  }

  async rejectWithdraw(orderNo: string, adminId: number, remark: string) {
    return this.finance.rejectWithdraw(orderNo, adminId, remark);
  }

  async getThirdPartyTransactions(dto: ThirdPartyTransactionQuery) {
    return this.finance.getThirdPartyTransactions(dto);
  }

  async getConfigs() {
    return this.config.getConfigs();
  }

  async setConfig(
    key: string,
    value: string,
    description: string | undefined,
    adminId: number,
  ) {
    return this.config.setConfig(key, value, description, adminId);
  }

  async getDraws(dto: {
    gameId?: number;
    gameType?: string;
    status?: number;
    pageNo: number;
    pageSize: number;
    startDate?: string;
    endDate?: string;
  }) {
    return this.lotteryManagement.getDraws(dto);
  }

  async triggerDraw(roundId: number, adminId: number) {
    return this.lotteryDraw.triggerDraw(roundId, adminId);
  }

  async setDrawResult(roundId: number, result: DrawResult, adminId: number) {
    return this.lotteryDraw.setDrawResult(roundId, result, adminId);
  }

  async cancelRound(roundId: number, adminId: number) {
    return this.lotteryDraw.cancelRound(roundId, adminId);
  }

  async retrySettlement(roundId: number, adminId: number) {
    return this.lotteryDraw.retrySettlement(roundId, adminId);
  }

  async getOddsConfig(gameId: number) {
    return this.gameConfig.getOddsConfig(gameId);
  }

  async updateOddsConfig(
    gameId: number,
    odds: OddsUpdateInput[],
    adminId: number,
  ) {
    return this.gameConfig.updateOddsConfig(gameId, odds, adminId);
  }

  async deleteOddsEntry(gameId: number, id: number, adminId: number) {
    return this.gameConfig.deleteOddsEntry(gameId, id, adminId);
  }

  async getGameSchedule(gameId: number) {
    return this.gameConfig.getGameSchedule(gameId);
  }

  async updateGameSchedule(gameId: number, config: any, adminId: number) {
    return this.gameConfig.updateGameSchedule(gameId, config, adminId);
  }

  async getCashrainWindows(gameId: number) {
    return this.gameConfig.getCashrainWindows(gameId);
  }

  async saveCashrainWindows(
    gameId: number,
    windows: {
      dayStart?: number;
      dayEnd?: number;
      startMinute: number;
      endMinute: number;
      maxClaimsPerUser?: number;
      status?: number;
    }[],
    adminId: number,
  ) {
    return this.gameConfig.saveCashrainWindows(gameId, windows, adminId);
  }

  async cloneGame(id: number, adminId: number) {
    return this.games.cloneGame(id, adminId);
  }

  async getVipConfigs() {
    return this.rewardConfig.getVipConfigs();
  }

  async upsertVipConfig(data: Record<string, unknown>, adminId: number) {
    return this.rewardConfig.upsertVipConfig(data, adminId);
  }

  async deleteVipConfig(id: number, adminId: number) {
    return this.rewardConfig.deleteVipConfig(id, adminId);
  }

  async getCommissionConfigs() {
    return this.rewardConfig.getCommissionConfigs();
  }

  async upsertCommissionConfig(
    data: Partial<CommissionConfig>,
    adminId: number,
  ) {
    return this.rewardConfig.upsertCommissionConfig(data, adminId);
  }

  async deleteCommissionConfig(id: number, adminId: number) {
    return this.rewardConfig.deleteCommissionConfig(id, adminId);
  }

  async getAuditLogs(dto: {
    pageNo: number;
    pageSize: number;
    adminId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.audit.getAuditLogs(dto);
  }

  async createAuditLog(
    adminId: number,
    action: string,
    targetType: string,
    targetId: string,
    details?: unknown,
  ) {
    return this.audit.createAuditLog(
      adminId,
      action,
      targetType,
      targetId,
      details,
    );
  }

  async getMessages(dto: {
    pageNo: number;
    pageSize: number;
    search?: string;
    type?: string;
  }) {
    return this.operations.getMessages(dto);
  }

  async createMessage(data: CreateMessageDto, adminId: number) {
    return this.operations.createMessage(data, adminId);
  }

  async deleteMessage(id: number, adminId: number) {
    return this.operations.deleteMessage(id, adminId);
  }

  async bulkDeleteMessages(ids: number[], adminId: number) {
    return this.operations.bulkDeleteMessages(ids, adminId);
  }

  async getAdminById(id: number) {
    return this.auth.getAdminById(id);
  }

  async getAdminUsers(dto: { pageNo: number; pageSize: number }) {
    return this.auth.getAdminUsers(dto);
  }

  async createAdminUser(
    data: {
      username: string;
      password: string;
      displayName: string;
      role: string;
    },
    adminId: number,
  ) {
    return this.auth.createAdminUser(data, adminId);
  }

  async updateAdminUser(id: number, data: UpdateAdminUserDto, adminId: number) {
    return this.auth.updateAdminUser(id, data, adminId);
  }

  async deleteAdminUser(id: number, adminId: number) {
    return this.auth.deleteAdminUser(id, adminId);
  }

  async getRevenueReport(dto: {
    startDate: string;
    endDate: string;
    gameType?: string;
  }) {
    return this.reports.getRevenueReport(dto);
  }

  async getUserReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getUserReport(dto);
  }

  async getGameReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getGameReport(dto);
  }

  async getDashboardEnhanced() {
    return this.reports.getDashboardEnhanced();
  }

  async getLotteryReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getLotteryReport(dto);
  }

  streamLotteryOrdersCsv(
    res: Response,
    dto: { startDate: string; endDate: string; gameType?: string },
  ) {
    return this.reports.streamLotteryOrdersCsv(res, dto);
  }

  async getPaymentReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getPaymentReport(dto);
  }

  async getManualPaymentReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getManualPaymentReport(dto);
  }

  async getOverallReport(dto: { startDate: string; endDate: string }) {
    return this.reports.getOverallReport(dto);
  }

  async getRebateRecords(dto: {
    pageNo: number;
    pageSize: number;
    userId?: string;
    dateKey?: string;
  }) {
    return this.finance.getRebateRecords(dto);
  }

  async getGameFeeConfig(gameId: number) {
    return this.gameConfig.getGameFeeConfig(gameId);
  }

  async upsertGameFeeConfig(
    gameId: number,
    dto: {
      feeType: string;
      feeRate: number;
      fixedFee?: number;
      gameType?: string;
    },
    adminId: number,
  ) {
    return this.gameConfig.upsertGameFeeConfig(gameId, dto, adminId);
  }

  async deleteGameFeeConfig(gameId: number, id: number, adminId: number) {
    return this.gameConfig.deleteGameFeeConfig(gameId, id, adminId);
  }

  async setGameControl(
    gameId: number,
    field: 'isPaused' | 'isHidden' | 'emergencyStop',
    value: number,
    adminId: number,
  ) {
    return this.games.setGameControl(gameId, field, value, adminId);
  }

  async getGameCategories() {
    return this.games.getGameCategories();
  }

  async setGameCategoryControl(
    categoryId: number,
    field: GameCategoryControlField,
    value: TinyFlag,
    adminId: number,
  ) {
    return this.games.setGameCategoryControl(categoryId, field, value, adminId);
  }

  async emergencyStop(gameId: number, adminId: number) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let cancelledRounds = 0;
    let refundedOrders = 0;

    try {
      await queryRunner.manager.update(GameList, gameId, { emergencyStop: 1 });

      const openRounds = await queryRunner.manager.find(GameRound, {
        where: { gameId, status: 0 },
      });

      for (const round of openRounds) {
        await queryRunner.manager.update(GameRound, round.id, { status: 3 });
        cancelledRounds++;

        const pendingOrders = await queryRunner.manager.find(Order, {
          where: { gameId, roundNo: round.roundNo, status: 0 },
        });

        for (const order of pendingOrders) {
          await queryRunner.manager.update(Order, order.id, { status: 3 });

          if (order.isBonus) {
            await queryRunner.manager
              .createQueryBuilder()
              .update(User)
              .set({
                bonusBalance: () =>
                  `bonus_balance + ${Number(order.totalAmount)}`,
              })
              .where('user_id = :userId', { userId: order.userId })
              .execute();
          } else {
            await queryRunner.manager
              .createQueryBuilder()
              .update(User)
              .set({ balance: () => `balance + ${Number(order.totalAmount)}` })
              .where('user_id = :userId', { userId: order.userId })
              .execute();
          }

          const updatedUser = await queryRunner.manager.findOne(User, {
            where: { userId: order.userId },
          });
          if (!updatedUser) {
            throw new Error(`User ${order.userId} not found during refund`);
          }
          await queryRunner.manager.save(
            Transaction,
            queryRunner.manager.create(Transaction, {
              userId: order.userId,
              sourceType: 'refund',
              amount: Number(order.totalAmount),
              balance: Number(updatedUser.balance),
              refId: order.orderNo,
              description: `Emergency stop refund`,
            }),
          );
          refundedOrders++;
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.createAuditLog(
      adminId,
      'emergency_stop',
      'game',
      String(gameId),
      { gameName: game.gameName, cancelledRounds, refundedOrders },
    );

    return { success: true, cancelledRounds, refundedOrders };
  }

  async updateGameCycle(
    gameId: number,
    dto: {
      drawInterval?: number;
      roundDuration?: number;
      stopBetBefore?: number;
      autoGenerate?: boolean;
    },
    adminId: number,
  ) {
    return this.games.updateGameCycle(gameId, dto, adminId);
  }

  async rejectRecharge(orderNo: string, adminId: number, remark: string) {
    return this.finance.rejectRecharge(orderNo, adminId, remark);
  }

  async deleteConfig(id: number, adminId: number) {
    return this.config.deleteConfig(id, adminId);
  }

  async getPopups() {
    return this.content.getPopups();
  }

  async upsertPopup(data: Partial<Popup>, adminId: number) {
    return this.content.upsertPopup(data, adminId);
  }

  async deletePopup(id: number, adminId: number) {
    return this.content.deletePopup(id, adminId);
  }

  async getActivities() {
    return this.content.getActivities();
  }

  async upsertActivity(data: Partial<Activity>, adminId: number) {
    return this.content.upsertActivity(data, adminId);
  }

  async deleteActivity(id: number, adminId: number) {
    return this.content.deleteActivity(id, adminId);
  }

  async getCheckinConfig() {
    return this.content.getCheckinConfig();
  }

  getCheckinRecords() {
    return this.content.getCheckinRecords();
  }

  async upsertCheckinConfig(data: Partial<CheckinConfig>, adminId: number) {
    return this.content.upsertCheckinConfig(data, adminId);
  }

  async deleteCheckinConfig(id: number, adminId: number) {
    return this.content.deleteCheckinConfig(id, adminId);
  }

  async deleteGame(id: number, adminId: number) {
    return this.games.deleteGame(id, adminId);
  }

  async getRechargeAwards() {
    return this.rewardConfig.getRechargeAwards();
  }

  async upsertRechargeAward(data: Partial<RechargeAward>, adminId: number) {
    return this.rewardConfig.upsertRechargeAward(data, adminId);
  }

  async deleteRechargeAward(id: number, adminId: number) {
    return this.rewardConfig.deleteRechargeAward(id, adminId);
  }

  async getRankConfigs() {
    return this.rewardConfig.getRankConfigs();
  }

  async upsertRankConfig(data: UpsertRankConfigInput, adminId: number) {
    return this.rewardConfig.upsertRankConfig(data, adminId);
  }

  async deleteRankConfig(id: number, adminId: number) {
    return this.rewardConfig.deleteRankConfig(id, adminId);
  }

  async getAvatars() {
    return this.content.getAvatars();
  }

  async upsertAvatar(data: Partial<Avatar>, adminId: number) {
    return this.content.upsertAvatar(data, adminId);
  }

  async deleteAvatar(id: number, adminId: number) {
    return this.content.deleteAvatar(id, adminId);
  }

  async getSharePosters() {
    return this.content.getSharePosters();
  }

  async upsertSharePoster(data: Partial<SharePoster>, adminId: number) {
    return this.content.upsertSharePoster(data, adminId);
  }

  async deleteSharePoster(id: number, adminId: number) {
    return this.content.deleteSharePoster(id, adminId);
  }

  async getWageRecords(body: {
    pageNo: number;
    pageSize: number;
    search?: string;
    weekKey?: string;
  }) {
    return this.finance.getWageRecords(body);
  }

  async getAgentCommissions(body: {
    pageNo: number;
    pageSize: number;
    search?: string;
    sourceType?: string;
  }) {
    return this.finance.getAgentCommissions(body);
  }

  async getCdkeyCodes() {
    return this.rewardConfig.getCdkeyCodes();
  }

  async upsertCdkeyCode(data: Partial<CdkeyCode>, adminId: number) {
    return this.rewardConfig.upsertCdkeyCode(data, adminId);
  }

  async deleteCdkeyCode(id: number, adminId: number) {
    return this.rewardConfig.deleteCdkeyCode(id, adminId);
  }

  async getShareConfigs() {
    return this.content.getShareConfigs();
  }

  async upsertShareConfig(data: Partial<ShareConfig>, adminId: number) {
    return this.content.upsertShareConfig(data, adminId);
  }

  async deleteShareConfig(id: number, adminId: number) {
    return this.content.deleteShareConfig(id, adminId);
  }

  async getTransactionTypes() {
    return this.config.getTransactionTypes();
  }

  async upsertTransactionType(data: Record<string, any>, adminId: number) {
    return this.config.upsertTransactionType(data, adminId);
  }

  async deleteTransactionType(id: number, adminId: number) {
    return this.config.deleteTransactionType(id, adminId);
  }

  async getLotteryDraws(body: {
    pageNo: number;
    pageSize: number;
    gameId?: number;
    gameType?: string;
    status?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    filterType?: 'auto' | 'manual' | 'pending' | 'closed';
  }) {
    return this.lotteryManagement.getLotteryDraws(body);
  }

  async getLotteryDrawDetail(roundNo: string, gameId?: number) {
    return this.lotteryManagement.getLotteryDrawDetail(roundNo, gameId);
  }

  async getLotteryDrawById(roundId: number) {
    return this.lotteryManagement.getLotteryDrawById(roundId);
  }

  async getLotteryOrders(body: {
    pageNo: number;
    pageSize: number;
    gameId?: number;
    roundNo?: string;
    userId?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
  }) {
    return this.lotteryManagement.getLotteryOrders(body);
  }


  async getBadgeCounts() {
    return this.operations.getBadgeCounts();
  }

  async getGamesLiveStatus() {
    return this.games.getGamesLiveStatus();
  }

  async getGameProviders() {
    return this.presentation.getGameProviders();
  }

  async upsertGameProvider(data: Record<string, any>, adminId: number) {
    return this.presentation.upsertGameProvider(data, adminId);
  }

  async deleteGameProvider(id: number, adminId: number) {
    return this.presentation.deleteGameProvider(id, adminId);
  }

  async getPaymentGateways() {
    return this.presentation.getPaymentGateways();
  }

  async upsertPaymentGateway(data: Record<string, any>, adminId: number) {
    return this.presentation.upsertPaymentGateway(data, adminId);
  }

  async getFinanceConfig() {
    return this.config.getFinanceConfig();
  }

  async saveFinanceConfig(data: Record<string, any>, adminId: number) {
    return this.config.saveFinanceConfig(data, adminId);
  }

  async getAppConfig() {
    return this.config.getAppConfig();
  }

  async saveAppConfig(data: Record<string, any>, adminId: number) {
    return this.config.saveAppConfig(data, adminId);
  }

  async testSmsDelivery(body: TestSmsDto) {
    return this.system.testSmsDelivery(body);
  }

  async testWhatsappDelivery(body: TestWhatsappDto) {
    return this.system.testWhatsappDelivery(body);
  }

  async getAppVersion() {
    return this.appVersion.getConfig();
  }

  async saveAppVersion(data: SaveAppVersionDto, adminId: number) {
    const config = await this.appVersion.setConfig(data);
    await this.audit.createAuditLog(
      adminId,
      'update_app_version',
      'app_version',
      config.version,
      config,
    );
    return config;
  }

  async getFirebaseConfig() {
    return this.fcm.getConfig();
  }

  async saveFirebaseConfig(data: SaveFirebaseConfigDto, adminId: number) {
    const saved = await this.fcm.saveConfig(data);
    await this.audit.createAuditLog(
      adminId,
      'update_firebase_config',
      'firebase_config',
      String(saved.id),
    );
    return saved;
  }

  async getThirdPartyConfig() {
    return this.config.getThirdPartyConfig();
  }

  async saveThirdPartyConfig(data: Record<string, any>, adminId: number) {
    return this.config.saveThirdPartyConfig(data, adminId);
  }

  async getNotificationTemplates() {
    return this.presentation.getNotificationTemplates();
  }

  async saveNotificationTemplate(data: Record<string, any>, adminId: number) {
    return this.presentation.saveNotificationTemplate(data, adminId);
  }

  async getLobbyConfig() {
    return this.presentation.getLobbyConfig();
  }

  async saveLobbyConfig(data: Record<string, any>, adminId: number) {
    return this.presentation.saveLobbyConfig(data, adminId);
  }

  async getUiConfig() {
    return this.presentation.getUiConfig();
  }

  async saveUiConfig(data: Record<string, any>, adminId: number) {
    return this.presentation.saveUiConfig(data, adminId);
  }

  async getShareOddsConfig() {
    return this.presentation.getShareOddsConfig();
  }

  async saveShareOddsConfig(data: Record<string, any>, adminId: number) {
    return this.presentation.saveShareOddsConfig(data, adminId);
  }

  async deletePaymentGateway(id: number, adminId: number) {
    return this.presentation.deletePaymentGateway(id, adminId);
  }

  async getRaceFrames(body: {
    gameId?: number;
    pageNo: number;
    pageSize: number;
  }) {
    return this.games.getRaceFrames(body);
  }

  async getLotteryList() {
    return this.lotteryManagement.getLotteryList();
  }

  async getLotteryOverview(gameId: number) {
    return this.lotteryManagement.getLotteryOverview(gameId);
  }

  async getLotteryPnL(
    gameId: number,
    dto: { startDate: string; endDate: string },
  ) {
    return this.lotteryReporting.getLotteryPnL(gameId, dto);
  }

  async toggleLotteryMode(
    gameId: number,
    autoGenerate: boolean,
    adminId: number,
  ) {
    return this.lotteryManagement.toggleLotteryMode(
      gameId,
      autoGenerate,
      adminId,
    );
  }

  async createLotteryRound(gameId: number, drawTime: string, adminId: number) {
    return this.lotteryManagement.createLotteryRound(gameId, drawTime, adminId);
  }

  async getConfigMeta() {
    return this.config.getConfigMeta();
  }

  async cleanupGameRounds(input: {
    fromDate: string;
    toDate: string;
    dryRun: boolean;
  }) {
    return this.system.cleanupGameRounds(input);
  }

  getCronStatus(): Promise<CronJobStatus[]> {
    return this.scheduler.getStatus();
  }

  updateCronJob(name: string, dto: UpdateCronJobDto): Promise<CronJobStatus> {
    return this.scheduler.updateJob(name, dto);
  }

  async getGameTypes() {
    return this.config.getGameTypes();
  }

  async updateGameUiConfig(gameId: number, uiConfig: any, adminId: number) {
    return this.gameConfig.updateGameUiConfig(gameId, uiConfig, adminId);
  }

  async updateGameRules(gameId: number, rules: any, adminId: number) {
    return this.gameConfig.updateGameRules(gameId, rules, adminId);
  }

  async updateGameResultConfig(
    gameId: number,
    resultConfig: UpdateGameResultConfigDto,
    adminId: number,
  ) {
    return this.gameConfig.updateGameResultConfig(
      gameId,
      resultConfig,
      adminId,
    );
  }

  async getGameConfig(gameId: number) {
    return this.gameConfig.getGameConfig(gameId);
  }

  async getSlatResultReading(
    gameId: number,
    roundId: number,
    drawResult?: string,
  ) {
    return this.gameConfig.getSlatResultReading(gameId, roundId, drawResult);
  }

  async saveGameConfig(gameId: number, payload: any, adminId: number) {
    return this.gameConfig.saveGameConfig(gameId, payload, adminId);
  }

  async getDigitPositionConfig() {
    return this.games.getDigitPositionConfig();
  }

  async getGroupedConfigs() {
    return this.config.getGroupedConfigs();
  }

  async bulkUpdateConfigs(
    updates: { key: string; value: string }[],
    adminId: number,
  ) {
    return this.config.bulkUpdateConfigs(updates, adminId);
  }

  async getDrawAnalysis(roundId: number) {
    return this.lotteryDraw.getDrawAnalysis(roundId);
  }

  async previewDrawResult(roundId: number, proposedResult: DrawResult) {
    return this.lotteryDraw.previewDrawResult(roundId, proposedResult);
  }

  async getDrawRecommendations(roundId: number) {
    return this.lotteryDraw.getDrawRecommendations(roundId);
  }

  async getResultDecisions(dto: {
    gameId?: number;
    mode?: string;
    pageNo?: number;
    pageSize?: number;
  }) {
    return this.lotteryDraw.getResultDecisions(dto);
  }

  async confirmDrawResult(
    roundId: number,
    drawResult: DrawResult,
    adminId: number,
  ) {
    return this.lotteryDraw.confirmDrawResult(roundId, drawResult, adminId);
  }

  async proposeDrawResult(
    roundId: number,
    adminId: number,
    body?: { result?: DrawResult; mode?: string },
  ) {
    return this.lotteryDraw.proposeDrawResult(roundId, adminId, body);
  }

  async approveDrawResult(
    roundId: number,
    adminId: number,
    overrideResult?: DrawResult,
  ) {
    return this.lotteryDraw.approveDrawResult(roundId, adminId, overrideResult);
  }
}
