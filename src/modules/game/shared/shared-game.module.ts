import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameList } from '../../../entities/game-list.entity';
import { GameRound } from '../../../entities/game-round.entity';
import { Order } from '../../../entities/order.entity';
import { User } from '../../../entities/user.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { GameOddsConfig } from '../../../entities/game-odds-config.entity';
import { RaceRunnerFrame } from '../../../entities/race-runner-frame.entity';
import { ResultDecision } from '../../../entities/result-decision.entity';
import { GameRaceConfig } from '../../../entities/game-race-config.entity';
import { GameKeralaConfig } from '../../../entities/game-kerala-config.entity';
import { GamePunjabConfig } from '../../../entities/game-punjab-config.entity';
import { GameBoxConfig } from '../../../entities/game-box-config.entity';
import { GameWheelConfig } from '../../../entities/game-wheel-config.entity';
import { GamePick4Config } from '../../../entities/game-pick4-config.entity';
import { GameLobbyPlacement } from '../../../entities/game-lobby-placement.entity';
import { GameNumberPrefix } from '../../../entities/game-number-prefix.entity';
import { GamePrizeTier } from '../../../entities/game-prize-tier.entity';
import { GameBoxItem } from '../../../entities/game-box-item.entity';
import { GameWheelSegment } from '../../../entities/game-wheel-segment.entity';
import { GamePickTime } from '../../../entities/game-pick-time.entity';
import { GamePickInfo } from '../../../entities/game-pick-info.entity';
import { GamePickWinAmount } from '../../../entities/game-pick-win-amount.entity';
import { GamePickPrize } from '../../../entities/game-pick-prize.entity';
import { GameDailyReward } from '../../../entities/game-daily-reward.entity';
import { GameRuleSection } from '../../../entities/game-rule-section.entity';
import { GameColorPalette } from '../../../entities/game-color-palette.entity';
import { GameNumberColor } from '../../../entities/game-number-color.entity';
import { GamePositionColor } from '../../../entities/game-position-color.entity';
import { GameRaceRunner } from '../../../entities/game-race-runner.entity';
import { GameAsset } from '../../../entities/game-asset.entity';
import { GameSlatProduct } from '../../../entities/game-slat-product.entity';
import { GameSlatTier } from '../../../entities/game-slat-tier.entity';
import { GameFeeConfig } from '../../../entities/game-fee-config.entity';
import { GamePayoutLedger } from '../../../entities/game-payout-ledger.entity';
import { GameEngineService } from './game-engine.service';
import { GameConfigService } from './game-config.service';
import { SettlementService } from './settlement.service';
import { GameSchedulerService } from './game-scheduler.service';
import { RoundProgressionService } from './round-progression.service';
import { RaceFrameSchedulerService } from './race-frame-scheduler.service';
import { DrawAnalysisService } from './draw-analysis.service';
import { OddsService } from './odds.service';
import { ResultEngineService } from './result-engine.service';
import { ProfitGuardService } from './profit-guard.service';
import { RoundCleanupService } from './round-cleanup.service';
import { GAME_MECHANIC } from './mechanics/mechanic.types';
import { ALL_MECHANICS } from './mechanics';
import { WsModule } from '../../websocket/ws.module';
import { CronModule } from '../../cron/cron.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameList,
      GameRound,
      Order,
      User,
      Transaction,
      GameOddsConfig,
      RaceRunnerFrame,
      ResultDecision,
      GameRaceConfig,
      GameKeralaConfig,
      GamePunjabConfig,
      GameBoxConfig,
      GameWheelConfig,
      GamePick4Config,
      GameLobbyPlacement,
      GameNumberPrefix,
      GamePrizeTier,
      GameBoxItem,
      GameWheelSegment,
      GamePickTime,
      GamePickInfo,
      GamePickWinAmount,
      GamePickPrize,
      GameDailyReward,
      GameRuleSection,
      GameColorPalette,
      GameNumberColor,
      GamePositionColor,
      GameRaceRunner,
      GameAsset,
      GameSlatProduct,
      GameSlatTier,
      GameFeeConfig,
      GamePayoutLedger,
    ]),
    WsModule,
    CronModule,
  ],
  providers: [
    GameEngineService,
    GameConfigService,
    SettlementService,
    GameSchedulerService,
    RoundProgressionService,
    RaceFrameSchedulerService,
    DrawAnalysisService,
    OddsService,
    ResultEngineService,
    ProfitGuardService,
    RoundCleanupService,
    { provide: GAME_MECHANIC, useValue: ALL_MECHANICS },
  ],
  exports: [
    GameEngineService,
    GameConfigService,
    SettlementService,
    GameSchedulerService,
    DrawAnalysisService,
    OddsService,
    ResultEngineService,
    ProfitGuardService,
    RoundCleanupService,
  ],
})
export class SharedGameModule {}
