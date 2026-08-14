import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ColorService } from './color.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  ColorCreateOrderDto,
  ColorDrawHistoryDto,
  ColorDrawResultDto,
  ColorOrderListDto,
} from './dto/color.dto';

@Controller('game/api/color/v1')
export class ColorController {
  constructor(private colorService: ColorService) {}

  @Public()
  @Get('game/info')
  getGameInfo(
    @CurrentUser('userId') userId: string,
    @Query('colorID') colorID: string,
  ) {
    const id = Number(colorID);
    if (!id || isNaN(id)) throw new BadRequestException('colorID is required');
    return this.colorService.getGameInfo(id, userId);
  }

  @Public()
  @HttpCode(200)
  @Post('draw/history')
  getDrawHistory(@Body() body: ColorDrawHistoryDto) {
    return this.colorService.getDrawHistory(body);
  }

  @HttpCode(200)
  @Post('order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: ColorCreateOrderDto,
  ) {
    return this.colorService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('order/list')
  getOrderList(
    @CurrentUser('userId') userId: string,
    @Body() body: ColorOrderListDto,
  ) {
    return this.colorService.getOrderList(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('draw/result')
  getDrawResult(@Body() body: ColorDrawResultDto) {
    return this.colorService.getDrawResult(body.colorID, body.roundNo);
  }
}
