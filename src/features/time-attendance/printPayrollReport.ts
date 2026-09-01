import { TimeAttendanceSettings } from '../../types';
import { StaffPayrollRow } from './payroll';
import { PeriodRange, getDatesInRange, getWeekdayShort } from './utils';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ));
}

const currency = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildReportTitle(subject: string, payInterval: TimeAttendanceSettings['payInterval'], period: PeriodRange): string {
  if (payInterval === 'weekly' && period.weekNumber) return `${subject} for the Week ${period.weekNumber}`;
  return `${subject} for ${period.label}`;
}

// Shared page shell (title bar, subtitle row, footer, and all table styling) for every
// printed Time & Attendance report — callers just supply their own <table> markup, so the
// detailed wages report and the attendance register always look like the same document family.
function buildReportHtml(title: string, period: PeriodRange, tableHtml: string, footerRight: string): string {
  const generatedAt = new Date().toLocaleString('en-ZA');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #18181b;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    display: flex;
    flex-direction: column;
  }
  .title-bar {
    background: #2952a3;
    color: #fff;
    text-align: center;
    padding: 16px 0;
    border-radius: 6px;
    margin-bottom: 6px;
  }
  .title-bar h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .subtitle-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 2px 16px 2px;
    border-bottom: 2px solid #18181b;
    margin-bottom: 18px;
  }
  .subtitle-row .period { font-size: 13px; font-weight: 700; color: #3f3f46; }
  .subtitle-row .generated { font-size: 10px; color: #a1a1aa; }
  table {
    width: 100%;
    border-collapse: collapse;
    flex: 1;
  }
  thead th {
    background: #dbe4f3;
    text-align: right;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1f2f4d;
    padding: 10px 10px;
    border: 1px solid #9db0d1;
  }
  thead th.col-name { text-align: left; }
  thead th.col-day { font-size: 9px; padding: 6px 4px; }
  thead th.col-day .weekday { display: block; }
  thead th.col-day .date { display: block; font-weight: 600; opacity: 0.75; }
  tbody td {
    padding: 9px 10px;
    border: 1px solid #d4d4d8;
    text-align: right;
    font-size: 12px;
  }
  tbody td.col-day { padding: 6px 4px; font-size: 10.5px; }
  tbody tr:nth-child(even) { background: #f7f8fa; }
  td.col-idx { color: #71717a; font-weight: 700; }
  td.col-name { text-align: left; font-weight: 700; }
  td.col-total { font-weight: 800; }
  td.col-nett { font-weight: 900; }
  td.col-nett.negative, td.negative { color: #b91c1c; }
  td.empty-cell { color: #d4d4d8; }
  tfoot td {
    padding: 11px 10px;
    border: 1px solid #9db0d1;
    font-weight: 900;
    text-align: right;
    background: #dbe4f3;
    font-size: 12px;
  }
  tfoot td.col-name { text-align: left; }
  tfoot td.col-day { padding: 6px 4px; font-size: 10.5px; }
  .footer {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: #a1a1aa;
  }
</style>
</head>
<body>
  <div class="title-bar"><h1>${escapeHtml(title)}</h1></div>
  <div class="subtitle-row">
    <span class="period">${escapeHtml(period.label)}</span>
    <span class="generated">Generated ${escapeHtml(generatedAt)}</span>
  </div>

  ${tableHtml}

  <div class="footer">
    <span>InvoiceForge Time &amp; Attendance</span>
    <span>${escapeHtml(footerRight)}</span>
  </div>
</body>
</html>`;
}

// Prints via a hidden, off-screen iframe rather than window.open — so "Export" goes
// straight to the browser's print dialog with no visible intermediate tab/window (unlike
// the in-app ReportPreviewDialog, which deliberately shows its report in a visible iframe).
function openAndPrint(html: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '1000px';
  iframe.style.height = '800px';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return false;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };
  // afterprint fires once the print dialog is dismissed (printed or cancelled); the longer
  // fallback timeout only matters if a browser never fires it, so the iframe doesn't linger.
  win.onafterprint = cleanup;
  setTimeout(cleanup, 60000);

  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
  return true;
}

function staffCountLabel(rows: StaffPayrollRow[]): string {
  return `${rows.length} staff member${rows.length === 1 ? '' : 's'}`;
}

// Builds the print-ready A4 (landscape) wages report HTML for one pay period — one row per
// staff member, same numbers as the on-screen payroll table (both are built from
// buildPayrollRows so they can't drift apart). Pure string builder — used both by
// printPayrollReport (export, prints immediately) and the in-app preview dialog (which
// only prints if the user clicks its own Print button).
export function buildPayrollReportHtml(
  rows: StaffPayrollRow[],
  period: PeriodRange,
  payInterval: TimeAttendanceSettings['payInterval']
): string {
  const title = buildReportTitle('Wages', payInterval, period);

  const totals = rows.reduce((acc, r) => ({
    normal: acc.normal + r.split.normal,
    overtime: acc.overtime + r.split.overtime,
    total: acc.total + r.split.total,
    deductions: acc.deductions + r.deductions,
    shortPayment: acc.shortPayment + r.shortPayment,
    nett: acc.nett + r.pay.nett,
  }), { normal: 0, overtime: 0, total: 0, deductions: 0, shortPayment: 0, nett: 0 });

  const bodyRows = rows.map((r, idx) => `
      <tr>
        <td class="col-num col-idx">${escapeHtml(r.staffMember.number || idx + 1)}</td>
        <td class="col-name">${escapeHtml(`${r.staffMember.firstName} ${r.staffMember.lastName}`)}</td>
        <td class="col-num">${r.split.normal}</td>
        <td class="col-num">${r.split.overtime}</td>
        <td class="col-num col-total">${r.split.total}</td>
        <td class="col-num">${r.hourlyRate !== null ? currency(r.hourlyRate) : '—'}</td>
        <td class="col-num">${r.overtimeRate !== null ? currency(r.overtimeRate) : '—'}</td>
        <td class="col-num">${currency(r.deductions)}</td>
        <td class="col-num">${currency(r.shortPayment)}</td>
        <td class="col-num col-nett${r.pay.nett < 0 ? ' negative' : ''}">${currency(r.pay.nett)}</td>
      </tr>`).join('');

  const tableHtml = `
  <table>
    <thead>
      <tr>
        <th class="col-num" style="width:34px">#</th>
        <th class="col-name">Staff Member</th>
        <th>Normal Hrs</th>
        <th>OT Hrs</th>
        <th>Total Hrs</th>
        <th>Rate</th>
        <th>OT Rate</th>
        <th>Deductions</th>
        <th>Short Payment</th>
        <th>Nett Total</th>
      </tr>
    </thead>
    <tbody>${bodyRows || `<tr><td colspan="10" style="text-align:center;color:#a1a1aa;padding:24px;">No staff to report for this period.</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td></td>
        <td class="col-name">Totals</td>
        <td>${Math.round(totals.normal * 100) / 100}</td>
        <td>${Math.round(totals.overtime * 100) / 100}</td>
        <td>${Math.round(totals.total * 100) / 100}</td>
        <td></td>
        <td></td>
        <td>${currency(totals.deductions)}</td>
        <td>${currency(totals.shortPayment)}</td>
        <td class="${totals.nett < 0 ? 'negative' : ''}">${currency(totals.nett)}</td>
      </tr>
    </tfoot>
  </table>`;

  return buildReportHtml(title, period, tableHtml, staffCountLabel(rows));
}

// Opens a print-ready A4 (landscape) wages report and prints it immediately — the "Export"
// flow. Mirrors printTripManifest.ts's window.open + window.print pattern used elsewhere
// in the app. Never shows an in-app preview; see ReportPreviewDialog for that.
export function printPayrollReport(
  rows: StaffPayrollRow[],
  period: PeriodRange,
  payInterval: TimeAttendanceSettings['payInterval']
): boolean {
  return openAndPrint(buildPayrollReportHtml(rows, period, payInterval));
}

// Builds the print-ready A4 (landscape) attendance register HTML for one pay period — one
// row per staff member, one column per working day in the period (per
// attendanceSettings.workingDays), showing that day's logged hours. Same visual family as
// buildPayrollReportHtml, built from the same buildPayrollRows() rows (each row's
// periodLogs is already scoped to staff + period). Pure string builder — see
// buildPayrollReportHtml for why.
export function buildAttendanceRegisterReportHtml(
  rows: StaffPayrollRow[],
  period: PeriodRange,
  payInterval: TimeAttendanceSettings['payInterval'],
  workingDays: number[]
): string {
  const title = buildReportTitle('Attendance Register', payInterval, period);

  const days = getDatesInRange(period.start, period.end).filter(d => workingDays.includes(new Date(`${d}T00:00:00`).getDay()));

  const hoursOn = (row: StaffPayrollRow, date: string) =>
    row.periodLogs.filter(l => l.date === date).reduce((sum, l) => sum + (l.hours || 0), 0);

  const dayHeaderCells = days.map(d => {
    const dt = new Date(`${d}T00:00:00`);
    return `<th class="col-day"><span class="weekday">${getWeekdayShort(d)}</span><span class="date">${dt.getDate()}/${dt.getMonth() + 1}</span></th>`;
  }).join('');

  const bodyRows = rows.map((r, idx) => {
    const dayCells = days.map(d => {
      const hrs = hoursOn(r, d);
      return `<td class="col-num col-day${hrs === 0 ? ' empty-cell' : ''}">${hrs > 0 ? hrs : '—'}</td>`;
    }).join('');
    const rowTotal = Math.round(days.reduce((sum, d) => sum + hoursOn(r, d), 0) * 100) / 100;
    return `
      <tr>
        <td class="col-num col-idx">${escapeHtml(r.staffMember.number || idx + 1)}</td>
        <td class="col-name">${escapeHtml(`${r.staffMember.firstName} ${r.staffMember.lastName}`)}</td>
        ${dayCells}
        <td class="col-num col-total">${rowTotal}</td>
      </tr>`;
  }).join('');

  const dayTotalCells = days.map(d => {
    const total = Math.round(rows.reduce((sum, r) => sum + hoursOn(r, d), 0) * 100) / 100;
    return `<td class="col-day">${total || ''}</td>`;
  }).join('');
  const grandTotal = Math.round(rows.reduce((sum, r) => sum + days.reduce((s, d) => s + hoursOn(r, d), 0), 0) * 100) / 100;

  const colCount = days.length + 3;
  const tableHtml = `
  <table>
    <thead>
      <tr>
        <th class="col-num" style="width:34px">#</th>
        <th class="col-name">Staff Member</th>
        ${dayHeaderCells}
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${bodyRows || `<tr><td colspan="${colCount}" style="text-align:center;color:#a1a1aa;padding:24px;">No staff to report for this period.</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td></td>
        <td class="col-name">Totals</td>
        ${dayTotalCells}
        <td>${grandTotal}</td>
      </tr>
    </tfoot>
  </table>`;

  return buildReportHtml(title, period, tableHtml, staffCountLabel(rows));
}

// Opens a print-ready A4 (landscape) attendance register and prints it immediately — the
// "Export" flow. Never shows an in-app preview; see ReportPreviewDialog for that.
export function printAttendanceRegisterReport(
  rows: StaffPayrollRow[],
  period: PeriodRange,
  payInterval: TimeAttendanceSettings['payInterval'],
  workingDays: number[]
): boolean {
  return openAndPrint(buildAttendanceRegisterReportHtml(rows, period, payInterval, workingDays));
}
