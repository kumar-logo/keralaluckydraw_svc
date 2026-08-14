import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentService } from './payment.service';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import { PaymentGatewayCode } from './gateways/payment-gateway.interface';

interface CashfreeWebhookRequestBody {
  data?: { order?: { order_id?: string } };
}

@SkipThrottle()
@Controller()
export class CashfreeController {
  private readonly logger = new Logger(CashfreeController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly registry: PaymentGatewayRegistry,
  ) {}

  @Public()
  @Post('payment/webhook/cashfree')
  @HttpCode(200)
  async cashfreeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: CashfreeWebhookRequestBody & Record<string, unknown>,
    @Headers('x-cashfree-signature') signature: string | undefined,
  ): Promise<{ status: string }> {
    const loggedOrderId = body.data?.order?.order_id;
    this.logger.log(
      `Cashfree webhook received: ${
        loggedOrderId === undefined ? 'unknown' : loggedOrderId
      }`,
    );
    const gateway = this.registry.getWebhookGateway(
      PaymentGatewayCode.Cashfree,
    );
    try {
      const result = await gateway.verifyWebhook({
        body,
        signature: signature === undefined ? '' : signature,
        rawBody: req.rawBody,
      });
      await this.paymentService.processWebhookResult(result);
    } catch (error) {
      this.logger.error(
        `Cashfree webhook processing failed: ${(error as Error).message}`,
      );
    }
    return { status: 'ok' };
  }
}
