import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { RaceService } from './race.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  RaceCreateOrderDto,
  RaceDrawHistoryDto,
  RaceOrderListDto,
} from './dto/race.dto';

@Controller()
export class RaceController {
  constructor(private raceService: RaceService) {}

  @Public()
  @Get('game/api/race/v1/game/info')
  getGameInfo(
    @CurrentUser('userId') userId: string,
    @Query('gameID') gameID: string,
  ) {
    const id = Number(gameID);
    if (!id || isNaN(id)) throw new BadRequestException('gameID is required');
    return this.raceService.getGameInfo(id, userId);
  }

  @HttpCode(200)
  @Post('game/api/race/v2/order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: RaceCreateOrderDto,
  ) {
    return this.raceService.createOrder(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/race/v1/draw/history')
  getDrawHistory(@Body() body: RaceDrawHistoryDto) {
    return this.raceService.getDrawHistory(body);
  }

  @HttpCode(200)
  @Post('game/api/race/v1/order/list')
  getOrderList(
    @CurrentUser('userId') userId: string,
    @Body() body: RaceOrderListDto,
  ) {
    return this.raceService.getOrderList(userId, body);
  }

  @Public()
  @Get('game/api/race/v1/runner/frames')
  getRunnerFrames(@Query('gameID') gameID: string) {
    const id = Number(gameID);
    if (!id || isNaN(id)) throw new BadRequestException('gameID is required');
    return this.raceService.getRunnerFrames(id);
  }
}
