import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ThirdPartyService } from './third-party.service';
import type { SeamlessRequestBody } from './third-party.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';

@SkipThrottle()
@Controller()
export class ThirdPartyController {
  constructor(private thirdPartyService: ThirdPartyService) {}

  @Public()
  @SkipResponseTransform()
  @HttpCode(200)
  @Post('api/v1/third-party/seamless/callback')
  callback(@Body() body: SeamlessRequestBody) {
    return this.thirdPartyService.handleSeamlessCallback(body);
  }
}
