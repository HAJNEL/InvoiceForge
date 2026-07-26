import { Trip, TripStop } from '../../../types';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Truck } from '../../trucks/hooks/useTrucks';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ));
}

interface ManifestLineItem {
  stockCode: string;
  description: string;
  qty: number;
  unitPrice: number;
  value: number;
}

function buildGroupedLineItems(selectedInvoices: UIInvoice[]): ManifestLineItem[] {
  const groups: { [key: string]: ManifestLineItem } = {};

  selectedInvoices.forEach(inv => {
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      inv.lineItems.forEach(item => {
        const key = (item.stockCode || '').trim() || item.description || 'UNKNOWN';
        if (!groups[key]) {
          groups[key] = {
            stockCode: item.stockCode || '',
            description: item.description || '',
            qty: 0,
            unitPrice: item.unitPrice || 0,
            value: 0
          };
        }
        groups[key].qty += (item.qty || 0);
        groups[key].value += (item.value || 0);
      });
    }
  });

  return Object.values(groups);
}

/**
 * Opens a print-ready A4 trip manifest (route sequence + consolidated loading manifest)
 * for the given trip. Shared between the trip detail form (TripForm) and the Trip
 * Dashboard list (TripList) so both print an identical document.
 */
export function printTripManifest(trip: Trip, invoices: UIInvoice[], trucks: Truck[]): boolean {
  const printWindow = window.open('', '_blank', 'width=1000,height=1300');
  if (!printWindow) {
    return false;
  }

  const stops: TripStop[] = trip.stops ?? [];
  const selectedInvoices = invoices.filter(inv => (trip.invoiceIds || []).includes(inv.id));
  const groupedLineItems = buildGroupedLineItems(selectedInvoices);
  const selectedTruck = trucks.find(t => t.id === trip.truckId);
  const currentSelectionTotal = selectedInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const tripName = trip.name || 'Untitled Trip';
  const tripDate = trip.date
    ? new Date(trip.date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const truckName = selectedTruck ? selectedTruck.name : 'Unassigned';
  const truckLimit = selectedTruck?.maxValue ? `R ${selectedTruck.maxValue.toLocaleString()}` : '—';
  const statusLabel = String(trip.status).toUpperCase().replace(/-/g, ' ');
  const generatedAt = new Date().toLocaleString('en-ZA');

  const stopRows = stops.map((stop, idx) => {
    const isInvoice = Boolean(stop.invoiceId);
    const label = isInvoice ? `Invoice #${stop.number}` : (stop.type || 'Stop');
    const clientName = isInvoice
      ? (invoices.find(inv => inv.id === stop.invoiceId)?.schoolName || stop.client || 'Unknown')
      : (stop.location || stop.client || stop.type || '');
    const timeWindow = [stop.startTime, stop.endTime].filter(Boolean).join(' – ') || '—';
    const amount = isInvoice ? `R ${(stop.amount || 0).toLocaleString()}` : '—';
    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td>
          <div class="stop-label">${escapeHtml(label)}</div>
          <div class="stop-sub">${escapeHtml(clientName)}</div>
        </td>
        <td>${escapeHtml(stop.address || stop.location || '—')}</td>
        <td>${escapeHtml(timeWindow)}</td>
        <td>${escapeHtml(stop.duration || '—')}</td>
        <td class="col-amount">${escapeHtml(amount)}</td>
      </tr>`;
  }).join('');

  const manifestRows = groupedLineItems.map(item => `
      <tr>
        <td class="mono">${escapeHtml(item.stockCode || 'N/A')}</td>
        <td>${escapeHtml(item.description || '')}</td>
        <td class="col-amount mono">${item.qty}</td>
        <td class="col-amount mono">R ${item.value.toLocaleString()}</td>
      </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Trip Manifest - ${escapeHtml(tripName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #18181b;
    margin: 0;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #18181b;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    margin: 0 0 4px 0;
  }
  .header .subtitle {
    font-size: 11px;
    color: #71717a;
    font-weight: 600;
  }
  .header .doc-label {
    text-align: right;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #a1a1aa;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .meta-box {
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 8px 10px;
  }
  .meta-box .label {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #a1a1aa;
    margin-bottom: 3px;
  }
  .meta-box .value {
    font-size: 12px;
    font-weight: 700;
    color: #18181b;
  }
  h2.section-title {
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-bottom: 2px solid #18181b;
    padding-bottom: 6px;
    margin: 22px 0 8px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
    border-bottom: 1px solid #d4d4d8;
    padding: 5px 6px;
  }
  td {
    padding: 6px;
    border-bottom: 1px solid #f0f0f1;
    vertical-align: top;
    font-size: 10.5px;
  }
  .col-seq { width: 24px; font-weight: 800; color: #71717a; }
  .col-amount { text-align: right; font-weight: 700; }
  .mono { font-family: 'Consolas', monospace; }
  .stop-label { font-weight: 700; }
  .stop-sub { color: #71717a; font-size: 9.5px; margin-top: 1px; }
  .empty-note {
    padding: 14px 0;
    color: #a1a1aa;
    font-style: italic;
    font-size: 10.5px;
  }
  .footer {
    margin-top: 26px;
    padding-top: 8px;
    border-top: 1px solid #e4e4e7;
    font-size: 9px;
    color: #a1a1aa;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(tripName)}</h1>
      <div class="subtitle">Delivery Trip Manifest</div>
    </div>
    <div class="doc-label">Trip Manifest<br/>${escapeHtml(statusLabel)}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="label">Scheduled Date</div>
      <div class="value">${escapeHtml(tripDate)}</div>
    </div>
    <div class="meta-box">
      <div class="label">Assigned Truck</div>
      <div class="value">${escapeHtml(truckName)}</div>
    </div>
    <div class="meta-box">
      <div class="label">Truck Value Limit</div>
      <div class="value">${escapeHtml(truckLimit)}</div>
    </div>
    <div class="meta-box">
      <div class="label">Merchandise Value</div>
      <div class="value">R ${currentSelectionTotal.toLocaleString()}</div>
    </div>
  </div>

  <h2 class="section-title">Route Sequence (${stops.length} ${stops.length === 1 ? 'Stop' : 'Stops'})</h2>
  ${stops.length === 0 ? '<p class="empty-note">No stops planned for this trip.</p>' : `
  <table>
    <thead>
      <tr>
        <th class="col-seq">#</th>
        <th>Stop</th>
        <th>Address</th>
        <th>Time Window</th>
        <th>Duration</th>
        <th class="col-amount">Amount</th>
      </tr>
    </thead>
    <tbody>${stopRows}</tbody>
  </table>`}

  <h2 class="section-title">Consolidated Loading Manifest</h2>
  ${groupedLineItems.length === 0 ? '<p class="empty-note">No line items to load for this trip.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Stock Code</th>
        <th>Description</th>
        <th class="col-amount">Qty</th>
        <th class="col-amount">Value</th>
      </tr>
    </thead>
    <tbody>${manifestRows}</tbody>
  </table>`}

  <div class="footer">
    <span>Generated ${escapeHtml(generatedAt)}</span>
    <span>InvoiceForge Trip Planner</span>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
  return true;
}
