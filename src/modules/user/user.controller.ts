import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  UpdateAvatarDto,
  UpdateNicknameDto,
  BindPhoneDto,
  BindGoogleDto,
  BindTelegramDto,
  NotificationListDto,
  MarkNotificationReadDto,
  RegisterFcmTokenDto,
} from './dto';

@Controller('hall/api/usr/v1')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('info/get')
  getInfo(@CurrentUser('userId') userId: string) {
    return this.userService.getInfo(userId);
  }

  @Public()
  @Get('avatar/list')
  getAvatarList() {
    return this.userService.getAvatarList();
  }

  @HttpCode(200)
  @Post('info/update/avatar')
  updateAvatar(
    @CurrentUser('userId') userId: string,
    @Body() body: UpdateAvatarDto,
  ) {
    return this.userService.updateAvatar(userId, body.avatar);
  }

  @HttpCode(200)
  @Post('info/update/nickname')
  updateNickname(
    @CurrentUser('userId') userId: string,
    @Body() body: UpdateNicknameDto,
  ) {
    return this.userService.updateNickname(userId, body.nickname);
  }

  @Get('share/info')
  getShareInfo(@CurrentUser('userId') userId: string) {
    return this.userService.getShareInfo(userId);
  }

  @Get('msg/unread/count')
  getUnreadCount(@CurrentUser('userId') userId: string) {
    return this.userService.getUnreadMessageCount(userId);
  }

  @HttpCode(200)
  @Post('notification/list')
  getNotifications(
    @CurrentUser('userId') userId: string,
    @Body() body: NotificationListDto,
  ) {
    return this.userService.getNotifications(
      userId,
      body.pageNo,
      body.pageSize,
    );
  }

  @Get('notification/unread-count')
  getNotificationUnreadCount(@CurrentUser('userId') userId: string) {
    return this.userService.getNotificationUnreadCount(userId);
  }

  @HttpCode(200)
  @Post('notification/read')
  markNotificationRead(
    @CurrentUser('userId') userId: string,
    @Body() body: MarkNotificationReadDto,
  ) {
    return this.userService.markNotificationRead(userId, body.id);
  }

  @HttpCode(200)
  @Post('notification/read-all')
  markAllNotificationsRead(@CurrentUser('userId') userId: string) {
    return this.userService.markAllNotificationsRead(userId);
  }

  @HttpCode(200)
  @Post('notification/delete')
  deleteNotification(
    @CurrentUser('userId') userId: string,
    @Body() body: MarkNotificationReadDto,
  ) {
    return this.userService.deleteNotification(userId, body.id);
  }

  @HttpCode(200)
  @Post('notification/clear-all')
  clearAllNotifications(@CurrentUser('userId') userId: string) {
    return this.userService.clearAllNotifications(userId);
  }

  @HttpCode(200)
  @Post('notification/fcm-token')
  registerFcmToken(
    @CurrentUser('userId') userId: string,
    @Body() body: RegisterFcmTokenDto,
  ) {
    return this.userService.registerFcmToken(userId, body.token);
  }

  @HttpCode(200)
  @Post('info/bind/phone')
  bindPhone(@CurrentUser('userId') userId: string, @Body() body: BindPhoneDto) {
    return this.userService.bindPhone(userId, body.phone, body.smsCode);
  }

  @HttpCode(200)
  @Post('info/bind/tg')
  bindTelegram(
    @CurrentUser('userId') userId: string,
    @Body() body: BindTelegramDto,
  ) {
    return this.userService.bindTelegram(userId, body);
  }

  @HttpCode(200)
  @Post('info/bind/google')
  bindGoogle(
    @CurrentUser('userId') userId: string,
    @Body() body: BindGoogleDto,
  ) {
    return this.userService.bindGoogle(userId, body.idToken);
  }

  @HttpCode(200)
  @Post('app/award/download')
  downloadAppAward(@CurrentUser('userId') userId: string) {
    return this.userService.downloadAppAward(userId);
  }
}
