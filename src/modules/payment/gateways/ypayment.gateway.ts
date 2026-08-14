import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

enum YpaymentTxnStatus {
  Completed = 'COMPLETED',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Failure = 'FAILURE',
  Cancelled = 'CANCELLED',
  Canceled = 'CANCELED',
  Expired = 'EXPIRED',
  Declined = 'DECLINED',
  Rejected = 'REJECTED',
  Pending = 'PENDING',
  Initiated = 'INITIATED',
  Processing = 'PROCESSING',
  Created = 'CREATED',
  Unknown = 'UNKNOWN',
}

const YPAYMENT_DEFINITIVE_FAILURE_STATUSES: readonly YpaymentTxnStatus[] = [
  YpaymentTxnStatus.Failed,
  YpaymentTxnStatus.Failure,
  YpaymentTxnStatus.Cancelled,
  YpaymentTxnStatus.Canceled,
  YpaymentTxnStatus.Expired,
  YpaymentTxnStatus.Declined,
  YpaymentTxnStatus.Rejected,
];

interface YpaymentCreateResult {
  payment_url?: string;
}

interface YpaymentCreateResponse {
  status?: boolean;
  message?: string;
  result?: YpaymentCreateResult;
}

interface YpaymentStatusResult {
  txnStatus?: string;
  status?: string;
  amount?: number | string;
  orderId?: string;
  utr?: string;
}

interface YpaymentStatusResponse {
  result?: YpaymentStatusResult;
}

interface YpaymentClassification {
  status: WebhookStatus;
  txnStatus: string;
  amount: number;
  expected: number;
}

