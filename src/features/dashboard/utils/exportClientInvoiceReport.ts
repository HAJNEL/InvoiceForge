import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { SelfInvoice } from '../../../types';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import {
  calculateJobRevenue, invoiceToRevenueJob,
  LOCAL_COMMISSION_RATE, LOCAL_DIESEL_SURCHARGE_RATE,
  REGIONAL_COMMISSION_RATE, REGIONAL_DIESEL_SURCHARGE_RATE,
} from '../../reports/weeklyRevenue';
import { ASSEMBLY_CATEGORY_META, AssemblyCategory, getAssemblyCategory } from '../../reports/assemblyRates';
import { isPartialInvoice } from '../constants';

const VAT_RATE = 0.15;
const CURRENCY_FORMAT = '"R"#,##0.00';
const THIN_BORDER = { style: 'thin' as const, color: { argb: 'FF9CA3AF' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
const YELLOW_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF176' } };
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
const SURCHARGE_COLUMN_KEYS = new Set(['onePointFivePct', 'twoPct']);

const CATEGORY_ORDER: Exclude<AssemblyCategory, 'other'>[] = [
  'tables', 'combo', 'gradeR', 'readingTables', 'teacherOfficeDesk', 'stationaryFiling',
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface ReportRow {
  inv: UIInvoice;
  distanceKm: number | null;
  isRegional: boolean;
  vat: number;
  totalDue: number;
  sixPct: number;
  eightPct: number;
  onePointFivePct: number;
  twoPct: number;
  categoryQty: Record<Exclude<AssemblyCategory, 'other'>, number>;
  travelRevenue: number;
  assemblyRevenue: number;
  totalRevenue: number;
}

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'TAX INVOICE #', key: 'taxInvoice', width: 14 },
  { header: 'DELIVERY NOTE #', key: 'deliveryNote', width: 16 },
  { header: 'SCHOOL', key: 'school', width: 42 },
  { header: 'SUBTOTAL', key: 'subtotal', width: 15 },
  { header: 'VAT', key: 'vat', width: 13 },
  { header: 'TOTAL DUE', key: 'totalDue', width: 15 },
  { header: '6%', key: 'sixPct', width: 12 },
  { header: '8%', key: 'eightPct', width: 12 },
  { header: '1.5% SURCHARGE', key: 'onePointFivePct', width: 15 },
  { header: '2% SURCHARGE', key: 'twoPct', width: 14 },
  { header: 'DISTANCE (KM)', key: 'distance', width: 13 },
  { header: 'TABLES', key: 'tables', width: 10 },
  { header: 'COMBO', key: 'combo', width: 10 },
  { header: 'GR. R', key: 'gradeR', width: 10 },
  { header: 'READING TABLES', key: 'readingTables', width: 14 },
  { header: 'TEACHER / OFFICE DESK', key: 'teacherOfficeDesk', width: 18 },
  { header: 'STATIONARY / FILING', key: 'stationaryFiling', width: 16 },
  { header: 'TOTAL', key: 'total', width: 15 },
];
const CURRENCY_COL_INDEXES = [4, 5, 6, 7, 8, 9, 10, 18]; // Subtotal, VAT, Total Due, 6/8/1.5/2%, Total

function buildReportRows(invoices: UIInvoice[]): ReportRow[] {
  return invoices.map(inv => {
    const distanceKm = typeof inv.distanceKm === 'number' ? inv.distanceKm : null;
    const revenue = calculateJobRevenue(invoiceToRevenueJob(inv, distanceKm));
    const subtotal = inv.amount || 0;
    const vat = round2(subtotal * VAT_RATE);
    const totalDue = round2(subtotal + vat);

    const categoryQty = CATEGORY_ORDER.reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {} as Record<Exclude<AssemblyCategory, 'other'>, number>);
    (inv.lineItems || []).forEach(li => {
      const cat = getAssemblyCategory(li.stockCode);
      if (cat !== 'other') categoryQty[cat] += li.qty;
    });

    return {
      inv,
      distanceKm,
      isRegional: revenue.isRegional,
      vat,
      totalDue,
      sixPct: revenue.isRegional ? 0 : round2(subtotal * LOCAL_COMMISSION_RATE),
      eightPct: revenue.isRegional ? round2(subtotal * REGIONAL_COMMISSION_RATE) : 0,
      onePointFivePct: revenue.isRegional ? 0 : round2(subtotal * LOCAL_DIESEL_SURCHARGE_RATE),
      twoPct: revenue.isRegional ? round2(subtotal * REGIONAL_DIESEL_SURCHARGE_RATE) : 0,
      categoryQty,
      travelRevenue: round2(revenue.travelRevenue),
      assemblyRevenue: round2(revenue.assemblyRevenue),
      totalRevenue: round2(revenue.totalRevenue),
    };
  });
}

