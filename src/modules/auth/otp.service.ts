import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { SmsCode } from '../../entities/sms-code.entity';
import { NotificationTemplate } from '../../entities/notification-template.entity';
import { AppConfig } from '../../entities/app-config.entity';
import { OtpPurpose } from './otp-purpose.enum';

export interface SmsTestInput {
  smsEndpoint?: string;
  smsApiKey?: string;
  smsRoute?: string;
  smsSenderId?: string;
  smsTemplateId?: string;
}

export interface WhatsappTestInput {
  whatsappEndpoint?: string;
  whatsappToken?: string;
  whatsappTemplateName?: string;
  whatsappLangCode?: string;
}

export interface TestDeliveryResult {
  detail: string;
}

const BUILTIN_SMS_BODY = '{otp}';
const BUILTIN_WHATSAPP_TEMPLATE = 'otp_template_common';
const BUILTIN_SMS_ROUTE = '2';
const BUILTIN_WHATSAPP_LANG = 'en';
const EMPTY_RESPONSE_DETAIL = 'Sent';

@Injectable()
export class OtpService {
  private readonly logger = new Logger('Otp');

  constructor(
    @InjectRepository(SmsCode) private smsRepo: Repository<SmsCode>,
    @InjectRepository(NotificationTemplate)
    private templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(AppConfig) private appConfigRepo: Repository<AppConfig>,
  ) {}

  private async config(): Promise<AppConfig> {
    const cfg = await this.appConfigRepo.findOne({ where: { id: 1 } });
    if (!cfg) throw new BadRequestException('Configuration unavailable');
    return cfg;
  }

  async isOtpEnabled(): Promise<boolean> {
    return !!(await this.config()).otpEnabled;
  }

  async requestOtp(
    phone: string,
    purpose: string = OtpPurpose.Login,
  ): Promise<{ sent: boolean }> {
    if (!phone) throw new BadRequestException('Phone number required');
    const cfg = await this.config();
    if (!cfg.otpEnabled) return { sent: false };

    if (!cfg.smsEnabled && !cfg.whatsappEnabled) {
      throw new BadRequestException('OTP delivery is not configured');
    }

    const recent = await this.smsRepo.findOne({
      where: { phone, type: purpose },
      order: { id: 'DESC' },
    });
    if (recent?.createdAt) {
      const ageMs = Date.now() - new Date(recent.createdAt).getTime();
      if (ageMs < cfg.otpResendCooldownSec * 1000) {
        throw new BadRequestException(
          'Please wait before requesting another code',
        );
      }
    }

    const length = cfg.otpLength;
    const min = Math.pow(10, length - 1);
    const code = String(randomInt(min, min * 10));
    const expiredAt = new Date(Date.now() + cfg.otpTtlSeconds * 1000);

    let delivered = false;
    if (cfg.smsEnabled) {
      delivered = (await this.sendSms(cfg, phone, code, purpose)) || delivered;
    }
    if (cfg.whatsappEnabled) {
      delivered =
        (await this.sendWhatsapp(cfg, phone, code, purpose)) || delivered;
    }

    if (!delivered) {
      throw new BadRequestException(
        'Failed to send verification code, please try again later',
      );
    }

    await this.smsRepo.save(
      this.smsRepo.create({
        phone,
        code,
        type: purpose,
        channel: cfg.whatsappEnabled ? 'whatsapp' : 'sms',
        expiredAt,
        used: 0,
        attempts: 0,
      }),
    );

    return { sent: true };
  }

  async verifyOtp(
    phone: string,
    code: string | undefined,
    purpose: string,
  ): Promise<void> {
    const cfg = await this.config();
    if (!cfg.otpEnabled) return;
    if (!phone || !code)
      throw new BadRequestException('Verification code required');

    const row = await this.smsRepo.findOne({
      where: { phone, type: purpose, used: 0 },
      order: { id: 'DESC' },
    });
    if (!row) throw new BadRequestException('Invalid or expired code');
    if (row.expiredAt && new Date(row.expiredAt).getTime() < Date.now()) {
      throw new BadRequestException('Code has expired');
    }
    if (row.attempts >= cfg.otpMaxAttempts) {
      throw new BadRequestException('Too many attempts, request a new code');
    }
    if (String(row.code) !== String(code)) {
      await this.smsRepo.update({ id: row.id }, { attempts: row.attempts + 1 });
      throw new BadRequestException('Invalid code');
    }
    await this.smsRepo.update({ id: row.id }, { used: 1 });
  }

  private async templateBody(
    code: string,
    channel: string,
  ): Promise<string | null> {
    const tpl = await this.templateRepo.findOne({
      where: { code, channel, status: 1 },
    });
    if (!tpl || tpl.body === null || tpl.body.length === 0) return null;
    return tpl.body;
  }

