import { useState, useRef, useCallback } from 'react';
import {
  X, Download, Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, Table2, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import type { Order, OrderLineItem, OrderStatus } from '../hooks/useOrders';

interface ParsedOrderRow {
  schoolId: string;
  clientNumber: string;
  schoolName: string;
  area: string;
  schoolType: string;
  orderNumber: string;
  status: OrderStatus;
  lineItems: OrderLineItem[];
}

// Column AL ("POD" delivery-schedule exports) holds free text like "Complete" once a
// delivery has been signed off; anything else (blank, a week label, "Credit", stray
// whitespace/casing) means the order is still outstanding.
const STATUS_COLUMN_INDEX = 37; // column AL, 0-indexed (A=0)

function statusFromRow(row: (string | number)[]): OrderStatus {
  const raw = String(row[STATUS_COLUMN_INDEX] ?? '').trim().toLowerCase();
  return raw === 'complete' ? 'Complete' : 'Active';
}

const TEMPLATE_HEADERS = ['School ID', 'Client Number', 'School', 'Area', 'School Type', 'Order No.', '3-22-03', '3-30-080', '3-22-04'];
const TEMPLATE_EXAMPLE = [85309, 128330299, 'Klaasvoogds Primêre Skool', 'Cape Winelands', 'Primary School', 'OR-012138', 30, 15, 24];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const note = "ℹ️  One row per school/order. Columns A-F are fixed (School ID, Client Number, School, Area, School Type, Order No.). Every column from G onward is a stock code — add as many SKU columns as you need. Leave a cell blank for 'not ordered'.";
  const data: unknown[][] = [
    [note, ...Array(TEMPLATE_HEADERS.length - 1).fill('')],
    TEMPLATE_HEADERS,
    TEMPLATE_EXAMPLE
  ];
  const ws = XLSX.utils.aoa_to_sheet(data as (string | number)[][]);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: TEMPLATE_HEADERS.length - 1 } }];
  ws['!cols'] = [12, 14, 30, 20, 18, 14, 10, 10, 10].map(w => ({ wch: w }));
  const noteCell = ws['A1'];
  if (noteCell) {
    noteCell.s = { fill: { fgColor: { rgb: 'FFF3CD' } }, font: { italic: true, sz: 10 }, alignment: { wrapText: true } };
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, 'orders_template.xlsx');
  toast.success('Template Downloaded', { description: 'orders_template.xlsx saved to your Downloads folder.' });
}

/**
 * Real delivery-schedule exports (e.g. "WC DELIVERY SCHEDULE") don't label columns
 * A-F in the header row — only the SKU columns (G onward) have text. So the header
 * row is located by "first row with any non-empty cell from column G onward",
 * and columns A-F are read positionally rather than by column name, both here and
 * in the labeled template above (which happens to satisfy the same rule).
 */
function parseOrdersSheet(ws: XLSX.WorkSheet): ParsedOrderRow[] {
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as (string | number)[][];

  const headerIdx = rows.findIndex(r => r.slice(6).some(c => String(c ?? '').trim()));
  if (headerIdx === -1) {
    throw new Error("Could not find any SKU columns (column G onward). Make sure the file matches the template layout.");
  }

  const skuCodes = rows[headerIdx].slice(6).map(c => String(c ?? '').trim());
  const dataRows = rows.slice(headerIdx + 1).filter(r => String(r[2] ?? '').trim());

  return dataRows.map(row => {
    const lineItems: OrderLineItem[] = [];
    skuCodes.forEach((code, i) => {
      if (!code) return;
      const raw = row[6 + i];
      const qty = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''));
      if (qty && qty > 0) lineItems.push({ stockCode: code, qty });
    });

    return {
      schoolId: String(row[0] ?? '').trim(),
      clientNumber: String(row[1] ?? '').trim(),
      schoolName: String(row[2] ?? '').trim(),
      area: String(row[3] ?? '').trim(),
      schoolType: String(row[4] ?? '').trim(),
      orderNumber: String(row[5] ?? '').trim(),
      status: statusFromRow(row),
      lineItems
    };
  }).filter(r => r.schoolName);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  addOrder: (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
}

