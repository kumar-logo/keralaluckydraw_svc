import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FourFiveDigitService } from './four-five-digit.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  FourFiveDigitCreateOrderDto,
  FourFiveDigitDrawHistoryDto,
  FourFiveDigitManualHistoryDto,
  FourFiveDigitOrderListDto,
} from './dto/four-five-digit.dto';

@Controller()
export class FourFiveDigitController {
  constructor(private p4bService: FourFiveDigitService) {}

  @Public()
  @Get('game/api/four_five_digit/v1/game/info')
  getGameInfo(@Query('gameID') gameID: string) {
    const id = Number(gameID);
    if (!id || isNaN(id)) throw new BadRequestException('gameID is required');
    return this.p4bService.getGameInfo({ gameID: id });
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/four_five_digit/v1/draw/history')
  drawHistory(@Body() body: FourFiveDigitDrawHistoryDto) {
    return this.p4bService.drawHistory(body);
  }

  @Public()
  @Get('game/api/four_five_digit/v1/draw/history/latest')
  drawHistoryLatest(@Query('gameID') gameID: string) {
    return this.p4bService.drawHistoryLatest(Number(gameID));
  }

  @Public()
  @Get('game/api/four_five_digit/v1/draw/history/quick')
  drawHistoryQuick() {
    return this.p4bService.drawHistoryQuick();
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/four_five_digit/v1/draw/history/manual')
  drawHistoryManual(@Body() body: FourFiveDigitManualHistoryDto) {
    return this.p4bService.drawHistoryManual(body.pageNo, body.pageSize);
  }

  @HttpCode(200)
  @Post('game/api/four_five_digit/v1/order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: FourFiveDigitCreateOrderDto,
  ) {
    return this.p4bService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/four_five_digit/v1/order/list')
  orderList(
    @CurrentUser('userId') userId: string,
    @Body() body: FourFiveDigitOrderListDto,
  ) {
    return this.p4bService.orderList(userId, body);
  }

  @Get('game/api/four_five_digit/v1/share/info')
  shareInfo(@CurrentUser('userId') userId: string) {
    return this.p4bService.shareInfo(userId);
  }
}
