import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { DiceService } from './dice.service';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  DiceCreateOrderDto,
  DiceDrawAnalyzeDto,
  DiceDrawHistoryDto,
  DiceDrawResultDto,
  DiceOrderListDto,
} from './dto/dice.dto';

@Controller('game/api/dice/v1')
export class DiceController {
  constructor(private diceService: DiceService) {}

  @Public()
  @Get('game/info')
  getGameInfo(
    @CurrentUser('userId') userId: string,
    @Query('diceID') diceID: string,
  ) {
    const id = Number(diceID);
    if (!id || isNaN(id)) throw new BadRequestException('diceID is required');
    return this.diceService.getGameInfo(id, userId);
  }

  @Public()
  @HttpCode(200)
  @Post('draw/history')
  getDrawHistory(@Body() body: DiceDrawHistoryDto) {
    return this.diceService.getDrawHistory(body);
  }

  @Public()
  @HttpCode(200)
  @Post('draw/analyze')
  getDrawAnalyze(@Body() body: DiceDrawAnalyzeDto) {
    return this.diceService.getDrawAnalyze(body);
  }

  @HttpCode(200)
  @Post('order/create')
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() body: DiceCreateOrderDto,
  ) {
    return this.diceService.createOrder(userId, body);
  }

  @HttpCode(200)
  @Post('order/list')
  getOrderList(
    @CurrentUser('userId') userId: string,
    @Body() body: DiceOrderListDto,
  ) {
    return this.diceService.getOrderList(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('draw/result')
  getDrawResult(@Body() body: DiceDrawResultDto) {
    return this.diceService.getDrawResult(body.diceID, body.roundNo);
  }
}
