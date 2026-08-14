import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  Param,
  Headers,
} from '@nestjs/common';
import { OperationsService } from './operations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CasinoGameUrlDto,
  GameListDto,
  RedeemCdKeyDto,
  SearchGamesDto,
  ShareClickDto,
  ShareListDto,
  ToggleCollectDto,
} from './dto/operations.dto';

@Controller()
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @Public()
  @Get('hall/api/oper/v1/app/config')
  getAppConfig() {
    return this.operationsService.getAppConfig();
  }

  @Public()
  @Get('hall/api/oper/v1/app/version')
  getAppVersion() {
    return this.operationsService.getAppVersion();
  }

  @Public()
  @Get('hall/api/oper/v1/digit-position-config')
  getDigitPositionConfig() {
    return this.operationsService.getDigitPositionConfig();
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/home/banner/list')
  getBannerList() {
    return this.operationsService.getBannerList();
  }

  @Public()
  @Get('hall/api/oper/v1/share-poster/list')
  getSharePosterList() {
    return this.operationsService.getSharePosterList();
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/home/pop/list')
  getPopList() {
    return this.operationsService.getPopList();
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v3/home/game/list')
  getGameList(
    @CurrentUser('userId') userId: string,
    @Body() body: GameListDto,
  ) {
    return this.operationsService.getGameList(
      userId === undefined ? null : userId,
      body,
    );
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v3/search/list')
  searchGames(@Body() body: SearchGamesDto) {
    return this.operationsService.searchGames(body);
  }

  @HttpCode(200)
  @Post('hall/api/oper/v3/collect/set')
  toggleCollect(
    @CurrentUser('userId') userId: string,
    @Body() body: ToggleCollectDto,
  ) {
    return this.operationsService.toggleCollect(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/casino/game/url')
  getCasinoGameUrl(
    @CurrentUser('userId') userId: string,
    @Body() body: CasinoGameUrlDto,
    @Headers('host') host: string,
    @Headers('x-forwarded-proto') forwardedProto: string,
  ) {
    const proto =
      forwardedProto !== undefined && forwardedProto !== ''
        ? forwardedProto
        : 'https';
    const homeUrl = host ? `${proto}://${host}` : undefined;
    return this.operationsService.getCasinoGameUrl(userId, body, homeUrl);
  }

  @HttpCode(200)
  @Post('hall/api/oper/v1/cdkey/change')
  redeemCdKey(
    @CurrentUser('userId') userId: string,
    @Body() body: RedeemCdKeyDto,
  ) {
    return this.operationsService.redeemCdKey(userId, body.cdKey);
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/share/list')
  getShareList(@Body() body: ShareListDto) {
    return this.operationsService.getShareList(body);
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/share/click')
  trackShareClick(@Body() body: ShareClickDto) {
    return this.operationsService.trackShareClick(body);
  }

  @Public()
  @HttpCode(200)
  @Post('hall/api/oper/v1/home/notice/list')
  getNoticeList() {
    return this.operationsService.getNoticeList();
  }

  @Public()
  @Get('hall/api/oper/v1/game/:id/rules')
  getGameRules(@Param('id') id: number) {
    return this.operationsService.getGameRules(Number(id));
  }
}
