import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { MysteryBoxService } from './mystery-box.service';
import {
  MysteryBoxBarrageDto,
  MysteryBoxDrawDto,
  MysteryBoxDrawHistoryDto,
} from './dto/mystery-box-draw.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller()
export class MysteryBoxController {
  constructor(private boxService: MysteryBoxService) {}

  @Public()
  @Get('game/api/mystery_box/v1/game/list')
  getGameList() {
    return this.boxService.getGameList();
  }

  @HttpCode(200)
  @Post('game/api/mystery_box/v1/game/draw')
  draw(@CurrentUser('userId') userId: string, @Body() body: MysteryBoxDrawDto) {
    return this.boxService.draw(userId, body);
  }

  @HttpCode(200)
  @Post('game/api/mystery_box/v1/game/draw/history')
  drawHistory(
    @CurrentUser('userId') userId: string,
    @Body() body: MysteryBoxDrawHistoryDto,
  ) {
    return this.boxService.drawHistory(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('game/api/mystery_box/v1/game/barrage')
  barrage(@Body() body: MysteryBoxBarrageDto) {
    return this.boxService.barrage(body);
  }

  @Get('game/api/mystery_box/v1/share/info')
  shareInfo(@CurrentUser('userId') userId: string) {
    return this.boxService.shareInfo(userId);
  }
}
