import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LotterySalesRollup } from '../../entities/lottery-sales-rollup.entity';
import { GameList } from '../../entities/game-list.entity';
import { GameRound } from '../../entities/game-round.entity';
import { GameSlatTier } from '../../entities/game-slat-tier.entity';
import { TinyFlag, CronJobName, OrderStatus } from '../../common/enums';
import { CronRunRecorderService } from '../cron/cron-run-recorder.service';

export interface ReportFilter {
  gameId: number;
  roundNo?: string | null;
  slot?: number | null;
  slotTime?: string | null;
  digitLength?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DrawSlotView {
  value: string;
  label: string;
}

export interface SlotListView {
  isMultiDraw: boolean;
  drawSlots: DrawSlotView[];
  digitLengths: DrawSlotView[];
}

export interface ManualLotteryDrawView {
  gameId: number;
  gameName: string;
  iconUrl: string | null;
  gameType: string;
  roundNo: string;
  phase: number;
  startDate: string | null;
  drawDate: string | null;
  status: number;
}

export interface ProfitLossRow {
  type: string;
  slot: number;
  winPrice: number;
  salesQty: number;
  drawQty: number;
  saleCost: number;
  drawCost: number;
  profitLoss: number;
}

export interface ProfitLossReport {
  pageTitle: string;
  gameName: string;
  generatedAt: string;
  rows: ProfitLossRow[];
  lotTotals: {
    label: string;
    salesQty: number;
    drawQty: number;
    sale: number;
    draw: number;
    pl: number;
  }[];
  grandSaleCost: number;
  grandDrawCost: number;
  grandPL: number;
}

export interface NumberWiseRow {
  date: string;
  slotLabel: string;
  username: string;
  ticketType: string;
  number: string;
  qty: number;
  winPrice: number;
  ticketPrice: number;
}

export interface NumberWiseGroup {
  slotLabel: string;
  orderKey: number;
  subtotalLabel: string;
  rows: NumberWiseRow[];
  totalQty: number;
}

export interface NumberWiseSummaryRow {
  slotLabel: string;
  unitPrice: number;
  winPrice: number;
  totalQty: number;
  totalPrice: number;
}

export interface NumberWiseReport {
  pageTitle: string;
  gameName: string;
  generatedAt: string;
  groups: NumberWiseGroup[];
  grandTotalQty: number;
  showGrandTotal: boolean;
  summaryRows: NumberWiseSummaryRow[];
  grandSummaryQty: number;
  grandSummaryPrice: number;
}

const LEN_LABEL: Record<number, string> = {
  1: 'Single',
  2: 'Double',
  3: 'Triple',
  4: 'Quadruple',
};

interface ProfitLossAggRow {
  position: string;
  posLen: number;
  slot: number;
  price: number;
  winPrice: number;
  salesQty: number;
  drawQty: number;
  drawAmount: number;
}

interface SlatOrderAggRow {
  drawDate: string;
  slotTime: string;
  inviteCode: string | null;
  betType: string;
  number: string;
  winPrice: string;
  slatProductId: string | null;
  posLen: number;
  qty: string;
  ticketPrice: string;
}

interface SlatSlotInfo {
  productId: number;
  slotLabel: string;
  unitPrice: number;
  winPrice: number;
  sortOrder: number;
}

interface SlatHeadlineRow {
  productId: string;
  title: string;
  unitPrice: string;
  winAmount: string;
  sortOrder: string;
}

@Injectable()
export class LotteryReportService {
  private readonly logger = new Logger(LotteryReportService.name);

  constructor(
    @InjectRepository(LotterySalesRollup)
    private rollupRepo: Repository<LotterySalesRollup>,
    @InjectRepository(GameList) private gameRepo: Repository<GameList>,
    @InjectRepository(GameRound) private roundRepo: Repository<GameRound>,
    @InjectRepository(GameSlatTier)
    private slatTierRepo: Repository<GameSlatTier>,
    private dataSource: DataSource,
    private recorder: CronRunRecorderService,
  ) {}

  async listReportableGames(): Promise<{ gameId: number; gameName: string }[]> {
    const games = await this.gameRepo.find({
      where: { isLottery: TinyFlag.Yes },
      order: { sortOrder: 'ASC', gameName: 'ASC' },
    });
    return games.map((g) => ({ gameId: g.id, gameName: g.gameName }));
  }