export function OrdersImportDialog({ isOpen, onClose, addOrder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const reset = () => {
    setFileName(null);
    setParsedRows([]);
    setParseError(null);
    setProgress(0);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError('Invalid file type. Please upload an .xlsx, .xls, or .csv file.');
      return;
    }
    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        // Prefer a sheet literally named "Sheet1" (the master order list in the real
        // delivery-schedule export) over per-truck breakdown sheets, which duplicate
        // a subset of the same rows.
        const preferredName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'sheet1');
        const ws = wb.Sheets[preferredName || wb.SheetNames[0]];
        if (!ws) throw new Error('Empty workbook.');
        const rows = parseOrdersSheet(ws);
        if (rows.length === 0) throw new Error('No valid order rows found. Make sure the file matches the template format.');
        setParsedRows(rows);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0 || isImporting) return;
    setIsImporting(true);
    setProgress(0);

    let success = 0;
    let errors = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      try {
        const row = parsedRows[i];
        const id = await addOrder({
          schoolId: row.schoolId,
          clientNumber: row.clientNumber,
          schoolName: row.schoolName,
          area: row.area,
          schoolType: row.schoolType,
          orderNumber: row.orderNumber,
          status: row.status,
          lineItems: row.lineItems
        });
        if (id) success++; else errors++;
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setIsImporting(false);
    setDone(true);

    if (errors === 0) {
      toast.success(`${success} Orders Imported`, {
        description: 'All orders were added successfully.',
      });
      setTimeout(() => { reset(); onClose(); }, 1200);
    } else {
      toast.warning(`${success} imported, ${errors} failed`, {
        description: 'Some rows could not be saved. Please try again.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl border text-brand-accent border-brand-accent/30 bg-brand-accent/5">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Import Orders</h2>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide mt-0.5">
                Upload a delivery schedule (Excel or CSV) to bulk-add orders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            disabled={isImporting}
            className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="flex items-start gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/60">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Download the template</p>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                One row per school/order. School ID, Client Number, School, Area, School Type and Order No. are fixed columns; every column after that is treated as a stock code with the ordered quantity in each cell.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                title="Download orders template"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                orders_template.xlsx
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-800 uppercase tracking-wide mb-2">Upload your file</p>

              <div
                onClick={() => !isImporting && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-brand-accent bg-brand-accent/5 scale-[1.01]'
                    : fileName
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50',
                  isImporting && 'pointer-events-none opacity-60'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isImporting}
                />

                {fileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-xs font-black text-zinc-800">{fileName}</p>
                    <p className="text-[10px] text-zinc-500">{parsedRows.length} orders found</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                      className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors mt-1"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <Upload className="w-8 h-8 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-zinc-600">
                      Drag & drop or <span className="text-brand-accent font-bold underline">browse</span>
                    </p>
                    <p className="text-[10px]">.xlsx · .xls · .csv</p>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {parsedRows.length > 0 && !done && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Preview — {parsedRows.length} orders
                  </span>
                </div>
                <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap">Order No.</th>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider">School</th>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap">Area</th>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap">Status</th>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap text-right">SKUs</th>
                          <th className="px-3 py-2 font-black text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap text-right">Units</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {parsedRows.slice(0, 8).map((row, i) => (
                          <tr key={i} className="hover:bg-zinc-50/40">
                            <td className="px-3 py-2 font-mono text-[10px] font-bold whitespace-nowrap">{row.orderNumber || '—'}</td>
                            <td className="px-3 py-2 text-zinc-700 font-medium max-w-[220px] truncate">{row.schoolName}</td>
                            <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">{row.area || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide',
                                row.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              )}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-zinc-600">{row.lineItems.length}</td>
                            <td className="px-3 py-2 text-right font-black text-zinc-800 whitespace-nowrap">
                              {row.lineItems.reduce((s, l) => s + l.qty, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 8 && (
                    <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 text-[10px] text-zinc-400 font-bold text-center">
                      +{parsedRows.length - 8} more orders not shown
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">Import Complete</p>
              <p className="text-xs text-zinc-500">{parsedRows.length} orders added.</p>
            </motion.div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500">
                <span>Importing…</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200">
                <motion.div
                  className="h-full rounded-full bg-brand-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={parsedRows.length === 0 || isImporting || done}
            title={`Import ${parsedRows.length} orders`}
            className="flex items-center gap-2 px-5 py-2.5 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-brand-accent hover:bg-brand-accent/90"
          >
            {isImporting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importing…</>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                Import {parsedRows.length > 0 ? `${parsedRows.length} ` : ''}Orders
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
