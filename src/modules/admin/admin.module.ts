import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminSystemService } from './services/admin-system.service';
import { SchedulerService } from './services/scheduler.service';
import { AdminConfigService } from './services/admin-config.service';
import { AdminRewardConfigService } from './services/admin-reward-config.service';
import { AdminPresentationService } from './services/admin-presentation.service';
import { AdminGameService } from './services/admin-game.service';
import { AdminGameConfigService } from './services/admin-game-config.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminOperationsService } from './services/admin-operations.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminLotteryManagementService } from './services/admin-lottery-management.service';
import { AdminLotteryDrawService } from './services/admin-lottery-draw.service';
import { AdminLotteryReportingService } from './services/admin-lottery-reporting.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { User } from '../../entities/user.entity';
import { GameList } from '../../entities/game-list.entity';
import { CashrainWindow } from '../../entities/cashrain-window.entity';
import { GameRound } from '../../entities/game-round.entity';
import { Order } from '../../entities/order.entity';
import { ResultDecision } from '../../entities/result-decision.entity';
import { Banner } from '../../entities/banner.entity';
import { Announcement } from '../../entities/announcement.entity';
import { SystemConfig } from '../../entities/system-config.entity';
import { RechargeRecord } from '../../entities/recharge-record.entity';
import { WithdrawalRecord } from '../../entities/withdrawal-record.entity';
import { BankCard } from '../../entities/bank-card.entity';
import { Transaction } from '../../entities/transaction.entity';
import { GameOddsConfig } from '../../entities/game-odds-config.entity';
import { VipConfig } from '../../entities/vip-config.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CommissionConfig } from '../../entities/commission-config.entity';
import { RebateRecord } from '../../entities/rebate-record.entity';
import { Message } from '../../entities/message.entity';
import { MessageImage } from '../../entities/message-image.entity';
import { MessageRead } from '../../entities/message-read.entity';
import { GameFeeConfig } from '../../entities/game-fee-config.entity';
import { Popup } from '../../entities/popup.entity';
import { Activity } from '../../entities/activity.entity';
import { CheckinConfig } from '../../entities/checkin-config.entity';
import { CheckinRecord } from '../../entities/checkin-record.entity';
import { RechargeAward } from '../../entities/recharge-award.entity';
import { RankConfig } from '../../entities/rank-config.entity';
import { Avatar } from '../../entities/avatar.entity';
import { SharePoster } from '../../entities/share-poster.entity';
import { WageRecord } from '../../entities/wage-record.entity';
import { AgentCommission } from '../../entities/agent-commission.entity';
import { CdkeyCode } from '../../entities/cdkey-code.entity';
import { ShareConfig } from '../../entities/share-config.entity';
import { TransactionType } from '../../entities/transaction-type.entity';
import { LotteryDrawDetail } from '../../entities/lottery-draw-detail.entity';
import { GameProvider } from '../../entities/game-provider.entity';
import { RaceRunnerFrame } from '../../entities/race-runner-frame.entity';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { PaymentGatewayMethod } from '../../entities/payment-gateway-method.entity';
import { RankConfigPrize } from '../../entities/rank-config-prize.entity';
import { FinanceConfig } from '../../entities/finance-config.entity';
import { RechargePreset } from '../../entities/recharge-preset.entity';
import { TransferTier } from '../../entities/transfer-tier.entity';
import { TransferRecord } from '../../entities/transfer-record.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { NotificationTemplate } from '../../entities/notification-template.entity';
import { LobbySection } from '../../entities/lobby-section.entity';
import { LobbyProvider } from '../../entities/lobby-provider.entity';
import { LobbyConfig } from '../../entities/lobby-config.entity';
import { UiConfig } from '../../entities/ui-config.entity';
import { UiColorMap } from '../../entities/ui-color-map.entity';
import { UiStatusMap } from '../../entities/ui-status-map.entity';
import { UiState } from '../../entities/ui-state.entity';
import { UiPosition } from '../../entities/ui-position.entity';
import { UiPayRate } from '../../entities/ui-pay-rate.entity';
import { UiMysteryBoxGradient } from '../../entities/ui-mystery-box-gradient.entity';
import { UiResultTab } from '../../entities/ui-result-tab.entity';
import { ShareChannel } from '../../entities/share-channel.entity';
import { OddsAlias } from '../../entities/odds-alias.entity';
import { ThirdPartyConfig } from '../../entities/third-party-config.entity';
import { ThirdPartyTransaction } from '../../entities/third-party-transaction.entity';
import { CronJobConfig } from '../../entities/cron-job.entity';
import { WsModule } from '../websocket/ws.module';
import { PaymentModule } from '../payment/payment.module';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { AppVersionModule } from '../app-version/app-version.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      User,
      GameList,
      CashrainWindow,
      GameRound,
      Order,
      ResultDecision,
      Banner,
      Announcement,
      SystemConfig,
      RechargeRecord,
      WithdrawalRecord,
      BankCard,
      Transaction,
      GameOddsConfig,
      VipConfig,
      AuditLog,
      CommissionConfig,
      RebateRecord,
      Message,
      MessageImage,
      MessageRead,
      GameFeeConfig,
      Popup,
      Activity,
      CheckinConfig,
      CheckinRecord,
      RechargeAward,
      RankConfig,
      Avatar,
      SharePoster,
      WageRecord,
      AgentCommission,
      CdkeyCode,
      ShareConfig,
      TransactionType,
      GameProvider,
      RaceRunnerFrame,
      PaymentGateway,
      LotteryDrawDetail,
      PaymentGatewayMethod,
      RankConfigPrize,
      FinanceConfig,
      RechargePreset,
      TransferTier,
      TransferRecord,
      AppConfig,
      NotificationTemplate,
      LobbySection,
      LobbyProvider,
      LobbyConfig,
      UiConfig,
      UiColorMap,
      UiStatusMap,
      UiState,
      UiPosition,
      UiPayRate,
      UiMysteryBoxGradient,
      UiResultTab,
      ShareChannel,
      OddsAlias,
      ThirdPartyConfig,
      ThirdPartyTransaction,
      CronJobConfig,
    ]),
    WsModule,
    PaymentModule,
    AuthModule,
    FcmModule,
    AppVersionModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminAuditService,
    AdminContentService,
    AdminReportsService,
    AdminSystemService,
    SchedulerService,
    AdminConfigService,
    AdminRewardConfigService,
    AdminPresentationService,
    AdminGameService,
    AdminGameConfigService,
    AdminAuthService,
    AdminUsersService,
    AdminOperationsService,
    AdminFinanceService,
    AdminLotteryManagementService,
    AdminLotteryDrawService,
    AdminLotteryReportingService,
  ],
})
export class AdminModule {}
