import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Req,
  HttpCode,
  Logger,
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

@Controller()
export class YpaymentController {
  private readonly logger = new Logger(YpaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly registry: PaymentGatewayRegistry,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get('payment/return/ypayment')
  async returnYpayment(
    @Query('order_id') orderId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const siteUrl = (await this.configLoader.getSiteUrl()).replace(/\/$/, '');
    let credited = false;
    try {
      if (orderId) {
        const row = await this.paymentService.resolveOrderGateway(orderId);
        const gatewayType = this.resolveGatewayType(row);
        const gateway = this.registry.getVerifiableGateway(gatewayType);
        const result = await gateway.verifyPayment(
          orderId,
          undefined,
          row === null ? undefined : row.providerCode,
        );
        if (result.status === WebhookStatus.Success) {
          credited = await this.paymentService.processWebhookResult(result);
        } else if (result.status === WebhookStatus.Failed) {
          await this.paymentService.processWebhookResult(result);
        }
      }
    } catch (error) {
      this.logger.error(
        `YPayment return failed for ${orderId}: ${(error as Error).message}`,
      );
    }
    const status = credited ? 'success' : 'failed';
    res.redirect(
      `${siteUrl}/recharge/return?order_id=${encodeURIComponent(
        orderId === undefined ? '' : orderId,
      )}&status=${status}`,
    );
  }

  private resolveGatewayType(row: PaymentGateway | null): string {
    if (row === null) {
      return PaymentGatewayCode.Ypayment;
    }
    return row.gatewayType === null ? row.providerCode : row.gatewayType;
  }

  @Public()
  @SkipThrottle()
  @Post('payment/webhook/ypayment')
  @HttpCode(200)
  async ypaymentWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: { result?: { orderId?: string } } & Record<string, unknown>,
  ): Promise<{ status: string }> {
    const loggedOrderId = body.result?.orderId;
    this.logger.log(
      `YPayment webhook received: ${
        loggedOrderId === undefined ? 'unknown' : loggedOrderId
      }`,
    );
    const gateway = this.registry.getWebhookGateway(
      PaymentGatewayCode.Ypayment,
    );
    try {
      const result = await gateway.verifyWebhook({
        body,
        signature: '',
        rawBody: req.rawBody,
      });
      await this.paymentService.processWebhookResult(result);
    } catch (error) {
      this.logger.error(
        `YPayment webhook processing failed: ${(error as Error).message}`,
      );
    }
    return { status: 'ok' };
  }

  @Post('payment/verify/ypayment')
  @HttpCode(200)
  async verifyYpayment(
    @Body() body: { orderNo: string },
    @CurrentUser('userId') userId: string,
  ): Promise<{ status: WebhookStatus; credited: boolean }> {
    if (!body?.orderNo) {
      return { status: WebhookStatus.Failed, credited: false };
    }
    this.logger.log(`YPayment verify: ${body.orderNo}`);
    const row = await this.paymentService.resolveOrderGateway(body.orderNo);
    const gatewayType = this.resolveGatewayType(row);
    const gateway = this.registry.getVerifiableGateway(gatewayType);
    const result = await gateway.verifyPayment(
      body.orderNo,
      userId,
      row === null ? undefined : row.providerCode,
    );
    let credited = false;
    if (result.status === WebhookStatus.Success) {
      credited = await this.paymentService.processWebhookResult(result);
    } else if (result.status === WebhookStatus.Failed) {
      await this.paymentService.processWebhookResult(result);
    }
    return { status: result.status, credited };
  }
}
