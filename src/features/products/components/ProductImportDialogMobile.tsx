import React, { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, Table2, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

type ImportTab = 'products' | 'knockdown' | 'consumables';

interface ParsedProductRow {
  stockCode: string;
  description: string;
  unitPrice: number;
}

interface ParsedKnockdownRow {
  stockCode: string;
  displayName: string;
  description: string;
  parts: { partCode: string; description: string; qty: number }[];
}

type ParsedRow = ParsedProductRow | ParsedKnockdownRow;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tab: ImportTab;
  saveProduct: (data: {
    stockCode: string;
    description: string;
    unitPrice: number;
    category: 'product' | 'consumable';
  }) => Promise<unknown>;
  saveStockItem: (item: {
    stockCode: string;
    description: string;
    qty: number;
    displayName: string;
    type: 'knockdown' | 'consumable';
    parts: { partCode: string; description: string; qty: number }[];
  }) => Promise<unknown>;
}

const CONFIG = {
  products: {
    label: 'Products',
    color: 'brand-accent',
    filename: 'products_template.xlsx',
    sheetName: 'Products',
    headers: ['Stock Code', 'Description', 'Unit Price (ZAR)'],
    colWidths: [18, 36, 18],
    note: 'One row per product. Unit Price in ZAR (numbers only).',
    example: [['WOOD-SHELF-900', 'Pine Shelf Board 900mm', 250]],
  },
  knockdown: {
    label: 'Knockdown',
    color: 'purple',
    filename: 'knockdown_template.xlsx',
    sheetName: 'Knockdown',
    headers: ['Stock Code', 'Display Name', 'Part Description'],
    colWidths: [20, 28, 40],
    note: 'One row per knockdown item. Stock Code, Display Name and Part Description are required.',
    example: [
      ['4-14-039', 'Top 1000x400', 'Top - 1000x400'],
      ['4-58-0197', 'Seat 1000x400', 'Seat - 1000x400'],
      ['4-79-0137', 'Front 1000x400', 'Front - 1000x400'],
    ],
  },
  consumables: {
    label: 'Consumables',
    color: 'amber',
    filename: 'consumables_template.xlsx',
    sheetName: 'Consumables',
    headers: ['Stock Code', 'Description', 'Unit Price (ZAR)'],
    colWidths: [18, 36, 18],
    note: 'One row per consumable. Unit Price in ZAR (numbers only).',
    example: [['TAPE-BROWN-50', 'Brown Packing Tape 50mm', 45]],
  },
} as const;

