import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FinanceService } from './finance.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ThrottleProfile,
  FINANCE_LIMIT,
} from '../../common/throttle/throttle.config';
import {
  CreateRechargeDto,
  CreateWithdrawalDto,
  TransferBalanceDto,
  AddBankCardDto,
  EditBankCardDto,
  AgentReportDto,
  AgentTableDto,
  AgentDetailDto,
  PaginationDto,
  RecordQueryDto,
  TransactionQueryDto,
  RebateQueryDto,
  ClaimByIdDto,
  VipLevelDto,
} from './dto';

@Controller('hall/api/finance/v2')
export class FinanceAgentController {
  constructor(private financeService: FinanceService) {}

  @HttpCode(200)
  @Post('agent/panel')
  getAgentPanel(@CurrentUser('userId') userId: string) {
    return this.financeService.getAgentPanel(userId);
  }

  @Public()
  @HttpCode(200)
  @Post('agent/rule')
  getAgentRule() {
    return this.financeService.getAgentRule();
  }

  @HttpCode(200)
  @Post('agent/report')
  getAgentReport(
    @CurrentUser('userId') userId: string,
    @Body() body: AgentReportDto,
  ) {
    return this.financeService.getAgentReport(userId, body);
  }

  @HttpCode(200)
  @Post('agent/table')
  getAgentTable(
    @CurrentUser('userId') userId: string,
    @Body() body: AgentTableDto,
  ) {
    return this.financeService.getAgentTable(userId, body);
  }

  @HttpCode(200)
  @Post('agent/detail')
  getAgentDetail(
    @CurrentUser('userId') userId: string,
    @Body() body: AgentDetailDto,
  ) {
    return this.financeService.getAgentDetail(userId, {
      targetUserId: String(body.userId),
    });
  }
}

@Controller('hall/api/finance/v1')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @HttpCode(200)
  @Post('user/wlt')
  getWallet(@CurrentUser('userId') userId: string) {
    return this.financeService.getWallet(userId);
  }

  @Public()
  @HttpCode(200)
  @Post('rc/panel')
  getRechargePanel() {
    return this.financeService.getRechargePanel();
  }

  @Throttle({ [ThrottleProfile.Default]: FINANCE_LIMIT })
  @HttpCode(200)
  @Post('rc/balance')
  createRecharge(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateRechargeDto,
  ) {
    return this.financeService.createRecharge(userId, body);
  }

  @HttpCode(200)
  @Post('rc/records')
  getRechargeRecords(
    @CurrentUser('userId') userId: string,
    @Body() body: RecordQueryDto,
  ) {
    return this.financeService.getRechargeRecords(userId, body);
  }

  @HttpCode(200)
  @Post('card/list')
  getBankCards(@CurrentUser('userId') userId: string) {
    return this.financeService.getBankCards(userId);
  }

  @HttpCode(200)
  @Post('card/add')
  addBankCard(
    @CurrentUser('userId') userId: string,
    @Body() body: AddBankCardDto,
  ) {
    return this.financeService.addBankCard(userId, body);
  }

  @HttpCode(200)
  @Post('card/edit')
  updateBankCard(
    @CurrentUser('userId') userId: string,
    @Body() body: EditBankCardDto,
  ) {
    return this.financeService.updateBankCard(userId, body);
  }

  @HttpCode(200)
  @Post('wd/panel')
  getWithdrawPanel(@CurrentUser('userId') userId: string) {
    return this.financeService.getWithdrawPanel(userId);
  }

  @Throttle({ [ThrottleProfile.Default]: FINANCE_LIMIT })
  @HttpCode(200)
  @Post('wd/balance')
  createWithdrawal(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateWithdrawalDto,
  ) {
    return this.financeService.createWithdrawal(userId, body);
  }

  @HttpCode(200)
  @Post('wd/records')
  getWithdrawRecords(
    @CurrentUser('userId') userId: string,
    @Body() body: RecordQueryDto,
  ) {
    return this.financeService.getWithdrawRecords(userId, body);
  }

  @HttpCode(200)
  @Post('trf/list')
  getTransferList(@CurrentUser('userId') userId: string) {
    return this.financeService.getTransferList(userId);
  }

  @HttpCode(200)
  @Post('trf/balance')
  transferBalance(
    @CurrentUser('userId') userId: string,
    @Body() body: TransferBalanceDto,
  ) {
    return this.financeService.transferBalance(userId, body);
  }

  @HttpCode(200)
  @Post('trf/records')
  getTransferRecords(
    @CurrentUser('userId') userId: string,
    @Body() body: PaginationDto,
  ) {
    return this.financeService.getTransferRecords(userId, body);
  }

  @Public()
  @HttpCode(200)
  @Post('txn/types')
  getTransactionTypes() {
    return this.financeService.getTransactionTypes();
  }

  @HttpCode(200)
  @Post('txn/records')
  getTransactionRecords(
    @CurrentUser('userId') userId: string,
    @Body() body: TransactionQueryDto,
  ) {
    return this.financeService.getTransactionRecords(userId, body);
  }

  @HttpCode(200)
  @Post('rebate/records')
  getRebateRecords(
    @CurrentUser('userId') userId: string,
    @Body() body: RebateQueryDto,
  ) {
    return this.financeService.getRebateRecords(userId, body);
  }

  @HttpCode(200)
  @Post('rebate/receive')
  claimRebate(
    @CurrentUser('userId') userId: string,
    @Body() body: ClaimByIdDto,
  ) {
    return this.financeService.claimRebate(userId, body.id);
  }

  @HttpCode(200)
  @Post('vip/panel')
  getVipPanel(@CurrentUser('userId') userId: string) {
    return this.financeService.getVipPanel(userId);
  }

  @HttpCode(200)
  @Post('vip/award')
  claimVipAward(
    @CurrentUser('userId') userId: string,
    @Body() body: VipLevelDto,
  ) {
    return this.financeService.claimVipAward(userId, body.vipLevel);
  }

  @HttpCode(200)
  @Post('vip/monthly-award')
  claimVipMonthly(
    @CurrentUser('userId') userId: string,
    @Body() body: VipLevelDto,
  ) {
    return this.financeService.claimVipMonthly(userId, body.vipLevel);
  }

  @HttpCode(200)
  @Post('wage/info')
  getWageInfo(@CurrentUser('userId') userId: string) {
    return this.financeService.getWageInfo(userId);
  }

  @HttpCode(200)
  @Post('wage/award')
  claimWageAward(@CurrentUser('userId') userId: string) {
    return this.financeService.claimWageAward(userId);
  }
}