  private render(body: string, otp: string): string {
    return body.replace(/\{\{?\s*otp\s*\}?\}/gi, otp);
  }

  private resolveWhatsappTemplate(
    dbTemplate: string | null,
    configuredTemplate: string,
  ): string {
    if (dbTemplate !== null) return dbTemplate;
    if (configuredTemplate.length > 0) return configuredTemplate;
    return BUILTIN_WHATSAPP_TEMPLATE;
  }

  private async sendSms(
    cfg: AppConfig,
    phone: string,
    code: string,
    purpose: string,
  ): Promise<boolean> {
    if (!cfg.smsEndpoint || !cfg.smsApiKey) return false;
    try {
      const tpl = await this.templateBody(`otp_${purpose}`, 'sms');
      const message = this.render(tpl === null ? BUILTIN_SMS_BODY : tpl, code);
      const params = new URLSearchParams({
        key: cfg.smsApiKey,
        route: cfg.smsRoute.length > 0 ? cfg.smsRoute : BUILTIN_SMS_ROUTE,
        sender: cfg.smsSenderId,
        number: `91${phone}`,
        sms: message,
        templateid: cfg.smsTemplateId,
      });
      const res = await fetch(cfg.smsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`SMS send failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async sendWhatsapp(
    cfg: AppConfig,
    phone: string,
    code: string,
    purpose: string,
  ): Promise<boolean> {
    if (!cfg.whatsappEndpoint || !cfg.whatsappToken) return false;
    try {
      const templateName = this.resolveWhatsappTemplate(
        await this.templateBody(`otp_${purpose}`, 'whatsapp'),
        cfg.whatsappTemplateName,
      );
      const payload = {
        token: cfg.whatsappToken,
        phone: `91${phone}`,
        template_name: templateName,
        template_language: {
          code:
            cfg.whatsappLangCode.length > 0
              ? cfg.whatsappLangCode
              : BUILTIN_WHATSAPP_LANG,
        },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      };
      const res = await fetch(cfg.whatsappEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${(err as Error).message}`);
      return false;
    }
  }

  async testSmsDelivery(
    input: SmsTestInput,
    phone: string,
  ): Promise<TestDeliveryResult> {
    if (!phone) {
      throw new BadRequestException(
        'Enter a phone number to receive the test message',
      );
    }
    if (!input.smsEndpoint || !input.smsApiKey) {
      throw new BadRequestException(
        'SMS endpoint and API key must be set before testing',
      );
    }
    const code = String(randomInt(100000, 1000000));
    const tpl = await this.templateBody('otp_login', 'sms');
    const message = this.render(tpl === null ? BUILTIN_SMS_BODY : tpl, code);
    const params = new URLSearchParams({
      key: input.smsApiKey,
      route:
        input.smsRoute !== undefined && input.smsRoute.length > 0
          ? input.smsRoute
          : BUILTIN_SMS_ROUTE,
      sender: input.smsSenderId !== undefined ? input.smsSenderId : '',
      number: `91${phone}`,
      sms: message,
      templateid: input.smsTemplateId !== undefined ? input.smsTemplateId : '',
    });
    try {
      const res = await fetch(input.smsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new BadRequestException(
          `SMS provider returned HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
      }
      const trimmed = text.trim();
      return { detail: trimmed.length > 0 ? trimmed : EMPTY_RESPONSE_DETAIL };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Could not reach the SMS endpoint: ${(err as Error).message}`,
      );
    }
  }

  async testWhatsappDelivery(
    input: WhatsappTestInput,
    phone: string,
  ): Promise<TestDeliveryResult> {
    if (!phone) {
      throw new BadRequestException(
        'Enter a phone number to receive the test message',
      );
    }
    if (!input.whatsappEndpoint || !input.whatsappToken) {
      throw new BadRequestException(
        'WhatsApp endpoint and token must be set before testing',
      );
    }
    const code = String(randomInt(100000, 1000000));
    const templateName = this.resolveWhatsappTemplate(
      await this.templateBody('otp_login', 'whatsapp'),
      input.whatsappTemplateName !== undefined
        ? input.whatsappTemplateName
        : '',
    );
    const payload = {
      token: input.whatsappToken,
      phone: `91${phone}`,
      template_name: templateName,
      template_language: {
        code:
          input.whatsappLangCode !== undefined &&
          input.whatsappLangCode.length > 0
            ? input.whatsappLangCode
            : BUILTIN_WHATSAPP_LANG,
      },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    };
    try {
      const res = await fetch(input.whatsappEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new BadRequestException(
          `WhatsApp provider returned HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
      }
      const trimmed = text.trim();
      return { detail: trimmed.length > 0 ? trimmed : EMPTY_RESPONSE_DETAIL };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Could not reach the WhatsApp endpoint: ${(err as Error).message}`,
      );
    }
  }
}