// Generates and downloads a professional Excel report for one client invoice
// bundle - one row per underlying invoice it contains, plus a category/total
// summary block at the bottom, matching the layout of the client's reference
// billing workbook. Values are static computed numbers (a point-in-time
// snapshot), not live Excel formulas.
export async function exportClientInvoiceReport(selfInvoice: SelfInvoice, invoices: UIInvoice[]): Promise<void> {
  const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));
  const resolvedInvoices = selfInvoice.invoiceIds
    .map(id => invoiceMap.get(id))
    .filter((inv): inv is UIInvoice => inv !== undefined);

  const missingCount = selfInvoice.invoiceIds.length - resolvedInvoices.length;
  if (missingCount > 0) {
    toast.warning('Some invoices missing', {
      description: `${missingCount} invoice(s) in this bundle could no longer be found and were excluded from the export.`
    });
  }

  // Partially-delivered invoices aren't billable yet, so they're left off the
  // client's Excel report until they reach a real completed status.
  const billableInvoices = resolvedInvoices.filter(inv => !isPartialInvoice(inv));
  const partialCount = resolvedInvoices.length - billableInvoices.length;
  if (partialCount > 0) {
    toast.warning('Partial invoices excluded', {
      description: `${partialCount} invoice(s) in this bundle are only partially complete and were excluded from the export.`
    });
  }

  const rows = buildReportRows(billableInvoices);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InvoiceForge';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(selfInvoice.invoiceNumber.slice(0, 31));
  sheet.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));
  const colCount = COLUMNS.length;

  // Row 1: title
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${selfInvoice.invoiceNumber} — Client Invoice`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  // Row 2: header
  const headerRow = sheet.getRow(2);
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = CELL_BORDER;
    cell.fill = SURCHARGE_COLUMN_KEYS.has(col.key) ? YELLOW_FILL : HEADER_FILL;
  });
  headerRow.height = 32;

  sheet.views = [{ state: 'frozen', ySplit: 2 }];

  // Data rows
  let rowIdx = 3;
  rows.forEach(r => {
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = r.inv.number;
    row.getCell(2).value = r.inv.deliveryNoteNo || '';
    row.getCell(3).value = r.inv.schoolName || r.inv.client;
    row.getCell(4).value = r.inv.amount || 0;
    row.getCell(5).value = r.vat;
    row.getCell(6).value = r.totalDue;
    row.getCell(7).value = r.sixPct;
    row.getCell(8).value = r.eightPct;
    row.getCell(9).value = r.onePointFivePct;
    row.getCell(10).value = r.twoPct;
    row.getCell(11).value = r.distanceKm ?? '';
    row.getCell(12).value = r.categoryQty.tables || '';
    row.getCell(13).value = r.categoryQty.combo || '';
    row.getCell(14).value = r.categoryQty.gradeR || '';
    row.getCell(15).value = r.categoryQty.readingTables || '';
    row.getCell(16).value = r.categoryQty.teacherOfficeDesk || '';
    row.getCell(17).value = r.categoryQty.stationaryFiling || '';
    row.getCell(18).value = r.totalRevenue;

    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: c === 3 ? 'left' : 'center', vertical: 'middle' };
    }
    CURRENCY_COL_INDEXES.forEach(c => { row.getCell(c).numFmt = CURRENCY_FORMAT; });
    rowIdx += 1;
  });

  // Bottom summary block
  rowIdx += 1; // blank spacer row

  const sectionHeaderRow = sheet.getRow(rowIdx);
  sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
  sectionHeaderRow.getCell(1).value = 'ASSEMBLY CATEGORY BREAKDOWN';
  sectionHeaderRow.getCell(1).font = { bold: true };
  rowIdx += 1;

  let assemblyRevenueTotal = 0;
  CATEGORY_ORDER.forEach(cat => {
    const meta = ASSEMBLY_CATEGORY_META[cat];
    const qty = rows.reduce((sum, r) => sum + r.categoryQty[cat], 0);
    const amount = round2(qty * meta.rate);
    assemblyRevenueTotal += amount;

    const row = sheet.getRow(rowIdx);
    sheet.mergeCells(rowIdx, 1, rowIdx, 15);
    row.getCell(1).value = meta.summaryLabel;
    row.getCell(16).value = qty;
    row.getCell(16).alignment = { horizontal: 'center' };
    row.getCell(17).value = meta.rate;
    row.getCell(17).numFmt = CURRENCY_FORMAT;
    row.getCell(18).value = amount;
    row.getCell(18).numFmt = CURRENCY_FORMAT;
    rowIdx += 1;
  });
  assemblyRevenueTotal = round2(assemblyRevenueTotal);

  rowIdx += 1; // blank spacer

  const travelRevenueTotal = round2(rows.reduce((sum, r) => sum + r.travelRevenue, 0));
  const travelRow = sheet.getRow(rowIdx);
  sheet.mergeCells(rowIdx, 1, rowIdx, 17);
  travelRow.getCell(1).value = 'TRAVEL REVENUE TOTAL (COMMISSION + DIESEL SURCHARGE)';
  travelRow.getCell(1).font = { bold: true };
  travelRow.getCell(18).value = travelRevenueTotal;
  travelRow.getCell(18).numFmt = CURRENCY_FORMAT;
  rowIdx += 1;

  const assemblyRow = sheet.getRow(rowIdx);
  sheet.mergeCells(rowIdx, 1, rowIdx, 17);
  assemblyRow.getCell(1).value = 'ASSEMBLY REVENUE TOTAL';
  assemblyRow.getCell(1).font = { bold: true };
  assemblyRow.getCell(18).value = assemblyRevenueTotal;
  assemblyRow.getCell(18).numFmt = CURRENCY_FORMAT;
  rowIdx += 1;

  const grandTotal = round2(travelRevenueTotal + assemblyRevenueTotal);
  const grandTotalRow = sheet.getRow(rowIdx);
  sheet.mergeCells(rowIdx, 1, rowIdx, 17);
  grandTotalRow.getCell(1).value = 'GRAND TOTAL (CLIENT INVOICE TOTAL)';
  grandTotalRow.getCell(1).font = { bold: true, size: 12 };
  grandTotalRow.getCell(18).value = grandTotal;
  grandTotalRow.getCell(18).numFmt = CURRENCY_FORMAT;
  grandTotalRow.getCell(18).font = { bold: true, size: 12 };
  for (let c = 1; c <= colCount; c++) {
    grandTotalRow.getCell(c).border = { top: { style: 'double' }, bottom: { style: 'double' } };
  }
  rowIdx += 1;

  // Reconciliation note if the fresh recompute drifts from what was recorded when
  // this client invoice was created/last saved (e.g. an invoice's distance or line
  // items changed afterwards without re-saving the bundle).
  if (Math.abs(grandTotal - selfInvoice.totalAmount) > 0.01) {
    const noteRow = sheet.getRow(rowIdx + 1);
    sheet.mergeCells(rowIdx + 1, 1, rowIdx + 1, colCount);
    noteRow.getCell(1).value = `Note: recalculated from current invoice data (R ${grandTotal.toLocaleString()}); this differs from the R ${selfInvoice.totalAmount.toLocaleString()} recorded when this client invoice was created/last saved.`;
    noteRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selfInvoice.invoiceNumber}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
