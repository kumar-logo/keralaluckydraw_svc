import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { KeralaService } from './kerala.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  KeralaCreateOrderDto,
  KeralaDrawDetailDto,
  KeralaDrawDetailListDto,
  KeralaOrderCustomDto,
  KeralaOrderListDto,
  KeralaRandomOrderDto,
} from './dto/kerala.dto';

@Controller()
export class KeralaController {
  constructor(private keralaService: KeralaService) {}

  @Public()
  @Get('game/api/kerala/v1/game/info')
  getKroGameInfo(@Query('keralaID') keralaID: string) {
    const id = Number(keralaID);
    if (!id || isNaN(id)) throw new BadRequestException('keralaID is required');
    return this.keralaService.getGameInfo(id);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/kerala/v1/draw/detail')
  getKroDrawDetail(@Body() body: KeralaDrawDetailDto) {
    return this.keralaService.getDrawDetail(body);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/kerala/v1/order/random')
  getKroRandomOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: KeralaRandomOrderDto,
  ) {
    return this.keralaService.getRandomOrder(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/kerala/v1/order/create')
  createKroOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: KeralaCreateOrderDto,
  ) {
    return this.keralaService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/kerala/v1/order/create/insurance')
  createKroOrderInsurance(
    @CurrentUser('userId') userId: string,
    @Body() body: KeralaCreateOrderDto,
  ) {
    return this.keralaService.createOrderInsurance(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/kerala/v1/order/list')
  getKroOrderList(
    @CurrentUser('userId') userId: string,
    @Body() body: KeralaOrderListDto,
  ) {
    return this.keralaService.getOrderList(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/kerala/v1/draw/detail/list')
  getKroDrawDetailList(@Body() body: KeralaDrawDetailListDto) {
    return this.keralaService.getDrawDetailList(body);
  }

  @HttpCode(200)
  @Post('game/api/kerala/v1/order/custom')
  getKroOrderCustom(
    @CurrentUser('userId') userId: string,
    @Body() body: KeralaOrderCustomDto,
  ) {
    return this.keralaService.getOrderCustom(userId, body);
  }

  @Public()
  @Get('game/api/kerala/v1/draw/history/latest')
  getKroLatestDraw() {
    return this.keralaService.getLatestDraw('kerala');
  }

  @Get('game/api/kerala/v1/share/info')
  getKroShareInfo(@CurrentUser('userId') userId: string) {
    return this.keralaService.getShareInfo(userId);
  }
}
