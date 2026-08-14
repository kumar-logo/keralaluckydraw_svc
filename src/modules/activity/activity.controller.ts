import { Controller, Get, Post, Body, Query, HttpCode } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('hall/api/act/v1')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get('checkin/info')
  getCheckinInfo(@CurrentUser('userId') userId: string) {
    return this.activityService.getCheckinInfo(userId);
  }

  @HttpCode(200)
  @Post('award/get')
  claimCheckinAward(
    @CurrentUser('userId') userId: string,
    @Body() body: { actID: number; actKey: string; timeKey: string },
  ) {
    return this.activityService.claimCheckinAward(userId, body);
  }

  @Public()
  @Get('activity/list')
  getActivityList() {
    return this.activityService.getActivityList();
  }

  @Get('done/status')
  getDoneStatus(
    @CurrentUser('userId') userId: string,
    @Query('activityID') activityID: string,
  ) {
    return this.activityService.getDoneStatus(userId, Number(activityID));
  }
}
