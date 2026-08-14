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

interface RazorpayWebhookRequestBody {
  event?: string;
}

@SkipThrottle()
@Controller()
export class RazorpayController {
  private readonly logger = new Logger(RazorpayController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly registry: PaymentGatewayRegistry,
  ) {}

  @Public()
  @Post('payment/webhook/razorpay')
  @HttpCode(200)
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: RazorpayWebhookRequestBody & Record<string, unknown>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): Promise<{ status: string }> {
    const loggedEvent = body.event;
    this.logger.log(
      `Razorpay webhook received: ${
        loggedEvent === undefined ? 'unknown' : loggedEvent
      }`,
    );
    const gateway = this.registry.getWebhookGateway(
      PaymentGatewayCode.Razorpay,
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
        `Razorpay webhook processing failed: ${(error as Error).message}`,
      );
    }
    return { status: 'ok' };
  }
}
