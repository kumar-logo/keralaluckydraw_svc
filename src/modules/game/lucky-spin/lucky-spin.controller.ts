import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { LuckySpinService } from './lucky-spin.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  LuckySpinDrawDto,
  LuckySpinDrawHistoryDto,
  LuckySpinFreeHistoryDto,
} from './dto/lucky-spin.dto';

@Controller()
export class LuckySpinController {
  constructor(private wheelService: LuckySpinService) {}

  @Public()
  @Get('game/api/lucky_spin/v1/info')
  info(@CurrentUser('userId') userId: string) {
    return this.wheelService.info(userId);
  }

  @HttpCode(200)
  @Post('game/api/lucky_spin/v1/draw')
  draw(@CurrentUser('userId') userId: string, @Body() body: LuckySpinDrawDto) {
    return this.wheelService.draw(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/lucky_spin/v1/draw/history')
  drawHistory(
    @CurrentUser('userId') userId: string,
    @Body() body: LuckySpinDrawHistoryDto,
  ) {
    return this.wheelService.drawHistory(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/lucky_spin/v1/free/history')
  freeHistory(
    @CurrentUser('userId') userId: string,
    @Body() body: LuckySpinFreeHistoryDto,
  ) {
    return this.wheelService.freeHistory(userId, body);
  }

  @Public()
  @Get('game/api/lucky_spin/v1/barrage')
  barrage(@Query('count') count?: string) {
    const parsed = Number(count);
    if (count !== undefined && (!Number.isInteger(parsed) || parsed < 1)) {
      throw new BadRequestException('count must be a positive integer');
    }
    return count !== undefined
      ? this.wheelService.barrage(parsed)
      : this.wheelService.barrage();
  }
}
