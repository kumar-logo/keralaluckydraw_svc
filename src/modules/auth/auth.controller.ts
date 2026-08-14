import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ThrottleProfile,
  OTP_SEND_LIMIT,
  OTP_VERIFY_LIMIT,
  LOGIN_LIMIT,
} from '../../common/throttle/throttle.config';
import {
  RegisterDto,
  LoginPasswordDto,
  LoginSmsDto,
  LoginGoogleDto,
  LoginTelegramDto,
  SendSmsDto,
  UpdatePasswordDto,
  ResetPasswordDto,
} from './dto';

@Controller('hall/api/usr/v1')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('info/register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Throttle({ [ThrottleProfile.Default]: LOGIN_LIMIT })
  @HttpCode(200)
  @Post('info/login/password')
  loginByPassword(@Body() body: LoginPasswordDto) {
    return this.authService.loginByPassword(body);
  }

  @Public()
  @Throttle({ [ThrottleProfile.Default]: OTP_VERIFY_LIMIT })
  @HttpCode(200)
  @Post('info/login/sms')
  loginBySms(@Body() body: LoginSmsDto) {
    return this.authService.loginBySms(body);
  }

  @Public()
  @HttpCode(200)
  @Post('info/login/tg')
  loginByTelegram(@Body() body: LoginTelegramDto) {
    return this.authService.loginByTelegram(body);
  }

  @Public()
  @Throttle({ [ThrottleProfile.Default]: LOGIN_LIMIT })
  @HttpCode(200)
  @Post('info/login/google')
  loginByGoogle(@Body() body: LoginGoogleDto) {
    return this.authService.loginByGoogle(body);
  }

  @HttpCode(200)
  @Post('info/update/password')
  updatePassword(
    @CurrentUser('userId') userId: string,
    @Body() body: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(userId, body);
  }

  @Public()
  @Throttle({ [ThrottleProfile.Default]: OTP_VERIFY_LIMIT })
  @HttpCode(200)
  @Post('info/reset/password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Public()
  @Throttle({ [ThrottleProfile.Default]: OTP_SEND_LIMIT })
  @HttpCode(200)
  @Post('sms/send')
  sendSms(
    @CurrentUser('userId') userId: string | undefined,
    @Body() body: SendSmsDto,
  ) {
    return this.authService.sendSms(body.phone, body.purpose, userId);
  }
}
