import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { GameCategoryControlField } from './services/admin-game.service';
import { TinyFlag } from '../../common/enums';
import {
  CreateMessageDto,
  SaveFirebaseConfigDto,
  CreateUserDto,
  UpdateUserDto,
  SetUserPasswordDto,
  UpdateAdminUserDto,
  SetDrawResultDto,
  UpdateOddsConfigDto,
  LotteryReportDownloadQueryDto,
  TestSmsDto,
  TestWhatsappDto,
  UpdateGameResultConfigDto,
  UpdateCronJobDto,
  RechargeListQueryDto,
  WithdrawListQueryDto,
  DashboardQueryDto,
  FinanceExportQueryDto,
} from './dto/admin.dto';
import { SaveAppVersionDto } from './dto/app-version.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { Permission } from '../../common/enums';
import {
  ThrottleProfile,
  LOGIN_LIMIT,
} from '../../common/throttle/throttle.config';

@Controller('admin/api/v1')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Public()
  @Throttle({ [ThrottleProfile.Default]: LOGIN_LIMIT })
  @HttpCode(200)
  @Post('auth/login')
  login(@Body() body: { username: string; password: string }) {
    return this.adminService.login(body.username, body.password);
  }

  @Get('dashboard')
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.adminService.getDashboard(query);
  }

  @HttpCode(200)
  @Post('users/list')
  getUsers(
    @Body() body: { pageNo: number; pageSize: number; search?: string },
  ) {
    return this.adminService.getUsers(body);
  }

  @RequirePermission(Permission.Users)
  @HttpCode(200)
  @Post('users/create')
  createUser(@CurrentUser('sub') adminId: number, @Body() body: CreateUserDto) {
    return this.adminService.createUser(body, adminId);
  }

  @RequirePermission(Permission.Users)
  @Put('users/:userId')
  updateUser(
    @CurrentUser('sub') adminId: number,
    @Param('userId') userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.adminService.updateUser(userId, body, adminId);
  }

  @RequirePermission(Permission.Users)
  @HttpCode(200)
  @Post('users/:userId/password')
  setUserPassword(
    @CurrentUser('sub') adminId: number,
    @Param('userId') userId: string,
    @Body() body: SetUserPasswordDto,
  ) {
    return this.adminService.setUserPassword(userId, body.newPassword, adminId);
  }

  @RequirePermission(Permission.Users)
  @Delete('users/:userId')
  deleteUser(
    @CurrentUser('sub') adminId: number,
    @Param('userId') userId: string,
  ) {
    return this.adminService.deleteUser(userId, adminId);
  }

  @RequirePermission(Permission.Users)
  @HttpCode(200)
  @Post('users/:userId/balance')
  adjustBalance(
    @CurrentUser('sub') adminId: number,
    @Param('userId') userId: string,
    @Body() body: { amount: number; type: 'add' | 'subtract' },
  ) {
    return this.adminService.adjustBalance(
      userId,
      body.amount,
      body.type,
      adminId,
    );
  }

  @Get('users/:userId/detail')
  getUserDetail(@Param('userId') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @HttpCode(200)
  @Post('users/:userId/bets')
  getUserBets(
    @Param('userId') userId: string,
    @Body() body: { pageNo: number; pageSize: number; gameType?: string },
  ) {
    return this.adminService.getUserBets(userId, body);
  }

  @HttpCode(200)
  @Post('users/:userId/transactions')
  getUserTransactions(
    @Param('userId') userId: string,
    @Body() body: { pageNo: number; pageSize: number; sourceType?: string },
  ) {
    return this.adminService.getUserTransactions(userId, body);
  }

  @HttpCode(200)
  @Post('users/:userId/transfers')
  getUserTransfers(
    @Param('userId') userId: string,
    @Body() body: { pageNo: number; pageSize: number },
  ) {
    return this.adminService.getUserTransfers(userId, body);
  }

  @Get('users/:userId/referrals')
  getUserReferrals(@Param('userId') userId: string) {
    return this.adminService.getUserReferrals(userId);
  }

  @HttpCode(200)
  @Post('games/list')
  getGames(@Body() body: { pageNo: number; pageSize: number }) {
    return this.adminService.getGames(body);
  }

  @HttpCode(200)
  @Post('games/options')
  getGameOptions(
    @Body() body: { scope?: 'all' | 'in_house' | 'lottery'; search?: string },
  ) {
    return this.adminService.getGameOptions(body);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/create')
  createGame(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.createGame(body, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/clone')
  cloneGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.cloneGame(id, adminId);
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id')
  updateGame(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateGame(id, body, adminId);
  }

  @HttpCode(200)
  @Post('games/rounds')
  getGameRounds(
    @Body() body: { gameId?: number; pageNo: number; pageSize: number },
  ) {
    return this.adminService.getGameRounds(body);
  }

  @Get('games/:id/detail')
  getGameDetail(@Param('id') id: number) {
    return this.adminService.getGameDetail(id);
  }

  @HttpCode(200)
  @Post('games/:id/stats')
  getGameStats(
    @Param('id') id: number,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.adminService.getGameStats(id, body);
  }

  @HttpCode(200)
  @Post('orders/list')
  getOrders(@Body() body: any) {
    return this.adminService.getOrders(body);
  }

  @Get('banners')
  getBanners() {
    return this.adminService.getBanners();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('banners')
  createBanner(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.createBanner(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Put('banners/:id')
  updateBanner(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateBanner(id, body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('banners/:id')
  deleteBanner(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteBanner(id, adminId);
  }

  @Get('announcements')
  getAnnouncements() {
    return this.adminService.getAnnouncements();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('announcements')
  createAnnouncement(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.createAnnouncement(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Put('announcements/:id')
  updateAnnouncement(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateAnnouncement(id, body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('announcements/:id')
  deleteAnnouncement(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteAnnouncement(id, adminId);
  }

  @HttpCode(200)
  @Post('finance/recharge/list')
  getRechargeRecords(@Body() body: RechargeListQueryDto) {
    return this.adminService.getRechargeRecords(body);
  }

  @RequirePermission(Permission.Finance)
  @SkipResponseTransform()
  @Get('finance/recharge/export')
  exportRechargeRecords(
    @Query() query: FinanceExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.adminService.streamRechargeCsv(res, {
      status: query.status,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('finance/recharge/approve')
  approveRecharge(
    @CurrentUser('sub') adminId: number,
    @Body() body: { orderNo: string },
  ) {
    return this.adminService.approveRecharge(body.orderNo, adminId);
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('finance/recharge/reject')
  rejectRecharge(
    @CurrentUser('sub') adminId: number,
    @Body() body: { orderNo: string; remark: string },
  ) {
    return this.adminService.rejectRecharge(body.orderNo, adminId, body.remark);
  }

  @HttpCode(200)
  @Post('finance/withdraw/list')
  getWithdrawRecords(@Body() body: WithdrawListQueryDto) {
    return this.adminService.getWithdrawRecords(body);
  }

  @RequirePermission(Permission.Finance)
  @SkipResponseTransform()
  @Get('finance/withdraw/export')
  exportWithdrawRecords(
    @Query() query: FinanceExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.adminService.streamWithdrawCsv(res, {
      status: query.status,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('finance/withdraw/approve')
  approveWithdraw(
    @CurrentUser('sub') adminId: number,
    @Body() body: { orderNo: string },
  ) {
    return this.adminService.approveWithdraw(body.orderNo, adminId);
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('finance/withdraw/reject')
  rejectWithdraw(
    @CurrentUser('sub') adminId: number,
    @Body() body: { orderNo: string; remark: string },
  ) {
    return this.adminService.rejectWithdraw(body.orderNo, adminId, body.remark);
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('third-party/transactions')
  getThirdPartyTransactions(
    @Body()
    body: {
      pageNo: number;
      pageSize: number;
      memberId?: number;
      gameRound?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.adminService.getThirdPartyTransactions(body);
  }

  @Get('config')
  getConfigs() {
    return this.adminService.getConfigs();
  }

  @RequirePermission(Permission.System)
  @Delete('config/:id')
  deleteConfig(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteConfig(id, adminId);
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('config')
  setConfig(
    @CurrentUser('sub') adminId: number,
    @Body() body: { key: string; value: string; description?: string },
  ) {
    return this.adminService.setConfig(
      body.key,
      body.value,
      body.description,
      adminId,
    );
  }

  @HttpCode(200)
  @Post('draws/list')
  getDraws(@Body() body: any) {
    return this.adminService.getDraws(body);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/trigger')
  triggerDraw(
    @CurrentUser('sub') adminId: number,
    @Body() body: { roundId: number },
  ) {
    return this.adminService.triggerDraw(body.roundId, adminId);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/set-result')
  setDrawResult(
    @CurrentUser('sub') adminId: number,
    @Body() body: SetDrawResultDto,
  ) {
    return this.adminService.setDrawResult(body.roundId, body.result, adminId);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/cancel')
  cancelRound(
    @CurrentUser('sub') adminId: number,
    @Body() body: { roundId: number },
  ) {
    return this.adminService.cancelRound(body.roundId, adminId);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('settlement/retry')
  retrySettlement(
    @CurrentUser('sub') adminId: number,
    @Body() body: { roundId: number },
  ) {
    return this.adminService.retrySettlement(body.roundId, adminId);
  }

  @Get('odds/:gameId')
  getOddsConfig(@Param('gameId') gameId: number) {
    return this.adminService.getOddsConfig(gameId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('odds/:gameId')
  updateOddsConfig(
    @CurrentUser('sub') adminId: number,
    @Param('gameId') gameId: number,
    @Body() body: UpdateOddsConfigDto,
  ) {
    return this.adminService.updateOddsConfig(gameId, body.updates, adminId);
  }

  @RequirePermission(Permission.Games)
  @Delete('odds/:gameId/:id')
  deleteOddsEntry(
    @CurrentUser('sub') adminId: number,
    @Param('gameId') gameId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteOddsEntry(gameId, id, adminId);
  }

  @Get('schedule/:gameId')
  getGameSchedule(@Param('gameId') gameId: number) {
    return this.adminService.getGameSchedule(gameId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('schedule/:gameId')
  updateGameSchedule(
    @CurrentUser('sub') adminId: number,
    @Param('gameId') gameId: number,
    @Body() body: any,
  ) {
    return this.adminService.updateGameSchedule(gameId, body, adminId);
  }

  @Get('vip/config')
  getVipConfigs() {
    return this.adminService.getVipConfigs();
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('vip/config')
  upsertVipConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertVipConfig(body, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Delete('vip/config/:id')
  deleteVipConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteVipConfig(id, adminId);
  }

  @Get('commission/config')
  getCommissionConfigs() {
    return this.adminService.getCommissionConfigs();
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('commission/config')
  upsertCommissionConfig(
    @CurrentUser('sub') adminId: number,
    @Body() body: any,
  ) {
    return this.adminService.upsertCommissionConfig(body, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Delete('commission/config/:id')
  deleteCommissionConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteCommissionConfig(id, adminId);
  }

  @HttpCode(200)
  @Post('audit/list')
  getAuditLogs(@Body() body: any) {
    return this.adminService.getAuditLogs(body);
  }

  @HttpCode(200)
  @Post('messages/list')
  getMessages(@Body() body: { pageNo: number; pageSize: number }) {
    return this.adminService.getMessages(body);
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('messages/create')
  createMessage(
    @CurrentUser('sub') adminId: number,
    @Body() body: CreateMessageDto,
  ) {
    return this.adminService.createMessage(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('messages/bulk-delete')
  bulkDeleteMessages(
    @CurrentUser('sub') adminId: number,
    @Body() body: { ids: number[] },
  ) {
    return this.adminService.bulkDeleteMessages(body.ids, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('messages/:id')
  deleteMessage(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteMessage(id, adminId);
  }

  @Get('admins/:id')
  getAdminById(@Param('id') id: number) {
    return this.adminService.getAdminById(id);
  }

  @HttpCode(200)
  @Post('admins/list')
  getAdminUsers(@Body() body: { pageNo: number; pageSize: number }) {
    return this.adminService.getAdminUsers(body);
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('admins/create')
  createAdminUser(
    @CurrentUser('sub') adminId: number,
    @Body()
    body: {
      username: string;
      password: string;
      displayName: string;
      role: string;
    },
  ) {
    return this.adminService.createAdminUser(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Put('admins/:id')
  updateAdminUser(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: UpdateAdminUserDto,
  ) {
    return this.adminService.updateAdminUser(id, body, adminId);
  }

  @RequirePermission(Permission.System)
  @Delete('admins/:id')
  deleteAdminUser(
    @CurrentUser('sub') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteAdminUser(id, adminId);
  }

  @HttpCode(200)
  @Post('reports/revenue')
  getRevenueReport(
    @Body() body: { startDate: string; endDate: string; gameType?: string },
  ) {
    return this.adminService.getRevenueReport(body);
  }

  @HttpCode(200)
  @Post('reports/users')
  getUserReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getUserReport(body);
  }

  @HttpCode(200)
  @Post('reports/games')
  getGameReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getGameReport(body);
  }

  @Get('reports/dashboard')
  getDashboardEnhanced() {
    return this.adminService.getDashboardEnhanced();
  }

  @HttpCode(200)
  @Post('reports/lottery')
  getLotteryReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getLotteryReport(body);
  }

  @RequirePermission(Permission.Reports)
  @SkipResponseTransform()
  @Get('reports/lottery/download')
  downloadLotteryOrders(
    @Query() query: LotteryReportDownloadQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.adminService.streamLotteryOrdersCsv(res, {
      startDate: query.startDate,
      endDate: query.endDate,
      gameType: query.gameType,
    });
  }

  @HttpCode(200)
  @Post('reports/payments')
  getPaymentReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getPaymentReport(body);
  }

  @HttpCode(200)
  @Post('reports/manual-payments')
  getManualPaymentReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getManualPaymentReport(body);
  }

  @HttpCode(200)
  @Post('reports/overall')
  getOverallReport(@Body() body: { startDate: string; endDate: string }) {
    return this.adminService.getOverallReport(body);
  }

  @Get('fee-config/:gameId')
  getGameFeeConfig(@Param('gameId') gameId: number) {
    return this.adminService.getGameFeeConfig(gameId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('fee-config/:gameId')
  upsertGameFeeConfig(
    @CurrentUser('sub') adminId: number,
    @Param('gameId') gameId: number,
    @Body() body: any,
  ) {
    return this.adminService.upsertGameFeeConfig(gameId, body, adminId);
  }

  @RequirePermission(Permission.Games)
  @Delete('fee-config/:gameId/:id')
  deleteGameFeeConfig(
    @CurrentUser('sub') adminId: number,
    @Param('gameId') gameId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteGameFeeConfig(gameId, id, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/pause')
  pauseGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.setGameControl(id, 'isPaused', 1, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/resume')
  resumeGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.setGameControl(id, 'isPaused', 0, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/hide')
  hideGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.setGameControl(id, 'isHidden', 1, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/show')
  showGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.setGameControl(id, 'isHidden', 0, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/emergency-stop')
  emergencyStop(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.emergencyStop(id, adminId);
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/emergency-resume')
  emergencyResume(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.setGameControl(id, 'emergencyStop', 0, adminId);
  }

  @Get('game-categories')
  getGameCategories() {
    return this.adminService.getGameCategories();
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('game-categories/:categoryId/hide')
  hideGameCategory(
    @CurrentUser('sub') adminId: number,
    @Param('categoryId') categoryId: number,
  ) {
    return this.adminService.setGameCategoryControl(
      categoryId,
      GameCategoryControlField.IsHidden,
      TinyFlag.Yes,
      adminId,
    );
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('game-categories/:categoryId/show')
  showGameCategory(
    @CurrentUser('sub') adminId: number,
    @Param('categoryId') categoryId: number,
  ) {
    return this.adminService.setGameCategoryControl(
      categoryId,
      GameCategoryControlField.IsHidden,
      TinyFlag.No,
      adminId,
    );
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('game-categories/:categoryId/emergency-stop')
  emergencyStopGameCategory(
    @CurrentUser('sub') adminId: number,
    @Param('categoryId') categoryId: number,
  ) {
    return this.adminService.setGameCategoryControl(
      categoryId,
      GameCategoryControlField.EmergencyStop,
      TinyFlag.Yes,
      adminId,
    );
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('game-categories/:categoryId/emergency-resume')
  emergencyResumeGameCategory(
    @CurrentUser('sub') adminId: number,
    @Param('categoryId') categoryId: number,
  ) {
    return this.adminService.setGameCategoryControl(
      categoryId,
      GameCategoryControlField.EmergencyStop,
      TinyFlag.No,
      adminId,
    );
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('games/:id/cycle')
  updateGameCycle(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateGameCycle(id, body, adminId);
  }

  @HttpCode(200)
  @Post('rebate/list')
  getAdminRebateRecords(@Body() body: any) {
    return this.adminService.getRebateRecords(body);
  }

  @Get('popups')
  getPopups() {
    return this.adminService.getPopups();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('popups')
  upsertPopup(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertPopup(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('popups/:id')
  deletePopup(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deletePopup(id, adminId);
  }

  @Get('activities')
  getActivities() {
    return this.adminService.getActivities();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('activities')
  upsertActivity(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertActivity(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('activities/:id')
  deleteActivity(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteActivity(id, adminId);
  }

  @Get('checkin/config')
  getCheckinConfig() {
    return this.adminService.getCheckinConfig();
  }

  @Get('checkin/records')
  getCheckinRecords() {
    return this.adminService.getCheckinRecords();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('checkin/config')
  upsertCheckinConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertCheckinConfig(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('checkin/config/:id')
  deleteCheckinConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteCheckinConfig(id, adminId);
  }

  @RequirePermission(Permission.Games)
  @Delete('games/:id')
  deleteGame(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteGame(id, adminId);
  }

  @Get('recharge-awards')
  getRechargeAwards() {
    return this.adminService.getRechargeAwards();
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('recharge-awards')
  upsertRechargeAward(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertRechargeAward(body, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Delete('recharge-awards/:id')
  deleteRechargeAward(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteRechargeAward(id, adminId);
  }

  @Get('rank-config')
  getRankConfigs() {
    return this.adminService.getRankConfigs();
  }

  @RequirePermission(Permission.Earn)
  @HttpCode(200)
  @Post('rank-config')
  upsertRankConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertRankConfig(body, adminId);
  }

  @RequirePermission(Permission.Earn)
  @Delete('rank-config/:id')
  deleteRankConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteRankConfig(id, adminId);
  }

  @Get('avatars')
  getAvatars() {
    return this.adminService.getAvatars();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('avatars')
  upsertAvatar(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertAvatar(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Delete('avatars/:id')
  deleteAvatar(@CurrentUser('sub') adminId: number, @Param('id') id: number) {
    return this.adminService.deleteAvatar(id, adminId);
  }

  @Get('share-posters')
  getSharePosters() {
    return this.adminService.getSharePosters();
  }

  @RequirePermission(Permission.Content)
  @HttpCode(200)
  @Post('share-posters')
  upsertSharePoster(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertSharePoster(body, adminId);
  }

  @RequirePermission(Permission.Content)
  @Delete('share-posters/:id')
  deleteSharePoster(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteSharePoster(id, adminId);
  }

  @HttpCode(200)
  @Post('wage-records/list')
  getWageRecords(@Body() body: any) {
    return this.adminService.getWageRecords(body);
  }

  @HttpCode(200)
  @Post('agent-commissions/list')
  getAgentCommissions(@Body() body: any) {
    return this.adminService.getAgentCommissions(body);
  }

  @Get('cdkeys')
  getCdkeyCodes() {
    return this.adminService.getCdkeyCodes();
  }

  @RequirePermission(Permission.Earn)
  @HttpCode(200)
  @Post('cdkeys')
  upsertCdkeyCode(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertCdkeyCode(body, adminId);
  }

  @RequirePermission(Permission.Earn)
  @Delete('cdkeys/:id')
  deleteCdkeyCode(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteCdkeyCode(id, adminId);
  }

  @Get('share-config')
  getShareConfigs() {
    return this.adminService.getShareConfigs();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('share-config')
  upsertShareConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertShareConfig(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Delete('share-config/:id')
  deleteShareConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteShareConfig(id, adminId);
  }

  @Get('transaction-types')
  getTransactionTypes() {
    return this.adminService.getTransactionTypes();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('transaction-types')
  upsertTransactionType(
    @CurrentUser('sub') adminId: number,
    @Body() body: any,
  ) {
    return this.adminService.upsertTransactionType(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Delete('transaction-types/:id')
  deleteTransactionType(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteTransactionType(id, adminId);
  }

  @HttpCode(200)
  @Post('lottery/draws')
  getLotteryDraws(@Body() body: any) {
    return this.adminService.getLotteryDraws(body);
  }

  @Get('lottery/draw-detail/:roundNo')
  getLotteryDrawDetail(
    @Param('roundNo') roundNo: string,
    @Query('gameId') gameId?: number,
  ) {
    return this.adminService.getLotteryDrawDetail(roundNo, gameId);
  }

  @Get('lottery/draw/:roundId')
  getLotteryDrawById(@Param('roundId') roundId: number) {
    return this.adminService.getLotteryDrawById(roundId);
  }

  @HttpCode(200)
  @Post('lottery/orders')
  getLotteryOrders(@Body() body: any) {
    return this.adminService.getLotteryOrders(body);
  }


  @Get('badge-counts')
  getBadgeCounts() {
    return this.adminService.getBadgeCounts();
  }

  @Get('games/live-status')
  getGamesLiveStatus() {
    return this.adminService.getGamesLiveStatus();
  }

  @Get('game-providers')
  getGameProviders() {
    return this.adminService.getGameProviders();
  }

  @RequirePermission(Permission.Games)
  @HttpCode(200)
  @Post('game-providers')
  upsertGameProvider(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertGameProvider(body, adminId);
  }

  @RequirePermission(Permission.Games)
  @Delete('game-providers/:id')
  deleteGameProvider(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deleteGameProvider(id, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Get('payment-gateways')
  getPaymentGateways() {
    return this.adminService.getPaymentGateways();
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('payment-gateways')
  upsertPaymentGateway(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.upsertPaymentGateway(body, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Delete('payment-gateways/:id')
  deletePaymentGateway(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
  ) {
    return this.adminService.deletePaymentGateway(id, adminId);
  }

  @RequirePermission(Permission.Finance)
  @Get('finance-config')
  getFinanceConfig() {
    return this.adminService.getFinanceConfig();
  }

  @RequirePermission(Permission.Finance)
  @HttpCode(200)
  @Post('finance-config')
  saveFinanceConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveFinanceConfig(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Get('app-config')
  getAppConfig() {
    return this.adminService.getAppConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('app-config')
  saveAppConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveAppConfig(body, adminId);
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('app-config/test/sms')
  testSms(@Body() body: TestSmsDto) {
    return this.adminService.testSmsDelivery(body);
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('app-config/test/whatsapp')
  testWhatsapp(@Body() body: TestWhatsappDto) {
    return this.adminService.testWhatsappDelivery(body);
  }

  @RequirePermission(Permission.System)
  @Get('third-party/config')
  getThirdPartyConfig() {
    return this.adminService.getThirdPartyConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('third-party/config')
  saveThirdPartyConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveThirdPartyConfig(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Get('app-version')
  getAppVersion() {
    return this.adminService.getAppVersion();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('app-version')
  saveAppVersion(
    @CurrentUser('sub') adminId: number,
    @Body() body: SaveAppVersionDto,
  ) {
    return this.adminService.saveAppVersion(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Get('firebase/config')
  getFirebaseConfig() {
    return this.adminService.getFirebaseConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('firebase/config')
  saveFirebaseConfig(
    @CurrentUser('sub') adminId: number,
    @Body() body: SaveFirebaseConfigDto,
  ) {
    return this.adminService.saveFirebaseConfig(body, adminId);
  }

  @RequirePermission(Permission.System)
  @Get('notification-templates')
  getNotificationTemplates() {
    return this.adminService.getNotificationTemplates();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('notification-templates')
  saveNotificationTemplate(
    @CurrentUser('sub') adminId: number,
    @Body() body: any,
  ) {
    return this.adminService.saveNotificationTemplate(body, adminId);
  }

  @Get('lobby-config')
  getLobbyConfig() {
    return this.adminService.getLobbyConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('lobby-config')
  saveLobbyConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveLobbyConfig(body, adminId);
  }

  @Get('ui-config')
  getUiConfig() {
    return this.adminService.getUiConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('ui-config')
  saveUiConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveUiConfig(body, adminId);
  }

  @Get('share-odds-config')
  getShareOddsConfig() {
    return this.adminService.getShareOddsConfig();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('share-odds-config')
  saveShareOddsConfig(@CurrentUser('sub') adminId: number, @Body() body: any) {
    return this.adminService.saveShareOddsConfig(body, adminId);
  }

  @HttpCode(200)
  @Post('race-frames/list')
  getRaceFrames(@Body() body: any) {
    return this.adminService.getRaceFrames(body);
  }

  @Get('config/meta')
  getConfigMeta() {
    return this.adminService.getConfigMeta();
  }

  @HttpCode(200)
  @Post('system/rounds/cleanup')
  cleanupGameRounds(
    @Body() body: { fromDate: string; toDate: string; dryRun?: boolean },
  ) {
    return this.adminService.cleanupGameRounds({
      fromDate: body.fromDate,
      toDate: body.toDate,
      dryRun: body.dryRun !== false,
    });
  }

  @Get('system/cron/status')
  getCronStatus() {
    return this.adminService.getCronStatus();
  }

  @RequirePermission(Permission.System)
  @Patch('system/cron/:name')
  updateCronJob(@Param('name') name: string, @Body() body: UpdateCronJobDto) {
    return this.adminService.updateCronJob(name, body);
  }

  @Get('config/grouped')
  getGroupedConfigs() {
    return this.adminService.getGroupedConfigs();
  }

  @RequirePermission(Permission.System)
  @HttpCode(200)
  @Post('config/bulk')
  bulkUpdateConfigs(
    @CurrentUser('sub') adminId: number,
    @Body() body: { updates: { key: string; value: string }[] },
  ) {
    return this.adminService.bulkUpdateConfigs(body.updates, adminId);
  }

  @Get('game-types')
  getGameTypes() {
    return this.adminService.getGameTypes();
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id/ui-config')
  updateGameUiConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateGameUiConfig(id, body, adminId);
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id/rules')
  updateGameRules(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateGameRules(id, body, adminId);
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id/result-config')
  updateGameResultConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: UpdateGameResultConfigDto,
  ) {
    return this.adminService.updateGameResultConfig(id, body, adminId);
  }

  @Get('games/digit-position-config')
  getDigitPositionConfig() {
    return this.adminService.getDigitPositionConfig();
  }

  @Get('games/:id/config')
  getGameConfig(@Param('id') id: number) {
    return this.adminService.getGameConfig(id);
  }

  @Get('games/:id/cashrain-windows')
  getCashrainWindows(@Param('id') id: number) {
    return this.adminService.getCashrainWindows(id);
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id/cashrain-windows')
  saveCashrainWindows(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body()
    body: {
      windows: {
        dayStart?: number;
        dayEnd?: number;
        startMinute: number;
        endMinute: number;
        maxClaimsPerUser?: number;
        status?: number;
      }[];
    },
  ) {
    return this.adminService.saveCashrainWindows(id, body.windows, adminId);
  }

  @RequirePermission(Permission.Games)
  @Get('games/:id/rounds/:roundId/slat-reading')
  getSlatResultReading(
    @Param('id') id: number,
    @Param('roundId') roundId: number,
    @Query('drawResult') drawResult?: string,
  ) {
    return this.adminService.getSlatResultReading(id, roundId, drawResult);
  }

  @RequirePermission(Permission.Games)
  @Put('games/:id/config')
  saveGameConfig(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: any,
  ) {
    return this.adminService.saveGameConfig(id, body, adminId);
  }

  @Get('lottery/list')
  getLotteryList() {
    return this.adminService.getLotteryList();
  }

  @Get('lottery/:id/overview')
  getLotteryOverview(@Param('id') id: number) {
    return this.adminService.getLotteryOverview(id);
  }

  @HttpCode(200)
  @Post('lottery/:id/stats')
  getLotteryStats(
    @Param('id') id: number,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.adminService.getLotteryPnL(id, body);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('lottery/:id/toggle-mode')
  toggleLotteryMode(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: { autoGenerate: boolean },
  ) {
    return this.adminService.toggleLotteryMode(id, body.autoGenerate, adminId);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('lottery/:id/create-round')
  createLotteryRound(
    @CurrentUser('sub') adminId: number,
    @Param('id') id: number,
    @Body() body: { drawTime: string },
  ) {
    return this.adminService.createLotteryRound(id, body.drawTime, adminId);
  }

  @Get('draws/:roundId/analysis')
  getDrawAnalysis(@Param('roundId') roundId: number) {
    return this.adminService.getDrawAnalysis(roundId);
  }

  @HttpCode(200)
  @Post('draws/:roundId/preview')
  previewDrawResult(
    @Param('roundId') roundId: number,
    @Body() body: { result: any },
  ) {
    return this.adminService.previewDrawResult(roundId, body.result);
  }

  @Get('draws/:roundId/recommend')
  getDrawRecommendations(@Param('roundId') roundId: number) {
    return this.adminService.getDrawRecommendations(roundId);
  }

  @HttpCode(200)
  @Post('result-decisions')
  getResultDecisions(
    @Body()
    body: {
      gameId?: number;
      mode?: string;
      pageNo?: number;
      pageSize?: number;
    },
  ) {
    return this.adminService.getResultDecisions(body);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/:roundId/confirm')
  confirmDrawResult(
    @CurrentUser('sub') adminId: number,
    @Param('roundId') roundId: number,
    @Body() body: { result: any },
  ) {
    return this.adminService.confirmDrawResult(roundId, body.result, adminId);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/:roundId/propose')
  proposeDrawResult(
    @CurrentUser('sub') adminId: number,
    @Param('roundId') roundId: number,
    @Body() body: { result?: any; mode?: string },
  ) {
    return this.adminService.proposeDrawResult(roundId, adminId, body);
  }

  @RequirePermission(Permission.Lottery)
  @HttpCode(200)
  @Post('draws/:roundId/approve')
  approveDrawResult(
    @CurrentUser('sub') adminId: number,
    @Param('roundId') roundId: number,
    @Body() body: { result?: any },
  ) {
    return this.adminService.approveDrawResult(roundId, adminId, body?.result);
  }
}
