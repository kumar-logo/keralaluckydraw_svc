import { Injectable, BadRequestException, HttpStatus } from '@nestjs/common';
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
export const PAYINDIA_REQUEST_TIMEOUT_MS = 15000;

const PAYINDIA_AMOUNT_TOLERANCE = 0.01;
const PAYINDIA_LOG_SNIPPET_LENGTH = 500;
const PAYINDIA_REASON_FIELD_LENGTH = 40;
const PAYINDIA_REASON_DETAIL_LENGTH = 100;
const PAYINDIA_DEFAULT_FAILURE_MESSAGE = 'Payment gateway request failed';

export enum PayIndiaEndpoint {
  CreateOrder = 'create-order',
  CheckStatus = 'check-status',
}

export enum PayIndiaResponseStatus {
  Success = 'success',
  Unknown = 'unknown',
}

export enum PayIndiaPaymentStatus {
  Success = 'success',
  Pending = 'pending',
  Failed = 'failed',
  Failure = 'failure',
  Cancelled = 'cancelled',
  Canceled = 'canceled',
  Expired = 'expired',
  Declined = 'declined',
  Rejected = 'rejected',
  Unknown = 'unknown',
}

const PAYINDIA_DEFINITIVE_FAILURE_STATUSES: readonly PayIndiaPaymentStatus[] = [
  PayIndiaPaymentStatus.Failed,
  PayIndiaPaymentStatus.Failure,
  PayIndiaPaymentStatus.Cancelled,
  PayIndiaPaymentStatus.Canceled,
  PayIndiaPaymentStatus.Expired,
  PayIndiaPaymentStatus.Declined,
  PayIndiaPaymentStatus.Rejected,
];

const PAYINDIA_AUTH_FAILURE_HTTP_STATUSES: readonly number[] = [
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
];

const PAYINDIA_TRANSIENT_HTTP_STATUSES: readonly number[] = [
  HttpStatus.REQUEST_TIMEOUT,
  HttpStatus.TOO_MANY_REQUESTS,
];

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
  status?: string | boolean | null;
  message?: string;
  error?: string;
  data?: PayIndiaCreateData | null;
}

interface PayIndiaStatusData {
  order_id?: string;
  amount?: number | string | null;
  payment_status?: string | null;
  utr?: string | number | null;
}

interface PayIndiaStatusResponse {
  status?: string | boolean | null;
  message?: string;
  error?: string;
  data?: PayIndiaStatusData | null;
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

interface PayIndiaHttpResponse {
  httpStatus: number;
  raw: string;
}

interface PayIndiaClassification {
  status: WebhookStatus;
  amount: number;
  reason: string;
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
    const credentials = this.toCredentials(
      await this.loadGatewayConfig(this.requireProviderCode(providerCode)),
    );

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

    const response = await this.request(
      credentials,
      PayIndiaEndpoint.CreateOrder,
      payload,
    );
    const data = this.parseJson<PayIndiaCreateResponse>(
      response.raw,
      PayIndiaEndpoint.CreateOrder,
    );

