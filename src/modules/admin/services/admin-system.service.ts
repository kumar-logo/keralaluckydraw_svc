import { Injectable } from '@nestjs/common';
import { OtpService } from '../../auth/otp.service';
import { RoundCleanupService } from '../../game/shared/round-cleanup.service';
import { TestSmsDto, TestWhatsappDto } from '../dto/admin.dto';

@Injectable()
export class AdminSystemService {
  constructor(
    private otp: OtpService,
    private roundCleanup: RoundCleanupService,
  ) {}

  async testSmsDelivery(body: TestSmsDto) {
    return this.otp.testSmsDelivery(
      {
        smsEndpoint: body.smsEndpoint,
        smsApiKey: body.smsApiKey,
        smsRoute: body.smsRoute,
        smsSenderId: body.smsSenderId,
        smsTemplateId: body.smsTemplateId,
      },
      body.phone,
    );
  }

  async testWhatsappDelivery(body: TestWhatsappDto) {
    return this.otp.testWhatsappDelivery(
      {
        whatsappEndpoint: body.whatsappEndpoint,
        whatsappToken: body.whatsappToken,
        whatsappTemplateName: body.whatsappTemplateName,
        whatsappLangCode: body.whatsappLangCode,
      },
      body.phone,
    );
  }

  async cleanupGameRounds(input: {
    fromDate: string;
    toDate: string;
    dryRun: boolean;
  }) {
    return this.roundCleanup.cleanupRange({
      fromDate: input.fromDate,
      toDate: input.toDate,
      dryRun: input.dryRun,
      protectManual: true,
    });
  }
}
