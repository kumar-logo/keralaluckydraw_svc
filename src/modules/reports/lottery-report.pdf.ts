import { ProfitLossReport, NumberWiseReport } from './lottery-report.service';

interface PdfKitDoc {
  on(event: 'data', cb: (chunk: Buffer) => void): void;
  on(event: 'end', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  end(): void;
}

interface PdfPrinterLike {
  createPdfKitDocument(definition: TDocumentDefinitions): Promise<PdfKitDoc>;
}

type PdfPrinterCtor = new (
  fonts: Record<string, unknown>,
  vfs?: unknown,
  urlResolver?: unknown,
) => PdfPrinterLike;

type TDocumentDefinitions = {
  pageSize?: string;
  pageMargins?: number[];
  defaultStyle?: Record<string, unknown>;
  content: unknown[];
};

const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

let printerInstance: PdfPrinterLike | null = null;

function getPrinter(): PdfPrinterLike {
  if (printerInstance === null) {
    const PdfPrinter = (
      require('pdfmake/js/Printer') as { default: PdfPrinterCtor }
    ).default;
    const vfs = (require('pdfmake/js/virtual-fs') as { default: unknown })
      .default;
    const URLResolver = (
      require('pdfmake/js/URLResolver') as {
        default: new (fs: unknown) => unknown;
      }
    ).default;
    printerInstance = new PdfPrinter(FONTS, vfs, new URLResolver(vfs));
  }
  return printerInstance;
}

const intl = new Intl.NumberFormat('en-IN');
const fmtInt = (n: number) => intl.format(Math.round(n));
const intlUs = new Intl.NumberFormat('en-US');
const fmtGrouped = (n: number) => intlUs.format(Math.round(n));
const fmt2 = (n: number) =>
  n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const HEADER_FILL = '#f2f2f2';
const SUMMARY_FILL = '#e6e6e6';
const ROW_SUMMARY_FILL = '#d9edf7';

async function render(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const doc = await getPrinter().createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function buildProfitLossPdf(report: ProfitLossReport): Promise<Buffer> {
  const body: any[] = [];
  body.push([
    {
      text: 'Details',
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    },
    {
      text: 'Sales Qty',
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    },
    {
      text: 'Draw Qty',
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    },
    {
      text: 'Sale Cost',
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    },
    {
      text: 'Draw Cost',
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    },
    { text: 'P & L', bold: true, fillColor: HEADER_FILL, alignment: 'center' },
  ]);

  for (const row of report.rows) {
    body.push([
      {
        text: `${row.type} - (${row.slot} - (${fmtInt(row.winPrice)})`,
        alignment: 'center',
      },
      { text: String(row.salesQty), alignment: 'center' },
      { text: String(row.drawQty), alignment: 'center' },
      { text: fmt2(row.saleCost), alignment: 'center' },
      { text: fmt2(row.drawCost), alignment: 'center' },
      { text: fmt2(row.profitLoss), alignment: 'center' },
    ]);
  }

  for (const lot of report.lotTotals) {
    body.push([
      {
        text: lot.label,
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      {
        text: String(lot.salesQty),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      {
        text: String(lot.drawQty),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      {
        text: fmt2(lot.sale),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      {
        text: fmt2(lot.draw),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      {
        text: fmt2(lot.pl),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
    ]);
  }

  body.push([
    {
      text: 'Grand Total',
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
    { text: '', fillColor: SUMMARY_FILL, colSpan: 2 },
    {},
    {
      text: fmt2(report.grandSaleCost),
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
    {
      text: fmt2(report.grandDrawCost),
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
    {
      text: fmt2(report.grandPL),
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [24, 24, 24, 24],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      {
        text: report.pageTitle,
        fontSize: 14,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      {
        text: `Date: ${report.generatedAt.split(' ')[0]} | Time: ${report.generatedAt.split(' ').slice(1).join(' ')}`,
        margin: [0, 0, 0, 4],
      },
      {
        text: `Report Generated on: ${report.generatedAt}`,
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body,
        },
        layout: {
          hLineColor: () => '#000',
          vLineColor: () => '#000',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
    ],
  };

  return render(docDefinition);
}

export function buildNumberWisePdf(report: NumberWiseReport): Promise<Buffer> {
  const body: any[] = [];
  const headers = [
    'Date',
    'Slot',
    'Username',
    'Type',
    'Number',
    'Qty',
    'Win Price',
    'Ticket Price',
  ];
  body.push(
    headers.map((text) => ({
      text,
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    })),
  );

  for (const group of report.groups) {
    for (const row of group.rows) {
      body.push([
        { text: row.date, alignment: 'center' },
        { text: row.slotLabel, alignment: 'center' },
        { text: row.username, alignment: 'center' },
        { text: row.ticketType, alignment: 'center' },
        { text: row.number, alignment: 'center' },
        { text: String(row.qty), alignment: 'center' },
        { text: fmtGrouped(row.winPrice), alignment: 'center' },
        { text: fmt2(row.ticketPrice), alignment: 'center' },
      ]);
    }
    body.push([
      {
        text: group.subtotalLabel,
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
        colSpan: 5,
      },
      {},
      {},
      {},
      {},
      {
        text: String(group.totalQty),
        bold: true,
        fillColor: ROW_SUMMARY_FILL,
        alignment: 'center',
      },
      { text: '', fillColor: ROW_SUMMARY_FILL },
      { text: '', fillColor: ROW_SUMMARY_FILL },
    ]);
  }

  if (report.showGrandTotal) {
    body.push([
      {
        text: 'Grand Total',
        bold: true,
        fillColor: SUMMARY_FILL,
        alignment: 'center',
        colSpan: 5,
      },
      {},
      {},
      {},
      {},
      {
        text: String(report.grandTotalQty),
        bold: true,
        fillColor: SUMMARY_FILL,
        alignment: 'center',
      },
      { text: '', fillColor: SUMMARY_FILL },
      { text: '', fillColor: SUMMARY_FILL },
    ]);
  }

  const summaryBody: any[] = [];
  summaryBody.push(
    ['Details', 'Total Qty', 'Total Price'].map((text) => ({
      text,
      bold: true,
      fillColor: HEADER_FILL,
      alignment: 'center',
    })),
  );
  for (const s of report.summaryRows) {
    summaryBody.push([
      {
        text: `${s.slotLabel} (Price: ${fmt2(s.unitPrice)} - Win: ${fmtGrouped(s.winPrice)})`,
        alignment: 'center',
      },
      { text: String(s.totalQty), alignment: 'center' },
      { text: fmt2(s.totalPrice), alignment: 'center' },
    ]);
  }
  summaryBody.push([
    {
      text: 'Grand Total',
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
    {
      text: String(report.grandSummaryQty),
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
    {
      text: fmt2(report.grandSummaryPrice),
      bold: true,
      fillColor: SUMMARY_FILL,
      alignment: 'center',
    },
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [24, 24, 24, 24],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      {
        text: report.pageTitle,
        fontSize: 14,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 2],
      },
      {
        text: `Lot: ${report.gameName}`,
        alignment: 'center',
        margin: [0, 0, 0, 2],
      },
      {
        text: `Report Generated on: ${report.generatedAt}`,
        alignment: 'center',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: [
            'auto',
            'auto',
            '*',
            'auto',
            'auto',
            'auto',
            'auto',
            'auto',
          ],
          body,
        },
        layout: {
          hLineColor: () => '#000',
          vLineColor: () => '#000',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
      { text: '', margin: [0, 10, 0, 0] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: summaryBody,
        },
        layout: {
          hLineColor: () => '#000',
          vLineColor: () => '#000',
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
    ],
  };

  return render(docDefinition);
}
