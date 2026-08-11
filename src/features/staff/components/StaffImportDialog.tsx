import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  X, Download, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { StaffMember } from '../../../types';
import { IDENTIFICATION_TYPES, PAYMENT_METHODS, ACCOUNT_TYPES, HOLDER_RELATIONSHIPS, BANKS } from '../constants';

// Column order matches SimplePay's "Bulk Input Export" spec exactly (32 fixed columns),
// so a genuine SimplePay export can be re-imported here as-is, not just our own template.
const TEMPLATE_HEADERS = [
  'Number', 'First Names', 'Last Name', 'Date of Birth', 'Date of Appointment',
  'Identification Type', 'ID Number', 'Passport / Foreign ID No.', 'Passport Country Code', 'Income Tax Number',
  'Job Title', 'Email', 'Cellphone No.',
  'Payment Method', 'Bank', 'Account Number', 'Branch Code', 'Account Type', 'Holder Relationship', 'Holder Name',
  'Unit Number', 'Complex', 'Street Number', 'Street / Farm Name', 'Suburb or District', 'City or Town', 'Code',
  'Same as Residential (mark with X)', 'Line 1', 'Line 2', 'Line 3', 'Code',
];

const EXAMPLE_ROW = [
  '1001', 'Jane', 'Doe', '1990-05-14', '2024-01-15',
  'RSA ID', '9005145800083', '', '', '1234567890',
  'Assembler', 'jane.doe@example.com', '0821234567',
  'EFT', 'ABSA Bank', '123456789', '632005', 'Current (Cheque)', 'Own', 'Jane Doe',
  '', '', '12', 'Main Road', 'Sandton', 'Johannesburg', '2196',
  'X', '', '', '', '',
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data: unknown[][] = [TEMPLATE_HEADERS, EXAMPLE_ROW];
  const ws = XLSX.utils.aoa_to_sheet(data as string[][]);
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Bulk Input');
  XLSX.writeFile(wb, 'staff_members_template.xlsx');
  toast.success('Template Downloaded', { description: 'staff_members_template.xlsx saved to your Downloads folder.' });
}

// Excel auto-converts a typed-in date into a real date cell, handed back as either a JS
// Date (with cellDates: true) or a bare serial-day number — never the "YYYY-MM-DD" string
// the template shows. Normalize all shapes to "YYYY-MM-DD" in local time.
function normalizeDateCell(value: string | number | Date | undefined): string {
  if (!value) return '';
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
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return str;
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function matchOption(raw: unknown, options: { value: string; label: string }[]): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  const byValue = options.find(o => o.value.toLowerCase() === v.toLowerCase());
  if (byValue) return byValue.value;
  const byLabel = options.find(o => o.label.toLowerCase() === v.toLowerCase());
  if (byLabel) return byLabel.value;
  return undefined;
}

function parseBoolMark(raw: unknown): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'x' || v === 'true' || v === '1' || v === 'yes';
}

interface ParsedStaffRow {
  data: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
  warnings: string[];
  isDuplicate: boolean;
  skip: boolean;
}

function buildStaffFromRow(row: (string | number | Date)[]): { data: ParsedStaffRow['data']; warnings: string[] } {
  const cell = (i: number) => row[i];
  const str = (i: number) => String(cell(i) ?? '').trim();
  const warnings: string[] = [];

  const identificationType = (matchOption(cell(5), IDENTIFICATION_TYPES) as StaffMember['identificationType']) || 'none';
  if (str(5) && !matchOption(cell(5), IDENTIFICATION_TYPES)) warnings.push(`Unrecognized identification type "${str(5)}"`);

  const paymentMethod = (matchOption(cell(13), PAYMENT_METHODS) as StaffMember['paymentMethod']) || 'eft_manual';
  if (str(13) && !matchOption(cell(13), PAYMENT_METHODS)) warnings.push(`Unrecognized payment method "${str(13)}"`);

  const bankId = matchOption(cell(14), BANKS);
  if (str(14) && !bankId) warnings.push(`Unrecognized bank "${str(14)}"`);

  const accountType = matchOption(cell(17), ACCOUNT_TYPES);
  const holderRelationship = matchOption(cell(18), HOLDER_RELATIONSHIPS) || '1';

  const sameAsPhysical = parseBoolMark(cell(27));

  const data: ParsedStaffRow['data'] = {
    number: str(0) || undefined,
    firstName: str(1),
    lastName: str(2),
    birthdate: normalizeDateCell(cell(3)) || undefined,
    appointmentDate: normalizeDateCell(cell(4)) || undefined,
    identificationType,
    idNumber: str(6) || undefined,
    otherNumber: str(7) || undefined,
    passportCountryCode: str(8).toUpperCase() || undefined,
    incomeTaxNumber: str(9) || undefined,
    jobTitle: str(10) || undefined,
    email: str(11) || undefined,
    cellNo: str(12) || undefined,
    paymentMethod,
    bankAccount: {
      bankId,
      accountNumber: str(15) || undefined,
      branchCode: str(16) || undefined,
      accountType,
      holderRelationship,
      holderName: str(19) || undefined,
    },
    physicalAddress: {
      unitNumber: str(20) || undefined,
      complex: str(21) || undefined,
      streetNumber: str(22) || undefined,
      streetOrFarmName: str(23) || undefined,
      suburbOrDistrict: str(24) || undefined,
      cityOrTown: str(25) || undefined,
      code: str(26) || undefined,
    },
    postalAddress: {
      sameAsPhysical,
      line1: sameAsPhysical ? undefined : (str(28) || undefined),
      line2: sameAsPhysical ? undefined : (str(29) || undefined),
      line3: sameAsPhysical ? undefined : (str(30) || undefined),
      code: sameAsPhysical ? undefined : (str(31) || undefined),
    },
    status: 'active',
  };

  return { data, warnings };
}

