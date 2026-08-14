import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../entities/user.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { OtpService } from './otp.service';
import { OtpPurpose } from './otp-purpose.enum';
import { LoginTelegramDto } from './dto';

interface TelegramUser {
  id: number;
  first_name?: string;
}

interface GoogleTokenInfo {
  aud: string;
  exp: string;
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AppConfig) private appConfigRepo: Repository<AppConfig>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async register(dto: {
    phone: string;
    smsCode?: string;
    password: string;
    inviteCode?: string;
  }) {
    await this.otpService.verifyOtp(dto.phone, dto.smsCode, OtpPurpose.Login);

    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new BadRequestException('This phone number is already registered');
    }

    const user = await this.createPhoneUser(dto);
    const token = await this.generateToken(user);
    return { token, isRegister: true };
  }

  private async createPhoneUser(dto: {
    phone: string;
    password?: string;
    inviteCode?: string;
  }): Promise<User> {
    const userId = this.generateUserId();
    const user = this.userRepo.create({
      userId,
      phone: dto.phone,
      passwordHash: dto.password
        ? await bcrypt.hash(dto.password, 10)
        : undefined,
      nickname: `User${dto.phone.slice(-4)}`,
      inviteCode: await this.generateInviteCode(),
      invitedBy: this.normalizeInvite(dto.inviteCode),
    });
    await this.userRepo.save(user);
    return user;
  }

  private normalizeInvite(inviteCode: string | undefined): string | undefined {
    if (inviteCode === undefined || inviteCode.length === 0) return undefined;
    return inviteCode;
  }

  async loginByPassword(dto: { phone: string; password: string }) {
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'userId', 'phone', 'passwordHash', 'status'],
    });
    if (!user) throw new BadRequestException('Invalid phone or password');
    if (user.status === 0) throw new BadRequestException('Account disabled');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Password login is not set for this account, please use OTP login',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new BadRequestException('Invalid phone or password');

    const token = await this.generateToken(user);
    return { token, isRegister: false };
  }

  async loginBySms(dto: {
    phone: string;
    smsCode?: string;
    inviteCode?: string;
  }) {
    if (!(await this.otpService.isOtpEnabled())) {
      throw new BadRequestException('OTP login is not available');
    }
    await this.otpService.verifyOtp(dto.phone, dto.smsCode, OtpPurpose.Login);

    let user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    let isRegister = false;

    if (!user) {
      user = await this.createPhoneUser({
        phone: dto.phone,
        password: '',
        inviteCode: dto.inviteCode,
      });
      isRegister = true;
    }

    if (user.status === 0) throw new BadRequestException('Account disabled');

    const token = await this.generateToken(user);
    return { token, isRegister };
  }

  async loginByTelegram(dto: LoginTelegramDto) {
    const tgUser = await this.verifyTgInitData(dto.initData);

    let user = await this.userRepo.findOne({
      where: { tgId: String(tgUser.id) },
    });
    let isRegister = false;

    if (!user) {
      const userId = this.generateUserId();
      const firstName = tgUser.first_name;
      user = this.userRepo.create({
        userId,
        tgId: String(tgUser.id),
        nickname:
          firstName !== undefined && firstName.length > 0
            ? firstName
            : `TG${tgUser.id}`,
        inviteCode: await this.generateInviteCode(),
        invitedBy: this.normalizeInvite(dto.inviteCode),
      });
      await this.userRepo.save(user);
      isRegister = true;
    }

    if (user.status === 0) throw new BadRequestException('Account disabled');

    const token = await this.generateToken(user);
    return { token, isRegister };
  }

  async loginByGoogle(dto: { idToken: string; inviteCode?: string }) {
    const googleId = await this.verifyGoogleToken(dto.idToken);

    let user = await this.userRepo.findOne({ where: { googleId } });
    let isRegister = false;

    if (!user) {
      const userId = this.generateUserId();
      user = this.userRepo.create({
        userId,
        googleId,
        nickname: `G${googleId.slice(-6)}`,
        inviteCode: await this.generateInviteCode(),
        invitedBy: this.normalizeInvite(dto.inviteCode),
      });
      await this.userRepo.save(user);
      isRegister = true;
    }

    if (user.status === 0) throw new BadRequestException('Account disabled');

    const token = await this.generateToken(user);
    return { token, isRegister };
  }

  async updatePassword(
    userId: string,
    dto: { password: string; smsCode?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new BadRequestException('User not found');
    await this.otpService.verifyOtp(
      user.phone,
      dto.smsCode,
      OtpPurpose.ChangePassword,
    );
    const hash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.update({ userId }, { passwordHash: hash });
  }

  async resetPassword(dto: {
    phone: string;
    smsCode: string;
    password: string;
  }) {
    if (!(await this.otpService.isOtpEnabled())) {
      throw new BadRequestException('Password reset is not available');
    }
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) {
      throw new BadRequestException('No account found for this phone number');
    }
    if (user.status === 0) throw new BadRequestException('Account disabled');
    await this.otpService.verifyOtp(
      dto.phone,
      dto.smsCode,
      OtpPurpose.ResetPassword,
    );
    const hash = await bcrypt.hash(dto.password, 10);
    await this.userRepo.update({ userId: user.userId }, { passwordHash: hash });
    return { reset: true };
  }

  async sendSms(
    phone?: string,
    purpose: string = OtpPurpose.Login,
    userId?: string,
  ) {
    let target = phone;
    if (!target && userId) {
      const user = await this.userRepo.findOne({ where: { userId } });
      if (!user) throw new BadRequestException('User not found');
      target = user.phone;
    }
    if (!target) throw new BadRequestException('Phone number required');
    return this.otpService.requestOtp(target, purpose);
  }

  private async generateToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.userId,
      userId: user.userId,
      phone: user.phone,
    });
  }

  private generateUserId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  private async generateInviteCode(): Promise<string> {
    const prefix = (await this.config()).referralPrefix.trim().slice(0, 12);
    for (let attempt = 0; attempt < 12; attempt++) {
      let digits = '';
      for (let i = 0; i < 7; i++)
        digits += Math.floor(Math.random() * 10).toString();
      const code = `${prefix}${digits}`;
      const exists = await this.userRepo.findOne({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('Could not allocate invite code');
  }

  private async config(): Promise<AppConfig> {
    const cfg = await this.appConfigRepo.findOne({ where: { id: 1 } });
    if (!cfg) throw new BadRequestException('Configuration unavailable');
    return cfg;
  }

  private async verifyTgInitData(
    initData: string | undefined,
  ): Promise<TelegramUser> {
    if (!initData) throw new BadRequestException('Invalid Telegram data');
    const cfg = await this.config();
    if (!cfg.telegramBotToken) {
      throw new BadRequestException('Telegram login not configured');
    }

    const params = new URLSearchParams(initData);
    const providedHash = params.get('hash');
    if (!providedHash) throw new BadRequestException('Invalid Telegram data');

    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(cfg.telegramBotToken)
      .digest();
    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computed !== providedHash) {
      throw new BadRequestException('Invalid Telegram data');
    }

    const userRaw = params.get('user');
    if (!userRaw) throw new BadRequestException('Invalid Telegram data');
    try {
      const parsed = JSON.parse(userRaw) as TelegramUser;
      if (typeof parsed.id !== 'number') {
        throw new BadRequestException('Invalid Telegram data');
      }
      return parsed;
    } catch {
      throw new BadRequestException('Invalid Telegram data');
    }
  }

  private async verifyGoogleToken(idToken: string): Promise<string> {
    const cfg = await this.config();
    if (!cfg.googleClientId) {
      throw new BadRequestException('Google login not configured');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    if (!response.ok) throw new BadRequestException('Invalid Google token');

    const data = (await response.json()) as GoogleTokenInfo;
    if (
      data.aud !== cfg.googleClientId ||
      Number(data.exp) * 1000 <= Date.now()
    ) {
      throw new BadRequestException('Invalid Google token');
    }

    return data.sub;
  }

  private async login(user: User) {
    const token = await this.generateToken(user);
    return { token, isRegister: false };
  }
}
