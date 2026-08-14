import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { LotteryReportService } from './lottery-report.service';
import type { ReportFilter } from './lottery-report.service';
import { buildProfitLossPdf, buildNumberWisePdf } from './lottery-report.pdf';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/enums/permission.enum';

interface ReportFilterInput {
  gameId: number | string;
  roundNo?: string | null;
  slot?: number | string | null;
  slotTime?: string | null;
  digitLength?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
}

@Controller('admin/api/v1/lottery/report')
export class LotteryReportController {
  constructor(private reportService: LotteryReportService) {}

  @Get('games')
  listGames() {
    return this.reportService.listReportableGames();
  }

  @RequirePermission(Permission.Reports)
  @Get('manual-draws')
  listManualDraws(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.listManualLotteryDraws({
      startDate: this.emptyToNull(startDate),
      endDate: this.emptyToNull(endDate),
    });
  }

  @Get('slots/:gameId')
  listSlots(@Param('gameId') gameId: string) {
    return this.reportService.listSlots(Number(gameId));
  }

  @HttpCode(200)
  @Post('profit-loss/preview')
  profitLossPreview(@Body() body: ReportFilter) {
    return this.reportService.getProfitLoss(this.normalize(body));
  }

  @HttpCode(200)
  @Post('number-wise/preview')
  numberWisePreview(@Body() body: ReportFilter) {
    return this.reportService.getNumberWise(this.normalize(body));
  }

  @HttpCode(200)
  @Post('rebuild')
  rebuild(@Body() body: { gameId: number }) {
    return this.reportService.rebuildRollup(Number(body.gameId));
  }

  @Get('profit-loss/download')
  async downloadProfitLoss(
    @CurrentUser('sub') _adminId: number,
    @Query('gameId') gameId: string,
    @Query('roundNo') roundNo: string,
    @Query('slot') slot: string,
    @Query('slotTime') slotTime: string,
    @Query('digitLength') digitLength: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    try {
      const report = await this.reportService.getProfitLoss(
        this.normalize({
          gameId: Number(gameId),
          roundNo,
          slot,
          slotTime,
          digitLength,
          startDate,
          endDate,
        }),
      );
      const pdf = await buildProfitLossPdf(report);
      this.send(res, pdf, this.fileName('Profit_Loss_Report', report.gameName));
    } catch (err) {
      this.fail(res, err);
    }
  }

  @Get('number-wise/download')
  async downloadNumberWise(
    @CurrentUser('sub') _adminId: number,
    @Query('gameId') gameId: string,
    @Query('roundNo') roundNo: string,
    @Query('slot') slot: string,
    @Query('slotTime') slotTime: string,
    @Query('digitLength') digitLength: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    try {
      const report = await this.reportService.getNumberWise(
        this.normalize({
          gameId: Number(gameId),
          roundNo,
          slot,
          slotTime,
          digitLength,
          startDate,
          endDate,
        }),
      );
      const pdf = await buildNumberWisePdf(report);
      this.send(res, pdf, this.fileName('Number_Wise_Sales', report.gameName));
    } catch (err) {
      this.fail(res, err);
    }
  }

  private normalize(body: ReportFilterInput): ReportFilter {
    const roundNo = this.emptyToNull(body.roundNo);
    const slotRaw = body.slot;
    const slot =
      slotRaw === undefined ||
      slotRaw === null ||
      slotRaw === '' ||
      slotRaw === 'all' ||
      slotRaw === 'All'
        ? null
        : Number(slotRaw);
    const slotTimeRaw = body.slotTime;
    const slotTime =
      slotTimeRaw === undefined ||
      slotTimeRaw === null ||
      slotTimeRaw === '' ||
      slotTimeRaw === 'all' ||
      slotTimeRaw === 'All'
        ? null
        : String(slotTimeRaw);
    const digitRaw = body.digitLength;
    const digitLength =
      digitRaw === undefined ||
      digitRaw === null ||
      digitRaw === '' ||
      digitRaw === 'all' ||
      digitRaw === 'All'
        ? null
        : Number(digitRaw);
    return {
      gameId: Number(body.gameId),
      roundNo,
      slot,
      slotTime,
      digitLength,
      startDate: this.emptyToNull(body.startDate),
      endDate: this.emptyToNull(body.endDate),
    };
  }

  private emptyToNull(value: string | null | undefined): string | null {
    return value !== undefined && value !== null && value !== '' ? value : null;
  }

  private fileName(prefix: string, gameName: string): string {
    const safe = gameName
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${prefix}_${safe}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
  }

  private send(res: Response, pdf: Buffer, fileName: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }

  private fail(res: Response, err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed';
    res.status(500).json({ code: 1, msg, data: null });
  }
}
