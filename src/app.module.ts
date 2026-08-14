import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { databaseConfig } from './config/database.config';
import { appConfig } from './config/app.config';
import { throttleConfig } from './common/throttle/throttle.config';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GameInfoCacheInterceptor } from './common/interceptors/game-info-cache.interceptor';
import { FcmTokenHeaderInterceptor } from './common/interceptors/fcm-token-header.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AdminModule } from './modules/admin/admin.module';
import { WsModule } from './modules/websocket/ws.module';
import { RaceModule } from './modules/game/race/race.module';
import { DiceModule } from './modules/game/dice/dice.module';
import { ColorModule } from './modules/game/color/color.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ActivityModule } from './modules/activity/activity.module';
import { MysteryBoxModule } from './modules/game/mystery-box/mystery-box.module';
import { LuckySpinModule } from './modules/game/lucky-spin/lucky-spin.module';
import { ThreeDigitModule } from './modules/game/three-digit/three-digit.module';
import { FourFiveDigitModule } from './modules/game/four-five-digit/four-five-digit.module';
import { CashRainModule } from './modules/game/cash-rain/cash-rain.module';
import { DubaiModule } from './modules/game/dubai/dubai.module';
import { KeralaModule } from './modules/game/kerala/kerala.module';
import { RankModule } from './modules/rank/rank.module';
import { SharedGameModule } from './modules/game/shared/shared-game.module';
import { ConfigModule } from './modules/config/config.module';
import { CommonModule } from './common/common.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UploadModule } from './modules/upload/upload.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ThirdPartyModule } from './modules/third-party/third-party.module';
import { FcmModule } from './modules/fcm/fcm.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig()),
    JwtModule.register({
      global: true,
      secret: appConfig().jwt.secret,
      signOptions: { expiresIn: appConfig().jwt.expiresIn },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttleConfig),
    CommonModule,
    ConfigModule,
    RbacModule,
    SharedGameModule,
    AuthModule,
    UserModule,
    FinanceModule,
    AdminModule,
    WsModule,
    RaceModule,
    DiceModule,
    ColorModule,
    OperationsModule,
    ActivityModule,
    MysteryBoxModule,
    LuckySpinModule,
    ThreeDigitModule,
    FourFiveDigitModule,
    CashRainModule,
    DubaiModule,
    KeralaModule,
    RankModule,
    UploadModule,
    PaymentModule,
    ReportsModule,
    ThirdPartyModule,
    FcmModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GameInfoCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: FcmTokenHeaderInterceptor },
  ],
})
export class AppModule {}
