import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  X, Download, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { useFuelLogs } from '../hooks/useFuelLogs';
import { Truck } from '../../trucks/hooks/useTrucks';

interface ParsedFuelRow {
  registration: string;
  refuelDate: string;
  liters: number;
  fuelPrice: number;
  odometerReading: number;
  truckId: string | null;
  isDuplicate: boolean;
  skip: boolean;
}

const TEMPLATE_HEADERS = ['Truck Registration', 'Refuel Date (YYYY-MM-DD)', 'Liters', 'Fuel Price (per L)', 'Odometer Reading'];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const noteRow = ['ℹ️  One row per refuel. Registration must match a truck\'s license plate in InvoiceForge.', '', '', '', ''];
  const data: unknown[][] = [
    noteRow,
    TEMPLATE_HEADERS,
    ['ABC123GP', '2026-07-01', 65.5, 24.5, 145200],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data as string[][]);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: TEMPLATE_HEADERS.length - 1 } }];
  ws['!cols'] = [18, 22, 12, 16, 18].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Fuel Statement');
  XLSX.writeFile(wb, 'fuel_statement_template.xlsx');
  toast.success('Template Downloaded', { description: 'fuel_statement_template.xlsx saved to your Downloads folder.' });
}

// Excel auto-converts a typed-in date (e.g. "2026-07-01") into a real date cell,
// which XLSX then hands back as either a JS Date (with cellDates: true, below) or
// a bare serial-day number — never as the "YYYY-MM-DD" string the template shows.
// Normalize all three shapes to "YYYY-MM-DD" in local time so the fuel KPI's
// month/week/year filters (which do `new Date(refuelDate + 'T00:00:00')`) work.
function normalizeDateCell(value: string | number | Date | undefined): string {
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === 'number' && !isNaN(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const yyyy = parsed.y;
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const str = String(value ?? '').trim();
  // Already "YYYY-MM-DD" (or close enough for `new Date()` to parse) — leave as-is.
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return str;
  // Common "DD/MM/YYYY" or "DD-MM-YYYY" statement format.
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function parseSheet(ws: XLSX.WorkSheet): Omit<ParsedFuelRow, 'truckId' | 'isDuplicate' | 'skip'>[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as (string | number | Date)[][];

  const firstHeader = TEMPLATE_HEADERS[0].toLowerCase();
  const headerIdx = rows.findIndex(r => String(r[0] || '').toLowerCase().trim() === firstHeader);
  const dataRows = rows.slice(headerIdx + 1).filter(r => String(r[0] || '').trim());

  return dataRows.map(row => ({
    registration: String(row[0] || '').trim(),
    refuelDate: normalizeDateCell(row[1]),
    liters: parseFloat(String(row[2] || '0').replace(/[^\d.]/g, '')) || 0,
    fuelPrice: parseFloat(String(row[3] || '0').replace(/[^\d.]/g, '')) || 0,
    odometerReading: parseFloat(String(row[4] || '0').replace(/[^\d.]/g, '')) || 0,
  })).filter(r => r.registration && r.refuelDate);
}

export function FuelLogImportDialog({ trucks, onClose }: { trucks: Truck[]; onClose: () => void }) {
  const { fuelLogs, addFuelLog } = useFuelLogs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedFuelRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const matchTruck = useCallback((registration: string): string | null => {
    const norm = registration.toLowerCase().replace(/\s+/g, '');
    const match = trucks.find(t => t.licensePlate.toLowerCase().replace(/\s+/g, '') === norm);
    return match?.id || null;
  }, [trucks]);

  const isDuplicate = useCallback((truckId: string | null, refuelDate: string, odometerReading: number): boolean => {
    if (!truckId) return false;
    return fuelLogs.some(log =>
      log.truckId === truckId &&
      log.refuelDate === refuelDate &&
      log.odometerReading === odometerReading
    );
  }, [fuelLogs]);

  const reset = () => {
    setFileName(null);
    setRows([]);
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
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('Empty workbook.');
        const parsed = parseSheet(ws);
        if (parsed.length === 0) throw new Error('No valid data rows found. Make sure the file matches the template format.');

        const withMatches: ParsedFuelRow[] = parsed.map(r => {
          const truckId = matchTruck(r.registration);
          const dup = isDuplicate(truckId, r.refuelDate, r.odometerReading);
          return { ...r, truckId, isDuplicate: dup, skip: dup };
        });
        setRows(withMatches);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [matchTruck, isDuplicate]);

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

  const setRowTruck = (idx: number, truckId: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const dup = isDuplicate(truckId, r.refuelDate, r.odometerReading);
      return { ...r, truckId, isDuplicate: dup, skip: dup };
    }));
  };

  const toggleSkip = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, skip: !r.skip } : r));
  };

  const importableCount = useMemo(() => rows.filter(r => !r.skip && r.truckId).length, [rows]);
  const unmatchedCount = useMemo(() => rows.filter(r => !r.truckId).length, [rows]);

  const handleImport = async () => {
    const toImport = rows.filter(r => !r.skip && r.truckId);
    if (toImport.length === 0 || isImporting) return;
    setIsImporting(true);
    setProgress(0);

    let success = 0;
    let errors = 0;

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        const ok = await addFuelLog({
          truckId: row.truckId as string,
          liters: row.liters,
          cost: row.liters * row.fuelPrice,
          fuelPrice: row.fuelPrice,
          odometerReading: row.odometerReading,
          refuelDate: row.refuelDate,
        });
        if (ok) success++; else errors++;
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setIsImporting(false);
    setDone(true);

    if (errors === 0) {
      toast.success(`${success} Fuel Logs Imported`, { description: 'All records were added successfully.' });
      setTimeout(() => { reset(); onClose(); }, 1200);
    } else {
      toast.warning(`${success} imported, ${errors} failed`, { description: 'Some rows could not be saved.' });
    }
  };

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
            <div className="p-2 rounded-xl border text-orange-600 border-orange-300 bg-orange-50">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Import Fuel Statement</h2>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide mt-0.5">
                Upload a monthly fuel statement to bulk-add fuel logs
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
          {/* Step 1 — Download template */}
          <div className="flex items-start gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/60">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Download the template</p>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                Match your fuel provider's statement to this column format, or fill it in directly. Registration must match a truck's license plate.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                title="Download fuel statement template"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                fuel_statement_template.xlsx
              </button>
            </div>
          </div>

          {/* Step 2 — Upload file */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-800 uppercase tracking-wide mb-2">Upload your statement</p>
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
                  title="Choose a fuel statement file"
                />
                {fileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-xs font-black text-zinc-800">{fileName}</p>
                    <p className="text-[10px] text-zinc-500">{rows.length} rows found</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                      title="Remove selected file"
                      className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors mt-1"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Drop your .xlsx, .xls, or .csv file here, or click to browse.</p>
                )}
              </div>

              {parseError && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — Preview & resolve */}
          {rows.length > 0 && (
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Review rows</p>
                {unmatchedCount > 0 && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {unmatchedCount} row(s) couldn't be matched to a truck by registration — pick one manually below or they'll be skipped.
                  </div>
                )}
                <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                  {rows.map((row, idx) => (
                    <div key={idx} className={cn('px-3 py-2 flex items-center justify-between gap-2 text-[11px]', row.skip && 'opacity-50')}>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-zinc-800">
                          {row.registration} · {row.refuelDate} · {row.liters} L · {row.odometerReading.toLocaleString()} km
                        </p>
                        {row.isDuplicate && (
                          <p className="text-amber-600 font-bold mt-0.5">Possible duplicate — matches an existing log</p>
                        )}
                      </div>
                      <select
                        title="Assign truck for this row"
                        value={row.truckId || ''}
                        onChange={(e) => setRowTruck(idx, e.target.value)}
                        className="px-2 py-1 border border-zinc-200 rounded-lg text-[10px] font-medium max-w-[140px]"
                      >
                        <option value="" disabled>Select truck</option>
                        {trucks.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.licensePlate})</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          title="Skip this row"
                          checked={row.skip}
                          onChange={() => toggleSkip(idx)}
                        />
                        Skip
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-zinc-400 text-center">{progress}%</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-2 shrink-0 bg-zinc-50/50">
          <button
            type="button"
            title="Cancel import"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Import fuel logs"
            onClick={handleImport}
            disabled={importableCount === 0 || isImporting || done}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isImporting ? 'Importing…' : `Import ${importableCount} Log${importableCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