function parseSheet(ws: XLSX.WorkSheet): { data: ParsedStaffRow['data']; warnings: string[] }[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as (string | number | Date)[][];

  // Anchor on the "First Names" column header — present both in our own template's
  // single header row and in a genuine SimplePay export's friendly-label row, so this
  // reliably finds where data starts in either file shape.
  const headerIdx = rows.findIndex(r => String(r[1] ?? '').trim().toLowerCase() === 'first names');
  if (headerIdx === -1) {
    throw new Error("Could not find the header row (expected a \"First Names\" column). Make sure the file matches the template format.");
  }

  const dataRows = rows.slice(headerIdx + 1).filter(r => String(r[1] ?? '').trim() && String(r[2] ?? '').trim());
  return dataRows.map(buildStaffFromRow);
}

export function StaffImportDialog({ staff, addStaff, onClose }: {
  staff: StaffMember[];
  addStaff: (data: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<unknown>;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedStaffRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const isDuplicate = useCallback((data: ParsedStaffRow['data']): boolean => {
    return staff.some(s =>
      s.firstName.toLowerCase() === data.firstName.toLowerCase() &&
      s.lastName.toLowerCase() === data.lastName.toLowerCase()
    );
  }, [staff]);

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
        const bin = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(bin, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames.find(n => /bulk input/i.test(n)) || wb.SheetNames[0]];
        if (!ws) throw new Error('Empty workbook.');
        const parsed = parseSheet(ws);
        if (parsed.length === 0) throw new Error('No valid data rows found. Make sure the file matches the template format.');

        const withMeta: ParsedStaffRow[] = parsed.map(r => {
          const dup = isDuplicate(r.data);
          return { ...r, isDuplicate: dup, skip: dup };
        });
        setRows(withMeta);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [isDuplicate]);

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

  const toggleSkip = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, skip: !r.skip } : r));
  };

  const importableCount = useMemo(() => rows.filter(r => !r.skip).length, [rows]);

  const handleImport = async () => {
    const toImport = rows.filter(r => !r.skip);
    if (toImport.length === 0 || isImporting) return;
    setIsImporting(true);
    setProgress(0);

    let success = 0;
    let errors = 0;

    for (let i = 0; i < toImport.length; i++) {
      try {
        const ok = await addStaff(toImport[i].data);
        if (ok) success++; else errors++;
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setIsImporting(false);
    setDone(true);

    if (errors === 0) {
      toast.success(`${success} Staff Members Imported`, { description: 'All records were added successfully.' });
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
            <div className="p-2 rounded-xl border text-sky-600 border-sky-300 bg-sky-50">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Import Staff Members</h2>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wide mt-0.5">
                Upload a SimplePay Bulk Input export or the template below
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
                Fill in one row per staff member, or upload an export from SimplePay's own Bulk Input tool directly.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                title="Download staff members template"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                staff_members_template.xlsx
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
                  title="Choose a staff members file"
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

          {rows.length > 0 && (
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs font-black text-zinc-800 uppercase tracking-wide">Review rows</p>
                <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                  {rows.map((row, idx) => (
                    <div key={idx} className={cn('px-3 py-2 flex items-center justify-between gap-2 text-[11px]', row.skip && 'opacity-50')}>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-zinc-800">
                          {row.data.firstName} {row.data.lastName}{row.data.jobTitle ? ` · ${row.data.jobTitle}` : ''}
                        </p>
                        {row.isDuplicate && (
                          <p className="text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> Possible duplicate — matches an existing staff member
                          </p>
                        )}
                        {row.warnings.map((w, wi) => (
                          <p key={wi} className="text-zinc-400 mt-0.5">{w}</p>
                        ))}
                      </div>
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
            title="Import staff members"
            onClick={handleImport}
            disabled={importableCount === 0 || isImporting || done}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isImporting ? 'Importing…' : `Import ${importableCount} Staff Member${importableCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
