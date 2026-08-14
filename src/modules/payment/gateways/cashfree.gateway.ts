import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../../entities/user.entity';
import { RechargeRecord } from '../../../entities/recharge-record.entity';
import { PaymentGateway } from '../../../entities/payment-gateway.entity';
import { PaymentGatewayCode } from '../../../common/enums';
import { BasePaymentGateway } from './base-payment.gateway';
import {
  IWebhookGateway,
  PaymentOrder,
  WebhookContext,
  WebhookResult,
  WebhookStatus,
} from './payment-gateway.interface';

enum CashfreePaymentStatus {
  Success = 'SUCCESS',
}

interface CashfreeOrderResponse {
  payment_session_id?: string;
  payments?: { url?: string };
}

interface CashfreeWebhookOrder {
  order_id?: string;
  order_status?: string;
  order_amount?: number | string;
}

interface CashfreeWebhookPayment {
  payment_status?: string;
  payment_amount?: number | string;
  cf_payment_id?: string;
}

interface CashfreeWebhookData {
  order?: CashfreeWebhookOrder;
  payment?: CashfreeWebhookPayment;
  cf_order_id?: string;
  cf_payment_id?: string;
}

interface CashfreeWebhookBody {
  data?: CashfreeWebhookData;
}

@Injectable()
export class CashfreeGateway
  extends BasePaymentGateway
  implements IWebhookGateway
{
  readonly code = PaymentGatewayCode.Cashfree;

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
  ): Promise<PaymentOrder> {
    const gw = await this.loadGatewayConfigAnyStatus(
      PaymentGatewayCode.Cashfree,
    );
    if (
      gw === null ||
      gw.apiKey === null ||
      gw.apiSecret === null ||
      gw.apiUrl === null
    ) {
      throw new BadRequestException('Cashfree payment gateway not configured');
    }
    const appId = gw.apiKey;
    const secretKey = gw.apiSecret;
    const baseUrl = gw.apiUrl;
    const returnUrl = gw.callbackUrl;

    const payload = {
      order_id: orderNo,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId,
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url: returnUrl ? `${returnUrl}?order_id=${orderNo}` : undefined,
      },
    };

    try {
      const response = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CashfreeOrderResponse;

      if (!response.ok) {
        this.logger.error(
          `Cashfree order creation failed: ${JSON.stringify(data)}`,
        );
        throw new BadRequestException('Payment order creation failed');
      }

      const hostedUrl = data.payments?.url;
      const payUrl = data.payment_session_id
        ? `${baseUrl}/checkout?payment_session_id=${data.payment_session_id}`
        : hostedUrl;
      if (payUrl === undefined) {
        throw new BadRequestException('Payment order creation failed');
      }

      await this.rcRepo.update({ orderNo }, { payUrl });

      return { payUrl, orderNo, amount };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Cashfree API error: ${(error as Error).message}`);
      throw new BadRequestException('Payment gateway unavailable');
    }
  }

  async verifyWebhook(context: WebhookContext): Promise<WebhookResult> {
    const body = context.body as CashfreeWebhookBody & Record<string, unknown>;
    const gw = await this.loadGatewayConfig(PaymentGatewayCode.Cashfree);
    const secretKey = gw === null ? null : gw.apiSecret;
    if (secretKey === null) {
      throw new BadRequestException('Cashfree not configured');
    }

    const payload =
      context.rawBody && context.rawBody.length
        ? context.rawBody.toString('utf8')
        : JSON.stringify(body);
    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('base64');

    if (context.signature !== expectedSig) {
      this.logger.warn('Cashfree webhook signature mismatch');
      throw new BadRequestException('Invalid signature');
    }

    const data: CashfreeWebhookData =
      body.data === undefined ? (body as CashfreeWebhookData) : body.data;
    const orderNo =
      data.order?.order_id === undefined
        ? data.cf_order_id
        : data.order.order_id;
    if (orderNo === undefined) {
      throw new BadRequestException('Cashfree webhook missing order id');
    }
    const paymentStatus =
      data.payment?.payment_status === undefined
        ? data.order?.order_status
        : data.payment.payment_status;
    const rawAmount =
      data.payment?.payment_amount === undefined
        ? data.order?.order_amount
        : data.payment.payment_amount;
    if (rawAmount === undefined) {
      throw new BadRequestException('Cashfree webhook missing amount');
    }
    const txnAmount = Number(rawAmount);
    const gatewayRef =
      data.payment?.cf_payment_id === undefined
        ? data.cf_payment_id
        : data.payment.cf_payment_id;
    const isSuccess = paymentStatus === CashfreePaymentStatus.Success;

    return {
      orderNo,
      amount: txnAmount,
      status: isSuccess ? WebhookStatus.Success : WebhookStatus.Failed,
      gatewayRef: gatewayRef === undefined ? '' : String(gatewayRef),
      rawData: JSON.stringify(body),
      reason: isSuccess
        ? ''
        : `Cashfree payment status: ${
            paymentStatus === undefined ? 'unknown' : paymentStatus
          }`,
    };
  }
}
