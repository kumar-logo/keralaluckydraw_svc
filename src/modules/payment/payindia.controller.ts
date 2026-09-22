import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Res,
  Req,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigLoaderService } from '../config/config-loader.service';
import { PaymentGateway } from '../../entities/payment-gateway.entity';
import { PaymentService } from './payment.service';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import {
  PaymentGatewayCode,
  WebhookStatus,
} from './gateways/payment-gateway.interface';
import {
  PAYINDIA_RETURN_PATH,
  PAYINDIA_WEBHOOK_PATH,
  PAYINDIA_VERIFY_PATH,
  PAYINDIA_SIGNATURE_HEADER,
} from './gateways/payindia.gateway';

@Controller()
export class PayIndiaController {
  private readonly logger = new Logger(PayIndiaController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly registry: PaymentGatewayRegistry,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get(PAYINDIA_RETURN_PATH)
  async returnPayIndia(
    @Query('order_id') orderId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const siteUrl = (await this.configLoader.getSiteUrl()).replace(/\/$/, '');
    let credited = false;
    try {
      if (orderId === undefined || orderId.trim() === '') {
        throw new BadRequestException('PayIndia return missing order_id');
      }
      const result = await this.verifyOrder(orderId, undefined);
      if (result.status !== WebhookStatus.Pending) {
        credited = await this.paymentService.processWebhookResult(result);
      }
    } catch (error) {
      this.logger.error(
        `PayIndia return failed for ${orderId === undefined ? 'unknown' : orderId}: ${(error as Error).message}`,
      );
    }
    res.redirect(
      `${siteUrl}/recharge/return?order_id=${encodeURIComponent(
        orderId === undefined ? '' : orderId,
      )}&status=${credited ? 'success' : 'failed'}`,
    );
  }

  @Public()
  @SkipThrottle()
  @Post(PAYINDIA_WEBHOOK_PATH)
  @HttpCode(200)
  async payIndiaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers(PAYINDIA_SIGNATURE_HEADER) signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    if (signature === undefined || signature.trim() === '') {
      throw new BadRequestException('PayIndia webhook signature missing');
    }
    this.logger.log(`PayIndia webhook received: ${String(body.order_id)}`);

    const gateway = this.registry.getWebhookGateway(
      PaymentGatewayCode.PayIndia,
    );
    const result = await gateway.verifyWebhook({
      body,
      signature,
      rawBody: req.rawBody,
    });
    await this.paymentService.processWebhookResult(result);
    return { received: true };
  }

  @Post(PAYINDIA_VERIFY_PATH)
  @HttpCode(200)
  async verifyPayIndia(
    @Body() body: { orderNo: string },
    @CurrentUser('userId') userId: string,
  ): Promise<{ status: WebhookStatus; credited: boolean }> {
    if (!body?.orderNo) {
      throw new BadRequestException('orderNo is required');
    }
    this.logger.log(`PayIndia verify: ${body.orderNo}`);

    const result = await this.verifyOrder(body.orderNo, userId);
    let credited = false;
    if (result.status !== WebhookStatus.Pending) {
      credited = await this.paymentService.processWebhookResult(result);
    }
    return { status: result.status, credited };
  }

  private async verifyOrder(orderNo: string, callerUserId: string | undefined) {
    const row = await this.paymentService.resolveOrderGateway(orderNo);
    const gatewayType = this.requireGatewayType(row);
    return this.registry
      .getVerifiableGateway(gatewayType)
      .verifyPayment(
        orderNo,
        callerUserId,
        (row as PaymentGateway).providerCode,
      );
  }

  private requireGatewayType(row: PaymentGateway | null): string {
    if (row === null) {
      throw new BadRequestException('Order has no payment gateway');
    }
    return row.gatewayType === null ? row.providerCode : row.gatewayType;
  }
}
