import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { User } from '../../../entities/user.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import { PaymentGatewayCode } from '../../../common/enums';
import { BasePaymentGateway } from './base-payment.gateway';
import {
  IVerifiableGateway,
  IWebhookGateway,
  PaymentOrder,
  WebhookContext,
  WebhookResult,
  WebhookStatus,
} from './payment-gateway.interface';

export const PAYINDIA_RETURN_PATH = 'payment/return/payindia';
export const PAYINDIA_WEBHOOK_PATH = 'payment/webhook/payindia';
export const PAYINDIA_VERIFY_PATH = 'payment/verify/payindia';
export const PAYINDIA_SIGNATURE_HEADER = 'x-payindia-signature';

enum PayIndiaResponseStatus {
  Success = 'success',
}

enum PayIndiaPaymentStatus {
  Success = 'success',
  Pending = 'pending',
  Failed = 'failed',
}

interface PayIndiaCreatePayload {
  amount: string;
  order_id: string;
  customer_name: string;
  callback_url: string;
  is_reusable: boolean;
  customer_mobile?: string;
}

interface PayIndiaCreateData {
  payment_url?: string;
}

interface PayIndiaCreateResponse {
  status?: string;
  message?: string;
  error?: string;
  data?: PayIndiaCreateData;
}

interface PayIndiaStatusData {
  order_id?: string;
  amount?: number | string;
  payment_status?: string;
  utr?: string;
}

interface PayIndiaStatusResponse {
  status?: string;
  message?: string;
  error?: string;
  data?: PayIndiaStatusData;
}

interface PayIndiaWebhookBody {
  event?: string;
  order_id?: string;
  amount?: number | string;
  utr?: string;
  status?: string;
}

interface PayIndiaCredentials {
  row: PaymentGateway;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface PayIndiaClassification {
  status: WebhookStatus;
  paymentStatus: string;
  amount: number;
  expected: number;
}

@Injectable()
export class PayIndiaGateway
  extends BasePaymentGateway
  implements IVerifiableGateway, IWebhookGateway
{
  readonly code: PaymentGatewayCode = PaymentGatewayCode.PayIndia;

  constructor(
    @InjectRepository(User) userRepo: Repository<User>,
    @InjectRepository(RechargeRecord) rcRepo: Repository<RechargeRecord>,
    @InjectRepository(PaymentGateway) gatewayRepo: Repository<PaymentGateway>,
  ) {
    super(userRepo, rcRepo, gatewayRepo);
  }

  async createOrder(
    orderNo: string,
    amount: number,
    userId: string,
    providerCode?: string,
  ): Promise<PaymentOrder> {
    const credentials = await this.requireCredentials(providerCode);

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found for payment order');
    }
    if (user.nickname === null || user.nickname.trim() === '') {
      throw new BadRequestException('User name required for payment order');
    }

    const payload: PayIndiaCreatePayload = {
      amount: amount.toFixed(2),
      order_id: orderNo,
      customer_name: user.nickname,
      callback_url: this.buildReturnUrl(credentials.row),
      is_reusable: false,
    };
    if (user.phone !== null && user.phone.trim() !== '') {
      payload.customer_mobile = user.phone;
    }

    const raw = await this.request(credentials, 'create-order', payload);
    const data = this.parseJson<PayIndiaCreateResponse>(raw, 'create-order');

    if (data.status !== PayIndiaResponseStatus.Success) {
      this.logger.error(`PayIndia create-order rejected: ${raw.slice(0, 500)}`);
      throw new BadRequestException(this.describeFailure(data));
    }
    const payUrl = data.data?.payment_url;
    if (payUrl === undefined || payUrl.trim() === '') {
      this.logger.error(
        `PayIndia create-order missing payment_url: ${raw.slice(0, 500)}`,
      );
      throw new BadRequestException('Payment order creation failed');
    }

    await this.rcRepo.update({ orderNo }, { payUrl });
    return { payUrl, orderNo, amount };
  }

  async verifyPayment(
    orderNo: string,
    callerUserId?: string,
    providerCode?: string,
  ): Promise<WebhookResult> {
    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (!record) {
      throw new BadRequestException('Order not found');
    }
    if (callerUserId !== undefined && record.userId !== callerUserId) {
      throw new BadRequestException('Order not found');
    }

    const credentials = await this.requireCredentials(providerCode);
    const raw = await this.request(credentials, 'check-status', {
      order_id: orderNo,
    });
    const data = this.parseJson<PayIndiaStatusResponse>(raw, 'check-status');

    if (data.status !== PayIndiaResponseStatus.Success) {
      this.logger.error(`PayIndia check-status rejected: ${raw.slice(0, 500)}`);
      throw new BadRequestException(this.describeFailure(data));
    }
    if (data.data === undefined) {
      throw new BadRequestException('PayIndia status response missing data');
    }

    const classification = this.classify(data.data, Number(record.amount));
    return this.buildResult(
      orderNo,
      credentials.row.providerCode,
      classification,
      raw,
      data.data.utr,
    );
  }