  async listManualLotteryDraws(range?: {
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<ManualLotteryDrawView[]> {
    const games = await this.gameRepo.find({
      where: { isLottery: TinyFlag.Yes, autoGenerate: TinyFlag.No },
      order: { sortOrder: 'ASC', gameName: 'ASC' },
    });
    const startMs = this.dayStartMs(range?.startDate);
    const endMs = this.dayEndMs(range?.endDate);
    const out: ManualLotteryDrawView[] = [];
    for (const game of games) {
      const rounds = await this.roundRepo.find({
        where: { gameId: game.id },
        order: { drawTime: 'ASC', id: 'ASC' },
      });
      rounds.forEach((round, index) => {
        const drawMs = round.drawTime
          ? new Date(round.drawTime).getTime()
          : NaN;
        if (startMs !== null && !(drawMs >= startMs)) return;
        if (endMs !== null && !(drawMs <= endMs)) return;
        out.push({
          gameId: game.id,
          gameName: game.gameName,
          iconUrl: game.iconUrl ?? null,
          gameType: game.gameType,
          roundNo: round.roundNo,
          phase: index + 1,
          startDate: this.toIsoOrNull(round.createdAt),
          drawDate: this.toIsoOrNull(round.drawTime),
          status: round.status,
        });
      });
    }
    return out.sort((a, b) => {
      const aDraw = a.drawDate ?? '';
      const bDraw = b.drawDate ?? '';
      if (aDraw !== bDraw) return bDraw.localeCompare(aDraw);
      return a.gameName.localeCompare(b.gameName);
    });
  }

  private dayStartMs(date: string | null | undefined): number | null {
    if (!date) return null;
    const ms = new Date(`${date}T00:00:00`).getTime();
    return isNaN(ms) ? null : ms;
  }

  private dayEndMs(date: string | null | undefined): number | null {
    if (!date) return null;
    const ms = new Date(`${date}T23:59:59.999`).getTime();
    return isNaN(ms) ? null : ms;
  }

  private toIsoOrNull(value: Date | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  async listSlots(gameId: number): Promise<SlotListView> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    const isManual =
      game?.isLottery === TinyFlag.Yes && game?.autoGenerate === TinyFlag.No;
    const digitLengths = await this.listDigitLengths(gameId);
    if (!isManual) return { isMultiDraw: false, drawSlots: [], digitLengths };

    const configSlots = await this.configDrawSlots(gameId);
    const dataSlots = await this.dataDrawSlots(gameId);
    const byValue = new Map<string, DrawSlotView>();
    for (const slot of [...configSlots, ...dataSlots]) {
      if (!byValue.has(slot.value)) byValue.set(slot.value, slot);
    }
    const drawSlots = [...byValue.values()].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    return { isMultiDraw: configSlots.length > 1, drawSlots, digitLengths };
  }

  private async listDigitLengths(gameId: number): Promise<DrawSlotView[]> {
    const rows = await this.rollupRepo
      .createQueryBuilder('r')
      .select('DISTINCT CHAR_LENGTH(r.number)', 'numLen')
      .where('r.game_id = :gameId', { gameId })
      .andWhere('CHAR_LENGTH(r.number) > 0')
      .orderBy('numLen', 'ASC')
      .getRawMany();
    return rows.map((r) => {
      const len = Number(r.numLen);
      return { value: String(len), label: this.lenLabel(len) };
    });
  }

  private lenLabel(len: number): string {
    return Object.prototype.hasOwnProperty.call(LEN_LABEL, len)
      ? LEN_LABEL[len]
      : `${len}-Digit`;
  }

  private async configDrawSlots(gameId: number): Promise<DrawSlotView[]> {
    const rows = await this.roundRepo
      .createQueryBuilder('gr')
      .select("DISTINCT TIME_FORMAT(gr.draw_time, '%H:%i')", 'slotTime')
      .where('gr.game_id = :gameId', { gameId })
      .andWhere('gr.draw_time IS NOT NULL')
      .orderBy('slotTime', 'ASC')
      .getRawMany();
    return rows
      .filter((r) => r.slotTime)
      .map((r) => ({
        value: r.slotTime,
        label: this.labelFromHHMM(r.slotTime),
      }));
  }

  private async dataDrawSlots(gameId: number): Promise<DrawSlotView[]> {
    const rows = await this.rollupRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.slot_time', 'slotTime')
      .where('r.game_id = :gameId', { gameId })
      .andWhere("r.slot_time <> ''")
      .orderBy('slotTime', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      value: r.slotTime,
      label: this.labelFromHHMM(r.slotTime),
    }));
  }

