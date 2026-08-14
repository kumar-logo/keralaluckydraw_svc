import { PaymentGatewayCode } from '../../../common/enums';

export { PaymentGatewayCode };

export interface PaymentOrder {
  payUrl: string;
  orderNo: string;
  amount: number;
}

export enum WebhookStatus {
  Success = 'success',
  Failed = 'failed',
  Pending = 'pending',
}

export interface WebhookResult {
  orderNo: string;
  amount: number;
  status: WebhookStatus;
  gatewayRef: string;
  rawData: string;
  reason: string;
  paymentRef?: string;
}

export interface WebhookContext {
  body: Record<string, unknown>;
  signature: string;
  rawBody?: Buffer;
}

export interface IPaymentGateway {
  readonly code: PaymentGatewayCode;
  createOrder(
    orderNo: string,
    amount: number,
    userId: string,
    providerCode?: string,
  ): Promise<PaymentOrder>;
}

export interface IWebhookGateway extends IPaymentGateway {
  verifyWebhook(context: WebhookContext): Promise<WebhookResult>;
}

export interface IVerifiableGateway extends IPaymentGateway {
  verifyPayment(
    orderNo: string,
    callerUserId?: string,
    providerCode?: string,
  ): Promise<WebhookResult>;
}
