import { Logger, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';

export abstract class BasePaymentGateway {
  protected readonly logger: Logger;

  constructor(
    protected readonly userRepo: Repository<User>,
    protected readonly rcRepo: Repository<RechargeRecord>,
    protected readonly gatewayRepo: Repository<PaymentGateway>,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  protected normalizeBase(url: string): string {
    let base = url.trim();
    if (!base.endsWith('/')) base += '/';
    if (!base.endsWith('api/')) base += 'api/';
    return base;
  }

  protected async loadGatewayConfig(
    providerCode: string,
  ): Promise<PaymentGateway | null> {
    return this.gatewayRepo.findOne({
      where: { providerCode, status: 1 },
    });
  }

  protected async loadGatewayConfigAnyStatus(
    providerCode: string,
  ): Promise<PaymentGateway | null> {
    return this.gatewayRepo.findOne({
      where: { providerCode },
    });
  }

  protected requireConfigured(
    gateway: PaymentGateway | null,
    message: string,
  ): PaymentGateway {
    if (!gateway) {
      throw new BadRequestException(message);
    }
    return gateway;
  }
}