  private labelFromHHMM(hhmm: string): string {
    const [hStr, mStr] = hhmm.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (isNaN(h) || isNaN(m)) return hhmm;
    const total = (((h * 60 + m) % 1440) + 1440) % 1440;
    let dh = Math.floor(total / 60);
    const dm = total % 60;
    const ampm = dh >= 12 ? 'PM' : 'AM';
    dh = dh % 12 === 0 ? 12 : dh % 12;
    return `${dh}:${String(dm).padStart(2, '0')} ${ampm}`;
  }

  private buildQuery(filter: ReportFilter) {
    const qb = this.rollupRepo
      .createQueryBuilder('r')
      .where('r.game_id = :gameId', { gameId: filter.gameId });
    if (filter.roundNo)
      qb.andWhere('r.round_no = :roundNo', { roundNo: filter.roundNo });
    if (filter.slot != null && !isNaN(filter.slot))
      qb.andWhere('r.slot = :slot', { slot: filter.slot });
    if (filter.slotTime)
      qb.andWhere('r.slot_time = :slotTime', { slotTime: filter.slotTime });
    if (filter.digitLength != null && !isNaN(filter.digitLength))
      qb.andWhere('CHAR_LENGTH(r.number) = :digitLength', {
        digitLength: filter.digitLength,
      });
    if (filter.startDate)
      qb.andWhere('r.draw_date >= :startDate', { startDate: filter.startDate });
    if (filter.endDate)
      qb.andWhere('r.draw_date <= :endDate', { endDate: filter.endDate });
    return qb;
  }

  private readonly DISPLAY_TZ_OFFSET_MIN = 330;