    if (
      this.normalizeEnvelope(data.status) !== PayIndiaResponseStatus.Success
    ) {
      this.logger.error(
        `PayIndia create-order rejected (HTTP ${response.httpStatus}): ${this.snippet(response.raw)}`,
      );
      throw new BadRequestException(this.describeFailure(data));
    }
    const payUrl = data.data?.payment_url;
    if (typeof payUrl !== 'string' || payUrl.trim() === '') {
      this.logger.error(
        `PayIndia create-order missing payment_url: ${this.snippet(response.raw)}`,
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

    const credentials = this.toCredentials(
      await this.loadGatewayConfigAnyStatus(
        this.requireProviderCode(providerCode),
      ),
    );
    const response = await this.request(
      credentials,
      PayIndiaEndpoint.CheckStatus,
      { order_id: orderNo },
    );
    const data = this.parseJson<PayIndiaStatusResponse>(
      response.raw,
      PayIndiaEndpoint.CheckStatus,
    );
    const envelope = this.normalizeEnvelope(data.status);
    if (envelope === '' && typeof data.error !== 'string') {
      this.logger.error(
        `PayIndia check-status missing status envelope (HTTP ${response.httpStatus}): ${this.snippet(response.raw)}`,
      );
      throw new BadRequestException(
        'Payment gateway returned an invalid response',
      );
    }

    if (envelope !== PayIndiaResponseStatus.Success) {
      return this.buildResult(
        orderNo,
        credentials.row.providerCode,
        this.classifyUnconfirmed(orderNo, response, envelope, data),
        response.raw,
        undefined,
      );
    }
    if (data.data === undefined || data.data === null) {
      this.logger.error(
        `PayIndia check-status missing data: ${this.snippet(response.raw)}`,
      );
      throw new BadRequestException('PayIndia status response missing data');
    }

    return this.buildResult(
      orderNo,
      credentials.row.providerCode,
      this.classify(orderNo, data.data, Number(record.amount)),
      response.raw,
      data.data.utr,
    );
  }

  async verifyWebhook(context: WebhookContext): Promise<WebhookResult> {
    const body = context.body as PayIndiaWebhookBody;
    const orderNo = body.order_id;
    if (typeof orderNo !== 'string' || orderNo.trim() === '') {
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

  private requireProviderCode(providerCode?: string): string {
    if (providerCode === undefined || providerCode.trim() === '') {
      throw new BadRequestException('PayIndia provider code missing');
    }
    return providerCode;
  }

  private toCredentials(row: PaymentGateway | null): PayIndiaCredentials {
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
    endpoint: PayIndiaEndpoint,
    payload: object,
  ): Promise<PayIndiaHttpResponse> {
    let httpStatus: number;
    let raw: string;
    try {
      const response = await fetch(`${credentials.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': credentials.apiKey,
          'X-API-Secret': credentials.apiSecret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PAYINDIA_REQUEST_TIMEOUT_MS),
      });
      httpStatus = response.status;
      raw = await response.text();
    } catch (error) {
      this.logger.error(
        `PayIndia ${endpoint} request failed: ${(error as Error).message}`,
      );
      throw new BadRequestException('Payment gateway unavailable');
    }

    if (PAYINDIA_AUTH_FAILURE_HTTP_STATUSES.includes(httpStatus)) {
      this.logger.error(
        `PayIndia ${endpoint} authentication rejected (HTTP ${httpStatus}): ${this.snippet(raw)}`,
      );
      throw new BadRequestException('Payment gateway authentication failed');
    }
    if (
      PAYINDIA_TRANSIENT_HTTP_STATUSES.includes(httpStatus) ||
      httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      this.logger.error(
        `PayIndia ${endpoint} unavailable (HTTP ${httpStatus}): ${this.snippet(raw)}`,
      );
      throw new BadRequestException('Payment gateway unavailable');
    }
    return { httpStatus, raw };
  }

  private parseJson<T extends object>(
    raw: string,
    endpoint: PayIndiaEndpoint,
  ): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(
        `PayIndia ${endpoint} non-JSON response: ${this.snippet(raw)}`,
      );
      throw new BadRequestException(
        'Payment gateway returned an invalid response',
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      this.logger.error(
        `PayIndia ${endpoint} non-object response: ${this.snippet(raw)}`,
      );
      throw new BadRequestException(
        'Payment gateway returned an invalid response',
      );
    }
    return parsed as T;
  }

  private normalizeEnvelope(
    status: string | boolean | null | undefined,
  ): string {
    return status === undefined || status === null
      ? ''
      : String(status).trim().toLowerCase();
  }

  private snippet(raw: string): string {
    return raw.slice(0, PAYINDIA_LOG_SNIPPET_LENGTH);
  }

  private describeFailure(data: { error?: string; message?: string }): string {
    if (typeof data.error === 'string' && data.error.trim() !== '') {
      return data.error;
    }
    if (typeof data.message === 'string' && data.message.trim() !== '') {
      return data.message;
    }
    return PAYINDIA_DEFAULT_FAILURE_MESSAGE;
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
    orderNo: string,
    data: PayIndiaStatusData,
    expected: number,
  ): PayIndiaClassification {
    const paymentStatus =
      typeof data.payment_status === 'string' &&
      data.payment_status.trim() !== ''
        ? data.payment_status.trim().toLowerCase()
        : PayIndiaPaymentStatus.Unknown;
    const parsedAmount = Number(data.amount);
    const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

    const reportsSuccess = paymentStatus === PayIndiaPaymentStatus.Success;
    const amountMatches =
      Math.abs(amount - expected) < PAYINDIA_AMOUNT_TOLERANCE;
    const isDefinitiveFailure = PAYINDIA_DEFINITIVE_FAILURE_STATUSES.includes(
      paymentStatus as PayIndiaPaymentStatus,
    );

    let status: WebhookStatus;
    if (reportsSuccess && amountMatches) {
      status = WebhookStatus.Success;
    } else if (reportsSuccess || isDefinitiveFailure) {
      status = WebhookStatus.Failed;
    } else {
      status = WebhookStatus.Pending;
      if (paymentStatus !== PayIndiaPaymentStatus.Pending) {
        this.logger.warn(
          `PayIndia unrecognised payment_status "${paymentStatus}" for ${orderNo}; treating as pending`,
        );
      }
    }

    return {
      status,
      amount,
      reason:
        status === WebhookStatus.Success
          ? ''
          : `paymentStatus=${paymentStatus.slice(0, PAYINDIA_REASON_FIELD_LENGTH)}; gatewayAmount=${amount}; expected=${expected}`,
    };
  }

  private classifyUnconfirmed(
    orderNo: string,
    response: PayIndiaHttpResponse,
    envelope: string,
    data: PayIndiaStatusResponse,
  ): PayIndiaClassification {
    this.logger.warn(
      `PayIndia check-status unconfirmed for ${orderNo} (HTTP ${response.httpStatus}): ${this.snippet(response.raw)}`,
    );
    const responseStatus =
      envelope === '' ? PayIndiaResponseStatus.Unknown : envelope;
    return {
      status: WebhookStatus.Pending,
      amount: 0,
      reason: `checkStatus=${responseStatus.slice(0, PAYINDIA_REASON_FIELD_LENGTH)}; httpStatus=${response.httpStatus}; detail=${this.describeFailure(data).slice(0, PAYINDIA_REASON_DETAIL_LENGTH)}`,
    };
  }

  private buildResult(
    orderNo: string,
    providerCode: string,
    classification: PayIndiaClassification,
    rawData: string,
    utr: string | number | null | undefined,
  ): WebhookResult {
    const paymentRef =
      utr === undefined || utr === null ? '' : String(utr).trim();
    return {
      orderNo,
      amount: classification.amount,
      status: classification.status,
      gatewayRef: `${providerCode}_${orderNo}`,
      rawData,
      reason: classification.reason,
      paymentRef: paymentRef === '' ? undefined : paymentRef,
    };
  }
}
