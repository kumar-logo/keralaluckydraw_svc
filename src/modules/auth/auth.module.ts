import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { User } from '../../entities/user.entity';
import { SmsCode } from '../../entities/sms-code.entity';
import { NotificationTemplate } from '../../entities/notification-template.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { appConfig } from '../../config/app.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SmsCode, NotificationTemplate, AppConfig]),
    JwtModule.register({
      global: true,
      secret: appConfig().jwt.secret,
      signOptions: { expiresIn: appConfig().jwt.expiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