  private formatNow(): string {
    const d = new Date(Date.now() + this.DISPLAY_TZ_OFFSET_MIN * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    let h = d.getUTCHours();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 === 0 ? 12 : h % 12;
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(h)}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${ampm}`;
  }

  private async gameName(gameId: number): Promise<string> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    return game ? game.gameName : `Game ${gameId}`;
  }

  async getProfitLoss(filter: ReportFilter): Promise<ProfitLossReport> {
    await this.refreshRollupForFilter(filter);
    const gameName = await this.gameName(filter.gameId);
    const agg = await this.buildQuery(filter)
      .select('r.position', 'position')
      .addSelect('CHAR_LENGTH(r.number)', 'posLen')
      .addSelect('r.slot', 'slot')
      .addSelect('r.price', 'price')
      .addSelect('r.win_price', 'winPrice')
      .addSelect('COALESCE(SUM(r.sales_qty), 0)', 'salesQty')
      .addSelect('COALESCE(SUM(r.draw_qty), 0)', 'drawQty')
      .addSelect('COALESCE(SUM(r.draw_amount), 0)', 'drawAmount')
      .groupBy('r.position')
      .addGroupBy('CHAR_LENGTH(r.number)')
      .addGroupBy('r.slot')
      .addGroupBy('r.price')
      .addGroupBy('r.win_price')
      .orderBy('CHAR_LENGTH(r.number)', 'ASC')
      .addOrderBy('r.slot', 'ASC')
      .addOrderBy('r.position', 'ASC')
      .getRawMany<ProfitLossAggRow>();

    const rows: ProfitLossRow[] = agg.map((r) => {
      const salesQty = Number(r.salesQty);
      const drawQty = Number(r.drawQty);
      const price = Number(r.price);
      const winPrice = Number(r.winPrice);
      const saleCost = salesQty * price;
      const drawCost = Number(r.drawAmount);
      return {
        type: r.position,
        slot: Number(r.slot),
        winPrice,
        salesQty,
        drawQty,
        saleCost: Number(saleCost.toFixed(2)),
        drawCost: Number(drawCost.toFixed(2)),
        profitLoss: Number((saleCost - drawCost).toFixed(2)),
      };
    });

    const lotMap = new Map<
      number,
      {
        label: string;
        salesQty: number;
        drawQty: number;
        sale: number;
        draw: number;
        pl: number;
      }
    >();
    for (const r of agg) {
      const len = Number(r.posLen);
      const salesQty = Number(r.salesQty);
      const drawQty = Number(r.drawQty);
      const sale = salesQty * Number(r.price);
      const draw = Number(r.drawAmount);
      let existing = lotMap.get(len);
      if (!existing) {
        existing = {
          label: `${this.lenLabel(len)} Lot Total`,
          salesQty: 0,
          drawQty: 0,
          sale: 0,
          draw: 0,
          pl: 0,
        };
      }
      existing.salesQty += salesQty;
      existing.drawQty += drawQty;
      existing.sale += sale;
      existing.draw += draw;
      existing.pl += sale - draw;
      lotMap.set(len, existing);
    }
    const lotTotals = [...lotMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        label: v.label,
        salesQty: v.salesQty,
        drawQty: v.drawQty,
        sale: Number(v.sale.toFixed(2)),
        draw: Number(v.draw.toFixed(2)),
        pl: Number(v.pl.toFixed(2)),
      }));

    const grandSaleCost = Number(
      rows.reduce((s, r) => s + r.saleCost, 0).toFixed(2),
    );
    const grandDrawCost = Number(
      rows.reduce((s, r) => s + r.drawCost, 0).toFixed(2),
    );

    return {
      pageTitle: `${gameName} - Profit & Loss Report`,
      gameName,
      generatedAt: this.formatNow(),
      rows,
      lotTotals,
      grandSaleCost,
      grandDrawCost,
      grandPL: Number((grandSaleCost - grandDrawCost).toFixed(2)),
    };
  }

  async getNumberWise(filter: ReportFilter): Promise<NumberWiseReport> {
    const gameName = await this.gameName(filter.gameId);
    const slotByProduct = await this.buildSlatSlotIndex(filter.gameId);
    const rows = await this.queryNumberWiseRows(filter);

    const groupMap = new Map<number, NumberWiseGroup>();
    const summaryMap = new Map<number, NumberWiseSummaryRow>();
    for (const raw of rows) {
      const productId = Number(raw.slatProductId);
      if (isNaN(productId)) continue;
      const winPrice = Number(raw.winPrice);
      const qty = Number(raw.qty);
      const ticketPrice = Number(Number(raw.ticketPrice).toFixed(2));
      const posLen = Number(raw.posLen);
      const slot = slotByProduct.get(productId) ?? {
        productId,
        slotLabel: raw.betType,
        unitPrice: qty > 0 ? Number((ticketPrice / qty).toFixed(2)) : 0,
        winPrice,
        sortOrder: Number.MAX_SAFE_INTEGER,
      };

      let group = groupMap.get(productId);
      if (!group) {
        group = {
          slotLabel: slot.slotLabel,
          orderKey: slot.sortOrder,
          subtotalLabel: this.subtotalLabel(posLen, slot.winPrice),
          rows: [],
          totalQty: 0,
        };
        groupMap.set(productId, group);
      }
      group.rows.push({
        date: this.formatSqlDate(raw.drawDate),
        slotLabel: slot.slotLabel,
        username: raw.inviteCode ?? '',
        ticketType: raw.betType,
        number: raw.number,
        qty,
        winPrice,
        ticketPrice,
      });
      group.totalQty += qty;

      let summary = summaryMap.get(productId);
      if (!summary) {
        summary = {
          slotLabel: slot.slotLabel,
          unitPrice: slot.unitPrice,
          winPrice: slot.winPrice,
          totalQty: 0,
          totalPrice: 0,
        };
        summaryMap.set(productId, summary);
      }
      summary.totalQty += qty;
      summary.totalPrice += ticketPrice;
    }

    const groups = [...groupMap.values()].sort(
      (a, b) => a.orderKey - b.orderKey,
    );
    for (const group of groups) {
      group.rows.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.username !== b.username)
          return a.username.localeCompare(b.username);
        if (a.ticketType !== b.ticketType)
          return a.ticketType.localeCompare(b.ticketType);
        return a.number.localeCompare(b.number);
      });
    }

    const summaryRows = [...summaryMap.entries()]
      .sort(
        ([idA], [idB]) =>
          (slotByProduct.get(idA)?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (slotByProduct.get(idB)?.sortOrder ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([, s]) => ({ ...s, totalPrice: Number(s.totalPrice.toFixed(2)) }));

    return {
      pageTitle: `${gameName} - Number Wise Sales Report`,
      gameName,
      generatedAt: this.formatNow(),
      groups,
      grandTotalQty: groups.reduce((s, g) => s + g.totalQty, 0),
      showGrandTotal: groups.length > 1,
      summaryRows,
      grandSummaryQty: summaryRows.reduce((s, r) => s + r.totalQty, 0),
      grandSummaryPrice: Number(
        summaryRows.reduce((s, r) => s + r.totalPrice, 0).toFixed(2),
      ),
    };
  }

  private async buildSlatSlotIndex(
    gameId: number,
  ): Promise<Map<number, SlatSlotInfo>> {
    const rows = await this.slatTierRepo
      .createQueryBuilder('t')
      .innerJoin('game_slat_product', 'p', 'p.id = t.product_id')
      .select('p.id', 'productId')
      .addSelect('p.title', 'title')
      .addSelect('p.price', 'unitPrice')
      .addSelect('p.sort_order', 'sortOrder')
      .addSelect('MAX(t.win_amount)', 'winAmount')
      .where('p.game_id = :gameId', { gameId })
      .groupBy('p.id')
      .addGroupBy('p.title')
      .addGroupBy('p.price')
      .addGroupBy('p.sort_order')
      .getRawMany<SlatHeadlineRow>();
    const map = new Map<number, SlatSlotInfo>();
    for (const row of rows) {
      const productId = Number(row.productId);
      map.set(productId, {
        productId,
        slotLabel: row.title,
        unitPrice: Number(row.unitPrice),
        winPrice: Number(row.winAmount),
        sortOrder: Number(row.sortOrder),
      });
    }
    return map;
  }

  private async queryNumberWiseRows(
    filter: ReportFilter,
  ): Promise<SlatOrderAggRow[]> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select("DATE_FORMAT(o.created_at, '%Y-%m-%d')", 'drawDate')
      .addSelect("TIME_FORMAT(gr.draw_time, '%H:%i')", 'slotTime')
      .addSelect('u.invite_code', 'inviteCode')
      .addSelect(
        "JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.betType'))",
        'betType',
      )
      .addSelect(
        "JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.numbers'))",
        'number',
      )
      .addSelect(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.winPrice')) AS DECIMAL(16,2))",
        'winPrice',
      )
      .addSelect(
        "JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.slatProductId'))",
        'slatProductId',
      )
      .addSelect(
        "CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.numbers')))",
        'posLen',
      )
      .addSelect('COALESCE(SUM(o.quantity), 0)', 'qty')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'ticketPrice')
      .from('orders', 'o')
      .innerJoin(
        'game_rounds',
        'gr',
        'gr.game_id = o.game_id AND gr.round_no = o.round_no',
      )
      .leftJoin('users', 'u', 'u.user_id = o.user_id')
      .where('o.game_id = :gameId', { gameId: filter.gameId })
      .andWhere("JSON_EXTRACT(o.bet_content, '$.slatProductId') IS NOT NULL")
      .andWhere("JSON_EXTRACT(o.bet_content, '$.winPrice') IS NOT NULL")
      .andWhere('gr.draw_time IS NOT NULL');

    if (filter.roundNo) {
      qb.andWhere('o.round_no = :roundNo', { roundNo: filter.roundNo });
    }
    if (filter.slotTime) {
      qb.andWhere("TIME_FORMAT(gr.draw_time, '%H:%i') = :slotTime", {
        slotTime: filter.slotTime,
      });
    }
    if (filter.digitLength != null && !isNaN(filter.digitLength)) {
      qb.andWhere(
        "CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.numbers'))) = :digitLength",
        { digitLength: filter.digitLength },
      );
    }
    if (filter.startDate) {
      qb.andWhere('DATE(o.created_at) >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      qb.andWhere('DATE(o.created_at) <= :endDate', {
        endDate: filter.endDate,
      });
    }

    return qb
      .groupBy('drawDate')
      .addGroupBy('slotTime')
      .addGroupBy('inviteCode')
      .addGroupBy('betType')
      .addGroupBy('number')
      .addGroupBy('winPrice')
      .addGroupBy('slatProductId')
      .addGroupBy('posLen')
      .getRawMany<SlatOrderAggRow>();
  }

  private subtotalLabel(posLen: number, winPrice: number): string {
    if (posLen === 1) return 'Single Lot Total';
    if (posLen === 2) return 'Double Lot Total';
    return `${this.formatGrouped(winPrice)} Lot Total`;
  }

  private formatGrouped(n: number): string {
    return new Intl.NumberFormat('en-US').format(Math.round(n));
  }

  private formatSqlDate(value: string): string {
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  async rebuildRollup(gameId: number): Promise<{ slices: number }> {
    await this.rollupRepo.delete({ gameId });
    await this.insertRollup(gameId, '', []);
    const slices = await this.rollupRepo.count({ where: { gameId } });
    return { slices };
  }

  async rebuildRollupForDate(gameId: number, date: string): Promise<void> {
    await this.rollupRepo.delete({ gameId, drawDate: date });
    await this.insertRollup(gameId, 'AND DATE(o.created_at) = ?', [date]);
  }

  async rebuildRollupForRound(gameId: number, roundNo: string): Promise<void> {
    await this.rollupRepo.delete({ gameId, roundNo });
    await this.insertRollup(gameId, 'AND o.round_no = ?', [roundNo]);
  }

  private async refreshRollupForFilter(filter: ReportFilter): Promise<void> {
    if (filter.roundNo) {
      await this.rebuildRollupForRound(filter.gameId, filter.roundNo);
      return;
    }
    const dates = this.filterDates(filter);
    if (dates.length === 0) {
      await this.rebuildRollup(filter.gameId);
      return;
    }
    for (const date of dates) {
      await this.rebuildRollupForDate(filter.gameId, date);
    }
  }

  private filterDates(filter: ReportFilter): string[] {
    if (!filter.startDate) return [];
    let endDate = filter.startDate;
    if (filter.endDate) endDate = filter.endDate;
    const cursor = new Date(`${filter.startDate}T00:00:00`);
    const last = new Date(`${endDate}T00:00:00`);
    const out: string[] = [];
    if (isNaN(cursor.getTime()) || isNaN(last.getTime())) return out;
    let guard = 0;
    while (cursor <= last && guard < 400) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return out;
  }

  private async insertRollup(
    gameId: number,
    extraWhere: string,
    extraParams: unknown[],
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO lottery_sales_rollup
        (game_id, draw_date, slot_time, round_no, slot, position, pos_len, number, price, win_price, sales_qty, draw_qty, draw_amount)
       SELECT
        o.game_id,
        DATE(o.created_at) AS draw_date,
        COALESCE(TIME_FORMAT(gr.draw_time, '%H:%i'), '') AS slot_time,
        o.round_no AS round_no,
        CAST(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.slot')) AS UNSIGNED) AS slot,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.position')), '') AS position,
        CHAR_LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.numbers')), '')) AS pos_len,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.numbers')), '') AS number,
        o.amount AS price,
        COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(o.bet_content, '$.winPrice')) AS DECIMAL(16,2)), 0) AS win_price,
        SUM(o.quantity) AS sales_qty,
        SUM(CASE WHEN o.status = ${OrderStatus.Won} THEN 1 ELSE 0 END) AS draw_qty,
        SUM(CASE WHEN o.status = ${OrderStatus.Won} THEN o.win_amount ELSE 0 END) AS draw_amount
       FROM orders o
       LEFT JOIN game_rounds gr
         ON gr.game_id = o.game_id AND gr.round_no = o.round_no
       WHERE o.game_id = ?
         AND JSON_EXTRACT(o.bet_content, '$.slot') IS NOT NULL
         AND o.status NOT IN (${OrderStatus.Cancelled}, ${OrderStatus.Refunded})
         ${extraWhere}
       GROUP BY o.game_id, DATE(o.created_at), slot_time, o.round_no, slot, position, number, o.amount, win_price`,
      [gameId, ...extraParams],
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: CronJobName.RollupRefresh })
  async refreshRecentRollups(): Promise<void> {
    await this.recorder.run(CronJobName.RollupRefresh, () =>
      this.refreshRecentRollupsImpl(),
    );
  }

  private async refreshRecentRollupsImpl(): Promise<void> {
    try {
      const games = await this.gameRepo.find({
        where: { isLottery: TinyFlag.Yes, status: 1 },
        select: { id: true },
      });
      if (games.length === 0) return;
      const dates = this.recentDates(2);
      for (const game of games) {
        for (const date of dates) {
          await this.rebuildRollupForDate(game.id, date);
        }
      }
    } catch (error) {
      this.logger.error(
        `Rollup auto-refresh failed: ${(error as Error).message}`,
      );
    }
  }

  private recentDates(days: number): string[] {
    const out: string[] = [];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let i = 0; i < days; i += 1) {
      const d = new Date(now.getTime() - i * 86400000);
      out.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      );
    }
    return out;
  }
}
