import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentGatewayCode } from '../../../common/enums';
import {
  IPaymentGateway,
  IVerifiableGateway,
  IWebhookGateway,
} from './payment-gateway.interface';
import { YpaymentGateway } from './ypayment.gateway';
import { CashfreeGateway } from './cashfree.gateway';
import { RazorpayGateway } from './razorpay.gateway';
import { ManualGateway } from './manual.gateway';

@Injectable()
export class PaymentGatewayRegistry {
  private readonly gateways: Map<PaymentGatewayCode, IPaymentGateway>;

  constructor(
    private readonly ypaymentGateway: YpaymentGateway,
    private readonly cashfreeGateway: CashfreeGateway,
    private readonly razorpayGateway: RazorpayGateway,
    private readonly manualGateway: ManualGateway,
  ) {
    this.gateways = new Map<PaymentGatewayCode, IPaymentGateway>([
      [PaymentGatewayCode.Ypayment, this.ypaymentGateway],
      [PaymentGatewayCode.Cashfree, this.cashfreeGateway],
      [PaymentGatewayCode.Razorpay, this.razorpayGateway],
      [PaymentGatewayCode.Manual, this.manualGateway],
    ]);
  }

  private resolveCode(code: string): PaymentGatewayCode {
    switch (code) {
      case PaymentGatewayCode.Cashfree:
        return PaymentGatewayCode.Cashfree;
      case PaymentGatewayCode.Razorpay:
        return PaymentGatewayCode.Razorpay;
      case PaymentGatewayCode.Ypayment:
        return PaymentGatewayCode.Ypayment;
      default:
        return PaymentGatewayCode.Manual;
    }
  }

  getGateway(gatewayType: string): IPaymentGateway {
    return this.gateways.get(this.resolveCode(gatewayType)) as IPaymentGateway;
  }

  getWebhookGateway(gatewayType: string): IWebhookGateway {
    const gateway = this.gateways.get(this.resolveCode(gatewayType));
    if (!gateway || !('verifyWebhook' in gateway)) {
      throw new BadRequestException(
        `Unsupported webhook gateway: ${gatewayType}`,
      );
    }
    return gateway as IWebhookGateway;
  }

  getVerifiableGateway(gatewayType: string): IVerifiableGateway {
    const gateway = this.gateways.get(this.resolveCode(gatewayType));
    if (!gateway || !('verifyPayment' in gateway)) {
      throw new BadRequestException(
        `Unsupported verify gateway: ${gatewayType}`,
      );
    }
    return gateway as IVerifiableGateway;
  }
}
