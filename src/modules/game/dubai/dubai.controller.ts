import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { DubaiService } from './dubai.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  DubaiCreateOrderDto,
  DubaiDrawHistoryDto,
  DubaiOrderListDto,
} from './dto/dubai.dto';

@Controller()
export class DubaiController {
  constructor(private p1bService: DubaiService) {}

  @Public()
  @Get('game/api/dubai/v1/game/info')
  getGameInfo(@Query('gameID') gameID: string) {
    const id = Number(gameID);
    if (!id || isNaN(id)) throw new BadRequestException('gameID is required');
    return this.p1bService.getGameInfo(id);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/dubai/v1/draw/history')
  drawHistory(@Body() body: DubaiDrawHistoryDto) {
    return this.p1bService.drawHistory(body);
  }

  @HttpCode(200)
  @Post('game/api/dubai/v1/order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: DubaiCreateOrderDto,
  ) {
    return this.p1bService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/dubai/v1/order/list')
  orderList(
    @CurrentUser('userId') userId: string,
    @Body() body: DubaiOrderListDto,
  ) {
    return this.p1bService.orderList(userId, body);
  }
}
