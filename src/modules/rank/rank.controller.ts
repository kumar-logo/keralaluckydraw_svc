import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { RankService } from './rank.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RankAwardDto, RankInfoDto } from './dto/rank.dto';

@Controller('hall/api/rank/v1')
export class RankController {
  constructor(private rankService: RankService) {}

  @HttpCode(200)
  @Post('info')
  getInfo(@CurrentUser('userId') userId: string, @Body() body: RankInfoDto) {
    return this.rankService.getInfo(userId, body);
  }

  @HttpCode(200)
  @Post('award')
  claimAward(
    @CurrentUser('userId') userId: string,
    @Body() body: RankAwardDto,
  ) {
    return this.rankService.claimAward(userId, body);
  }
}
