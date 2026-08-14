import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import { ConfigLoaderService } from '../../config/config-loader.service';
import { PaymentGatewayCode } from '../../../common/enums';
import { BasePaymentGateway } from './base-payment.gateway';
import { IPaymentGateway, PaymentOrder } from './payment-gateway.interface';

@Injectable()
export class ManualGateway
  extends BasePaymentGateway
  implements IPaymentGateway
{
  readonly code = PaymentGatewayCode.Manual;

  constructor(
    @InjectRepository(User) userRepo: Repository<User>,
    @InjectRepository(RechargeRecord) rcRepo: Repository<RechargeRecord>,
    @InjectRepository(PaymentGateway) gatewayRepo: Repository<PaymentGateway>,
    private readonly configLoader: ConfigLoaderService,
  ) {
    super(userRepo, rcRepo, gatewayRepo);
  }

  async createOrder(orderNo: string, amount: number): Promise<PaymentOrder> {
    const manualPayUrl = await this.configLoader.getManualPayUrl();
    const payUrl = `${manualPayUrl}?order=${orderNo}&amount=${amount}`;
    await this.rcRepo.update({ orderNo }, { payUrl });
    return { payUrl, orderNo, amount };
  }
}