function downloadTemplate(tab: ImportTab) {
  const cfg = CONFIG[tab];
  const wb = XLSX.utils.book_new();

  const noteRow = [`ℹ️  ${cfg.note}`, ...Array(cfg.headers.length - 1).fill('')];
  const data: unknown[][] = [noteRow, [...cfg.headers], ...cfg.example.map(r => [...r])];

  const ws = XLSX.utils.aoa_to_sheet(data as string[][]);

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cfg.headers.length - 1 } }];
  ws['!cols'] = cfg.colWidths.map(w => ({ wch: w }));

  const noteCell = ws['A1'];
  if (noteCell) {
    noteCell.s = {
      fill: { fgColor: { rgb: 'FFF3CD' } },
      font: { italic: true, sz: 10 },
      alignment: { wrapText: true }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
  XLSX.writeFile(wb, cfg.filename);
  toast.success('Template Downloaded', { description: `${cfg.filename} saved to your Downloads folder.` });
}

function parseSheet(ws: XLSX.WorkSheet, tab: ImportTab): ParsedRow[] {
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as (string | number)[][];

  const firstHeader = CONFIG[tab].headers[0].toLowerCase();
  const headerIdx = rows.findIndex(r =>
    String(r[0] || '').toLowerCase().trim() === firstHeader
  );
  const dataRows = rows.slice(headerIdx + 1).filter(r => String(r[0] || '').trim());

  if (tab === 'knockdown') {
    return dataRows
      .map(row => {
        const stockCode = String(row[0] || '').trim().toUpperCase();
        const displayName = String(row[1] || '').trim();
        const description = String(row[2] || '').trim() || displayName;
        return { stockCode, displayName, description, parts: [] } as ParsedKnockdownRow;
      })
      .filter(r => r.stockCode && r.displayName);
  }

  return dataRows.map(row => ({
    stockCode: String(row[0] || '').trim().toUpperCase(),
    description: String(row[1] || '').trim(),
    unitPrice: parseFloat(String(row[2] || '0').replace(/[^\d.]/g, '')) || 0,
  } as ParsedProductRow)).filter(r => r.stockCode);
}

export function ProductImportDialogMobile({ isOpen, onClose, tab, saveProduct, saveStockItem }: Props) {
  const cfg = CONFIG[tab];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('Empty workbook.');
        const rows = parseSheet(ws, tab);
        if (rows.length === 0) throw new Error('No valid data rows found. Make sure the file matches the template format.');
        setParsedRows(rows);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [tab]);

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
        if (tab === 'knockdown') {
          const row = parsedRows[i] as ParsedKnockdownRow;
          await saveStockItem({
            stockCode: row.stockCode,
            displayName: row.displayName,
            description: row.description,
            qty: 1,
            type: 'knockdown',
            parts: row.parts,
          });
        } else {
          const row = parsedRows[i] as ParsedProductRow;
          await saveProduct({
            stockCode: row.stockCode,
            description: row.description,
            unitPrice: row.unitPrice,
            category: tab === 'consumables' ? 'consumable' : 'product',
          });
        }
        success++;
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setIsImporting(false);
    setDone(true);

    if (errors === 0) {
      toast.success(`${success} ${cfg.label} Imported`, {
        description: `All records were added to your catalog successfully.`,
      });
      setTimeout(() => { reset(); onClose(); }, 1200);
    } else {
      toast.warning(`${success} imported, ${errors} failed`, {
        description: 'Some rows could not be saved. Check for duplicate stock codes.',
      });
    }
  };

  const accentMap: Record<ImportTab, string> = {
    products: 'text-brand-accent border-brand-accent/30 bg-brand-accent/5',
    knockdown: 'text-purple-600 border-purple-300 bg-purple-50',
    consumables: 'text-amber-600 border-amber-300 bg-amber-50',
  };
  const accentBtn: Record<ImportTab, string> = {
    products: 'bg-brand-accent hover:bg-brand-accent/90',
    knockdown: 'bg-purple-600 hover:bg-purple-700',
    consumables: 'bg-amber-500 hover:bg-amber-600',
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={`Import ${cfg.label}`}
      subtitle={`Bulk-add ${cfg.label.toLowerCase()} from Excel/CSV`}
      headerLeft={
        <div className={cn('p-2 rounded-xl border shrink-0', accentMap[tab])}>
          <FileSpreadsheet className="w-4 h-4" />
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            title="Cancel"
            className="px-4 py-2.5 border border-zinc-200 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 mobile-tap-target"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={parsedRows.length === 0 || isImporting || done}
            title={`Import ${parsedRows.length} ${cfg.label.toLowerCase()}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm disabled:opacity-40 mobile-tap-target',
              accentBtn[tab]
            )}
          >
            {isImporting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importing…</>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                Import {parsedRows.length > 0 ? `${parsedRows.length} ` : ''}{cfg.label}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Step 1 — Download template */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/60">
          <div className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
            1
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Download the template</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              {cfg.note}
            </p>
            <button
              type="button"
              onClick={() => downloadTemplate(tab)}
              title={`Download ${cfg.label} template`}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm mobile-tap-target"
            >
              <Download className="w-3.5 h-3.5" />
              {cfg.filename}
            </button>
          </div>
        </div>

        {/* Step 2 — Upload file */}
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
            2
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-zinc-800 uppercase tracking-wide mb-2">Upload your file</p>

            <div
              onClick={() => !isImporting && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-6 text-center transition-all mobile-tap-target',
                isDragging
                  ? 'border-brand-accent bg-brand-accent/5'
                  : fileName
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-zinc-200 bg-zinc-50/50',
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
                title="Choose file to import"
              />

              {fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  <p className="text-xs font-black text-zinc-800 break-all">{fileName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {parsedRows.length} rows found
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    title="Remove file"
                    className="text-[10px] text-zinc-400 underline transition-colors mt-1 mobile-tap-target"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <Upload className="w-7 h-7 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-zinc-600">
                    Tap to <span className="text-brand-accent font-bold underline">browse</span>
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

        {/* Preview — card list (mobile-friendly, replaces desktop table) */}
        {parsedRows.length > 0 && !done && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Table2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Preview — {parsedRows.length} records
              </span>
            </div>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
                {parsedRows.slice(0, 8).map((row, i) => {
                  if (tab === 'knockdown') {
                    const r = row as ParsedKnockdownRow;
                    return (
                      <div key={i} className="p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-zinc-800">{r.stockCode}</span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-700">{r.displayName}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{r.description}</p>
                      </div>
                    );
                  }
                  const r = row as ParsedProductRow;
                  return (
                    <div key={i} className="p-3 bg-white space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold text-zinc-800">{r.stockCode}</span>
                        <span className="font-black text-xs text-zinc-800 whitespace-nowrap">R {r.unitPrice.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-zinc-600 truncate">{r.description}</p>
                    </div>
                  );
                })}
              </div>
              {parsedRows.length > 8 && (
                <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 text-[10px] text-zinc-400 font-bold text-center">
                  +{parsedRows.length - 8} more rows not shown
                </div>
              )}
            </div>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">Import Complete</p>
            <p className="text-xs text-zinc-500">{parsedRows.length} {cfg.label.toLowerCase()} added to your catalog.</p>
          </div>
        )}

        {/* Progress bar during import */}
        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500">
              <span>Importing…</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200">
              <div
                className={cn('h-full rounded-full transition-all duration-200', accentBtn[tab])}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </MobileSheet>
  );
}
