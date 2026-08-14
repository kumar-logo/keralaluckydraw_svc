import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { CashRainService } from './cash-rain.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('game/api/cash_rain/v1')
export class CashRainController {
  constructor(private broadcastService: CashRainService) {}

  @Public()
  @Get('info')
  getInfo(@CurrentUser('userId') userId: string) {
    return this.broadcastService.getInfo(userId);
  }

  @HttpCode(200)
  @Post('start')
  start(
    @CurrentUser('userId') userId: string,
    @Body() body: { gameID: number; roundNo: string },
  ) {
    return this.broadcastService.start({
      userId,
      gameId: body.gameID,
      roundNo: body.roundNo,
    });
  }

  @HttpCode(200)
  @Post('over')
  over(
    @CurrentUser('userId') userId: string,
    @Body() body: { gameID: number; roundNo: string },
  ) {
    return this.broadcastService.over({
      userId,
      gameId: body.gameID,
      roundNo: body.roundNo,
    });
  }
}