@Injectable()
export class YpaymentGateway
  extends BasePaymentGateway
  implements IVerifiableGateway, IWebhookGateway
{
  readonly code: PaymentGatewayCode = PaymentGatewayCode.Ypayment;

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
    const gateway = await this.loadGatewayConfig(
      providerCode === undefined ? this.code : providerCode,
    );
    if (!gateway || !gateway.apiUrl || !gateway.apiKey) {
      this.logger.error(
        `YPayment not configured: gateway=${!!gateway} apiUrl=${gateway?.apiUrl ? 'set' : 'EMPTY'} apiKey=${gateway?.apiKey ? 'set' : 'EMPTY'}`,
      );
      throw new BadRequestException('Payment gateway not configured');
    }

    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) {
      throw new BadRequestException('User not found for payment order');
    }
    const customerMobile = user.phone === null ? '' : user.phone;
    const redirectUrl = this.buildReturnUrl(
      gateway.callbackUrl,
      orderNo,
      gateway.id,
    );

    const form = new URLSearchParams();
    form.set('customer_mobile', customerMobile);
    form.set('user_token', gateway.apiKey);
    form.set('amount', String(amount));
    form.set('order_id', orderNo);
    form.set('redirect_url', redirectUrl);
    form.set('remark1', 'testremark');
    form.set('remark2', 'testremark2');

    try {
      const response = await fetch(
        `${this.normalizeBase(gateway.apiUrl)}create-order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        },
      );
      const raw = await response.text();
      let data: YpaymentCreateResponse;
      try {
        data = JSON.parse(raw) as YpaymentCreateResponse;
      } catch {
        this.logger.error(
          `YPayment create-order non-JSON response (${response.status}): ${raw.slice(0, 500)}`,
        );
        throw new BadRequestException('Payment order creation failed');
      }
      if (!data || data.status !== true || !data.result?.payment_url) {
        this.logger.error(
          `YPayment order creation failed: ${JSON.stringify(data)}`,
        );
        const message =
          data && data.message !== undefined
            ? data.message
            : 'Payment order creation failed';
        throw new BadRequestException(message);
      }
      const payUrl = data.result.payment_url;
      await this.rcRepo.update({ orderNo }, { payUrl });
      return { payUrl, orderNo, amount };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`YPayment API error: ${(error as Error).message}`);
      throw new BadRequestException('Payment gateway unavailable');
    }
  }

  async verifyPayment(
    orderNo: string,
    callerUserId?: string,
    providerCode?: string,
  ): Promise<WebhookResult> {
    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (!record || (callerUserId && record.userId !== callerUserId)) {
      throw new BadRequestException('Order not found');
    }

    const gateway = await this.loadGatewayConfig(
      providerCode === undefined ? this.code : providerCode,
    );
    if (!gateway || !gateway.apiUrl || !gateway.apiKey) {
      throw new BadRequestException('Payment gateway not configured');
    }

    const form = new URLSearchParams();
    form.set('user_token', gateway.apiKey);
    form.set('order_id', orderNo);

    const response = await fetch(
      `${this.normalizeBase(gateway.apiUrl)}check-order-status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
    );
    const data = (await response.json()) as YpaymentStatusResponse;
    const resolvedProvider =
      providerCode === undefined ? this.code : providerCode;
    const classification = this.classify(
      data.result?.txnStatus === undefined
        ? data.result?.status
        : data.result.txnStatus,
      data.result?.amount,
      Number(record.amount),
    );

    return this.buildResult(
      orderNo,
      resolvedProvider,
      classification,
      JSON.stringify(data),
      data.result?.utr,
    );
  }

  async verifyWebhook(context: WebhookContext): Promise<WebhookResult> {
    const result = (context.body as { result?: YpaymentStatusResult }).result;
    const orderNo = result?.orderId;
    if (orderNo === undefined || orderNo === '') {
      throw new BadRequestException('Webhook missing orderId');
    }

    const record = await this.rcRepo.findOne({ where: { orderNo } });
    if (!record) {
      throw new BadRequestException('Order not found');
    }

    const resolvedProvider =
      record.channelId === null
        ? this.code
        : ((await this.gatewayRepo.findOne({ where: { id: record.channelId } }))
            ?.providerCode ?? this.code);

    return this.verifyPayment(orderNo, undefined, resolvedProvider);
  }

  private buildReturnUrl(
    callbackUrl: string | null,
    orderNo: string,
    gatewayId: number,
  ): string {
    if (callbackUrl === null || callbackUrl.trim() === '') {
      return '';
    }
    const query = `?order_id=${orderNo}&gateway_id=${gatewayId}`;
    try {
      const parsed = new URL(callbackUrl);
      return `${parsed.origin}/payment/return/ypayment${query}`;
    } catch {
      return `${callbackUrl}${query}`;
    }
  }

  private classify(
    rawStatus: string | undefined,
    rawAmount: number | string | undefined,
    expected: number,
  ): YpaymentClassification {
    const txnStatus = (
      rawStatus === undefined || rawStatus === ''
        ? YpaymentTxnStatus.Unknown
        : rawStatus
    ).toUpperCase();
    const amount = rawAmount === undefined ? 0 : Number(rawAmount);
    const gatewayReportsSuccess =
      txnStatus === YpaymentTxnStatus.Completed ||
      txnStatus === YpaymentTxnStatus.Success;
    const amountMatches = Math.abs(amount - expected) < 0.01;
    const isDefinitiveFailure = YPAYMENT_DEFINITIVE_FAILURE_STATUSES.includes(
      txnStatus as YpaymentTxnStatus,
    );

    let status: WebhookStatus;
    if (gatewayReportsSuccess && amountMatches) {
      status = WebhookStatus.Success;
    } else if (gatewayReportsSuccess || isDefinitiveFailure) {
      status = WebhookStatus.Failed;
    } else {
      status = WebhookStatus.Pending;
    }

    return { status, txnStatus, amount, expected };
  }

  private buildResult(
    orderNo: string,
    resolvedProvider: string,
    classification: YpaymentClassification,
    rawData: string,
    utr: string | undefined,
  ): WebhookResult {
    return {
      orderNo,
      amount: classification.amount,
      status: classification.status,
      gatewayRef: `${resolvedProvider}_${orderNo}`,
      rawData,
      reason:
        classification.status === WebhookStatus.Success
          ? ''
          : `txnStatus=${classification.txnStatus}; gatewayAmount=${classification.amount}; expected=${classification.expected}`,
      paymentRef: utr === undefined || utr === '' ? undefined : utr,
    };
  }
}
