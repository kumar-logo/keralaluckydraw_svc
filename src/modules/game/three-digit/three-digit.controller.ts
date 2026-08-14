import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ThreeDigitService } from './three-digit.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  ThreeDigitCreateOrderDto,
  ThreeDigitDrawHistoryDto,
  ThreeDigitManualHistoryDto,
  ThreeDigitOrderListDto,
} from './dto/three-digit.dto';

@Controller()
export class ThreeDigitController {
  constructor(private p3oService: ThreeDigitService) {}

  @Public()
  @Get('game/api/three_digit/v1/game/info')
  getGameInfo(@Query('gameID') gameID: string) {
    const id = Number(gameID);
    if (!id || isNaN(id)) throw new BadRequestException('gameID is required');
    return this.p3oService.getGameInfo({ gameID: id });
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/three_digit/v1/draw/history')
  drawHistory(@Body() body: ThreeDigitDrawHistoryDto) {
    return this.p3oService.drawHistory(body);
  }

  @Public()
  @Get('game/api/three_digit/v1/draw/history/latest')
  drawHistoryLatest(@Query('gameID') gameID: string) {
    return this.p3oService.drawHistoryLatest(Number(gameID));
  }

  @Public()
  @Get('game/api/three_digit/v1/draw/history/quick')
  drawHistoryQuick() {
    return this.p3oService.drawHistoryQuick();
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/three_digit/v1/draw/history/manual')
  drawHistoryManual(@Body() body: ThreeDigitManualHistoryDto) {
    return this.p3oService.drawHistoryManual(body.pageNo, body.pageSize);
  }

  @HttpCode(200)
  @Post('game/api/three_digit/v1/order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: ThreeDigitCreateOrderDto,
  ) {
    return this.p3oService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/three_digit/v1/order/list')
  orderList(
    @CurrentUser('userId') userId: string,
    @Body() body: ThreeDigitOrderListDto,
  ) {
    return this.p3oService.orderList(userId, body);
  }

  @Get('game/api/three_digit/v1/share/info')
  shareInfo(@CurrentUser('userId') userId: string) {
    return this.p3oService.shareInfo(userId);
  }
}