  async verifyWebhook(context: WebhookContext): Promise<WebhookResult> {
    const body = context.body as PayIndiaWebhookBody;
    const orderNo = body.order_id;
    if (orderNo === undefined || orderNo.trim() === '') {
      throw new BadRequestException('PayIndia webhook missing order_id');
    }

    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (!record) {
      throw new BadRequestException('Order not found');
    }
    if (record.channelId === null) {
      throw new BadRequestException('Order has no payment channel');
    }

    const row = await this.gatewayRepo.findOne({
      where: { id: record.channelId },
    });
    if (!row) {
      throw new BadRequestException('PayIndia gateway not found for order');
    }

    this.assertSignature(context, row);
    return this.verifyPayment(orderNo, undefined, row.providerCode);
  }

  private async requireCredentials(
    providerCode?: string,
  ): Promise<PayIndiaCredentials> {
    if (providerCode === undefined || providerCode.trim() === '') {
      throw new BadRequestException('PayIndia provider code missing');
    }
    const row = await this.loadGatewayConfig(providerCode);
    if (!row) {
      throw new BadRequestException('PayIndia gateway not configured');
    }
    if (row.apiUrl === null || row.apiUrl.trim() === '') {
      throw new BadRequestException('PayIndia API URL not configured');
    }
    if (row.apiKey === null || row.apiKey.trim() === '') {
      throw new BadRequestException('PayIndia API key not configured');
    }
    if (row.apiSecret === null || row.apiSecret.trim() === '') {
      throw new BadRequestException('PayIndia API secret not configured');
    }
    return {
      row,
      baseUrl: this.normalizeBase(row.apiUrl),
      apiKey: row.apiKey,
      apiSecret: row.apiSecret,
    };
  }

  private async request(
    credentials: PayIndiaCredentials,
    endpoint: string,
    payload: object,
  ): Promise<string> {
    try {
      const response = await fetch(`${credentials.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': credentials.apiKey,
          'X-API-Secret': credentials.apiSecret,
        },
        body: JSON.stringify(payload),
      });
      return await response.text();
    } catch (error) {
      this.logger.error(
        `PayIndia ${endpoint} request failed: ${(error as Error).message}`,
      );
      throw new BadRequestException('Payment gateway unavailable');
    }
  }

  private parseJson<T>(raw: string, endpoint: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.error(
        `PayIndia ${endpoint} non-JSON response: ${raw.slice(0, 500)}`,
      );
      throw new BadRequestException(
        'Payment gateway returned an invalid response',
      );
    }
  }

  private describeFailure(data: { error?: string; message?: string }): string {
    if (data.error !== undefined && data.error.trim() !== '') {
      return data.error;
    }
    if (data.message !== undefined && data.message.trim() !== '') {
      return data.message;
    }
    throw new BadRequestException('Payment gateway request failed');
  }

  private buildReturnUrl(row: PaymentGateway): string {
    if (row.callbackUrl === null || row.callbackUrl.trim() === '') {
      throw new BadRequestException('PayIndia callback URL not configured');
    }
    let origin: string;
    try {
      origin = new URL(row.callbackUrl).origin;
    } catch {
      throw new BadRequestException('PayIndia callback URL is invalid');
    }
    return `${origin}/${PAYINDIA_RETURN_PATH}`;
  }

  private assertSignature(context: WebhookContext, row: PaymentGateway): void {
    if (row.webhookSecret === null || row.webhookSecret.trim() === '') {
      throw new BadRequestException('PayIndia webhook secret not configured');
    }
    if (context.rawBody === undefined || context.rawBody.length === 0) {
      throw new BadRequestException('PayIndia webhook body missing');
    }
    const expected = createHmac('sha256', row.webhookSecret)
      .update(context.rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(context.signature, 'utf8');
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      this.logger.warn('PayIndia webhook signature mismatch');
      throw new BadRequestException('Invalid signature');
    }
  }

  private classify(
    data: PayIndiaStatusData,
    expected: number,
  ): PayIndiaClassification {
    const rawStatus = data.payment_status;
    if (rawStatus === undefined || rawStatus.trim() === '') {
      throw new BadRequestException(
        'PayIndia status response missing payment_status',
      );
    }
    const paymentStatus = rawStatus.toLowerCase();

    const amount = Number(data.amount);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('PayIndia status response missing amount');
    }

    let status: WebhookStatus;
    if (paymentStatus === PayIndiaPaymentStatus.Success) {
      status =
        Math.abs(amount - expected) < 0.01
          ? WebhookStatus.Success
          : WebhookStatus.Failed;
    } else if (paymentStatus === PayIndiaPaymentStatus.Failed) {
      status = WebhookStatus.Failed;
    } else if (paymentStatus === PayIndiaPaymentStatus.Pending) {
      status = WebhookStatus.Pending;
    } else {
      throw new BadRequestException(
        `PayIndia unknown payment_status: ${paymentStatus}`,
      );
    }

    return { status, paymentStatus, amount, expected };
  }

  private buildResult(
    orderNo: string,
    providerCode: string,
    classification: PayIndiaClassification,
    rawData: string,
    utr: string | undefined,
  ): WebhookResult {
    return {
      orderNo,
      amount: classification.amount,
      status: classification.status,
      gatewayRef: `${providerCode}_${orderNo}`,
      rawData,
      reason:
        classification.status === WebhookStatus.Success
          ? ''
          : `paymentStatus=${classification.paymentStatus}; gatewayAmount=${classification.amount}; expected=${classification.expected}`,
      paymentRef: utr === undefined || utr.trim() === '' ? undefined : utr,
    };
  }
}
