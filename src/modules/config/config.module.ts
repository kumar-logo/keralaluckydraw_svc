import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from '../../entities/system-config.entity';
import { FinanceConfig } from '../../entities/finance-config.entity';
import { RechargePreset } from '../../entities/recharge-preset.entity';
import { AppConfig } from '../../entities/app-config.entity';
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
import { ConfigLoaderService } from './config-loader.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfig,
      FinanceConfig,
      RechargePreset,
      AppConfig,
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
    ]),
  ],
  providers: [ConfigLoaderService],
  exports: [ConfigLoaderService],
})
export class ConfigModule {}
