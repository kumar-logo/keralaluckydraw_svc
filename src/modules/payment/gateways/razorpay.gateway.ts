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

enum RazorpayEvent {
  PaymentCaptured = 'payment.captured',
}

interface RazorpayOrderResponse {
  id?: string;
}

interface RazorpayPaymentEntity {
  id?: string;
  amount?: number | string;
  description?: string;
  notes?: { orderNo?: string };
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: { payment?: { entity?: RazorpayPaymentEntity } };
}

@Injectable()
export class RazorpayGateway
  extends BasePaymentGateway
  implements IWebhookGateway
{
  readonly code = PaymentGatewayCode.Razorpay;

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
      PaymentGatewayCode.Razorpay,
    );
    if (gw === null || gw.apiKey === null || gw.apiSecret === null) {
      throw new BadRequestException('Razorpay payment gateway not configured');
    }
    const keyId = gw.apiKey;
    const keySecret = gw.apiSecret;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const payload = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderNo,
      notes: { orderNo, userId },
    };

    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RazorpayOrderResponse;

      if (!response.ok) {
        this.logger.error(
          `Razorpay order creation failed: ${JSON.stringify(data)}`,
        );
        throw new BadRequestException('Payment order creation failed');
      }

      const checkoutUrl = gw.callbackUrl;
      const payUrl =
        checkoutUrl === null
          ? `https://api.razorpay.com/v1/checkout/embedded?order_id=${data.id}&key_id=${keyId}`
          : `${checkoutUrl}?razorpay_order_id=${data.id}&key=${keyId}`;

      await this.rcRepo.update({ orderNo }, { payUrl });

      return { payUrl, orderNo, amount };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Razorpay API error: ${(error as Error).message}`);
      throw new BadRequestException('Payment gateway unavailable');
    }
  }

  async verifyWebhook(context: WebhookContext): Promise<WebhookResult> {
    const body = context.body as RazorpayWebhookBody & Record<string, unknown>;
    const gw = await this.loadGatewayConfig(PaymentGatewayCode.Razorpay);
    if (gw === null || gw.webhookSecret === null) {
      throw new BadRequestException('Razorpay not configured');
    }
    const webhookSecret = gw.webhookSecret;

    const signedPayload =
      context.rawBody && context.rawBody.length
        ? context.rawBody.toString('utf8')
        : JSON.stringify(body);
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    if (context.signature !== expectedSig) {
      this.logger.warn('Razorpay webhook signature mismatch');
      throw new BadRequestException('Invalid signature');
    }

    const event = body.event;
    const payload = body.payload?.payment?.entity;
    if (payload === undefined) {
      throw new BadRequestException('Razorpay webhook missing payment entity');
    }
    const orderNo =
      payload.notes?.orderNo === undefined
        ? payload.description
        : payload.notes.orderNo;
    if (orderNo === undefined) {
      throw new BadRequestException('Razorpay webhook missing order id');
    }
    const rawAmount = payload.amount;
    if (rawAmount === undefined) {
      throw new BadRequestException('Razorpay webhook missing amount');
    }
    const txnAmount = Number(rawAmount) / 100;
    const gatewayRef = payload.id;
    const isSuccess = event === RazorpayEvent.PaymentCaptured;

    return {
      orderNo,
      amount: txnAmount,
      status: isSuccess ? WebhookStatus.Success : WebhookStatus.Failed,
      gatewayRef: gatewayRef === undefined ? '' : String(gatewayRef),
      rawData: JSON.stringify(body),
      reason: isSuccess
        ? ''
        : `Razorpay event: ${event === undefined ? 'unknown' : event}`,
    };
  }
}
