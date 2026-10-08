import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  HttpCode,
  HttpException,
  HttpStatus,
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
  roundId?: number | string | null;
  slot?: number | string | null;
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
  listSlots(
    @Param('gameId') gameId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportService.listSlots(Number(gameId), {
      startDate: this.emptyToNull(startDate),
      endDate: this.emptyToNull(endDate),
    });
  }

  @HttpCode(200)
  @Post('profit-loss/preview')
  profitLossPreview(@Body() body: ReportFilterInput) {
    return this.reportService.getProfitLoss(this.normalize(body));
  }

  @HttpCode(200)
  @Post('number-wise/preview')
  numberWisePreview(@Body() body: ReportFilterInput) {
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
    @Query('roundId') roundId: string,
    @Query('slot') slot: string,
    @Query('digitLength') digitLength: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    try {
      const filter = this.normalize({
        gameId: Number(gameId),
        roundId,
        slot,
        digitLength,
        startDate,
        endDate,
      });
      const report = await this.reportService.getProfitLoss(filter);
      const pdf = await buildProfitLossPdf(report);
      this.send(
        res,
        pdf,
        this.fileName('Profit_Loss_Report', report.gameName, report.roundNo),
      );
    } catch (err) {
      this.fail(res, err);
    }
  }

  @Get('number-wise/download')
  async downloadNumberWise(
    @CurrentUser('sub') _adminId: number,
    @Query('gameId') gameId: string,
    @Query('roundId') roundId: string,
    @Query('slot') slot: string,
    @Query('digitLength') digitLength: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    try {
      const filter = this.normalize({
        gameId: Number(gameId),
        roundId,
        slot,
        digitLength,
        startDate,
        endDate,
      });
      const report = await this.reportService.getNumberWise(filter);
      const pdf = await buildNumberWisePdf(report);
      this.send(
        res,
        pdf,
        this.fileName('Number_Wise_Sales', report.gameName, report.roundNo),
      );
    } catch (err) {
      this.fail(res, err);
    }
  }

  private normalize(body: ReportFilterInput): ReportFilter {
    const roundIdRaw = body.roundId;
    const roundId =
      roundIdRaw === undefined ||
      roundIdRaw === null ||
      roundIdRaw === '' ||
      roundIdRaw === 'all' ||
      roundIdRaw === 'All'
        ? null
        : Number(roundIdRaw);
    const slotRaw = body.slot;
    const slot =
      slotRaw === undefined ||
      slotRaw === null ||
      slotRaw === '' ||
      slotRaw === 'all' ||
      slotRaw === 'All'
        ? null
        : Number(slotRaw);
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
      roundId,
      slot,
      digitLength,
      startDate: this.emptyToNull(body.startDate),
      endDate: this.emptyToNull(body.endDate),
    };
  }

  private emptyToNull(value: string | null | undefined): string | null {
    return value !== undefined && value !== null && value !== '' ? value : null;
  }

  private fileName(
    prefix: string,
    gameName: string,
    roundNo: string | null | undefined,
  ): string {
    const safe = this.safeSegment(gameName);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const roundPart = roundNo ? `_${this.safeSegment(roundNo)}` : '';
    return `${prefix}_${safe}${roundPart}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
  }

  private safeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private send(res: Response, pdf: Buffer, fileName: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }

  private fail(res: Response, err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed';
    const status =
      err instanceof HttpException
        ? err.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({ code: 1, msg, data: null });
  }
}
