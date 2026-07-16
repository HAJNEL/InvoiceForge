import { useState, useEffect } from 'react';
import { X, Loader2, Check, Gauge, Clock, CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Product } from '../../products/hooks/useProducts';
import {
  KpiReading, KpiReadingEntry, TEAM_SIZES,
  dailyOutput, monthlyOutput
} from '../hooks/useKpiReadings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[]; // template products
  editReading?: KpiReading | null;
  onSave: (data: Omit<KpiReading, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, editId?: string) => Promise<boolean>;
}

type RatesState = Record<string, (string)[]>; // productId -> 5 input strings

const emptyRates = () => TEAM_SIZES.map(() => '');

export function TakeReadingDialog({ isOpen, onClose, products, editReading, onSave }: Props) {
  const [date, setDate] = useState('');
  const [shiftHours, setShiftHours] = useState('8');
  const [workingDays, setWorkingDays] = useState('22');
  const [rates, setRates] = useState<RatesState>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editReading) {
      setDate(editReading.date.slice(0, 10));
      setShiftHours(String(editReading.shiftHours));
      setWorkingDays(String(editReading.workingDaysPerMonth));
      const init: RatesState = {};
      products.forEach(p => {
        const entry = editReading.entries[p.id];
        init[p.id] = TEAM_SIZES.map((_, i) => {
          const v = entry?.rates?.[i];
          return typeof v === 'number' ? String(v) : '';
        });
      });
      setRates(init);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setShiftHours('8');
      setWorkingDays('22');
      const init: RatesState = {};
      products.forEach(p => { init[p.id] = emptyRates(); });
      setRates(init);
    }
  }, [isOpen, editReading, products]);

  const setRate = (productId: string, idx: number, value: string) => {
    setRates(prev => ({
      ...prev,
      [productId]: (prev[productId] ?? emptyRates()).map((v, i) => (i === idx ? value : v))
    }));
  };

  const toEntry = (productId: string): KpiReadingEntry => ({
    rates: (rates[productId] ?? emptyRates()).map(v => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    })
  });

  const shiftHoursNum = Math.max(0, parseFloat(shiftHours) || 0);
  const workingDaysNum = Math.max(0, parseFloat(workingDays) || 0);

  const handleSave = async () => {
    setIsSaving(true);
    const entries: Record<string, KpiReadingEntry> = {};
    products.forEach(p => { entries[p.id] = toEntry(p.id); });
    const ok = await onSave({
      date: date || new Date().toISOString().slice(0, 10),
      shiftHours: shiftHoursNum || 8,
      workingDaysPerMonth: workingDaysNum || 22,
      entries
    }, editReading?.id);
    setIsSaving(false);
    if (ok) {
      toast.success(editReading ? 'Reading Updated' : 'Reading Saved', {
        description: `KPI reading for ${date} saved.`
      });
      onClose();
    } else {
      toast.error('Save Failed', { description: 'Could not save the KPI reading.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-5xl border border-zinc-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent shrink-0 mt-0.5">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                  {editReading ? 'Edit KPI Reading' : 'Take KPI Reading'}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Enter units assembled per hour for each team size. Outputs calculate from the best rate.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} title="Close"
              className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Date / shift / working days */}
          <div className="flex flex-wrap items-end gap-4 mt-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 mb-1">
                <CalendarDays className="w-3 h-3" /> Reading Date
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                title="Reading date"
                className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Shift Length (hours)
              </label>
              <input type="number" min="0" step="0.5" value={shiftHours} onChange={(e) => setShiftHours(e.target.value)}
                title="Shift length in hours"
                className="w-28 px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white tabular-nums" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1 mb-1">
                <CalendarDays className="w-3 h-3" /> Working Days / Month
              </label>
              <input type="number" min="0" step="1" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)}
                title="Working days per month"
                className="w-28 px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white tabular-nums" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {products.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-zinc-400">
              No template products. Set up the KPI template first.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[860px]">
              <thead className="sticky top-0 bg-zinc-50 z-10">
                <tr className="border-b border-zinc-200">
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Product</th>
                  {TEAM_SIZES.map(size => (
                    <th key={size} className="px-2 py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                      {size} {size === 1 ? 'Person' : 'People'}<br />
                      <span className="font-bold text-zinc-400 normal-case">(units/hour)</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-wider text-emerald-700 whitespace-nowrap bg-emerald-50">Daily Output<br /><span className="font-bold normal-case">@ best rate</span></th>
                  <th className="px-3 py-3 text-[9px] font-black uppercase tracking-wider text-emerald-700 whitespace-nowrap bg-emerald-50">Monthly Output<br /><span className="font-bold normal-case">@ best rate</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map(p => {
                  const entry = toEntry(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2">
                        <p className="font-mono text-[10px] font-black text-zinc-500">{p.stockCode}</p>
                        <p className="font-semibold text-zinc-800 truncate max-w-[240px]">{p.description}</p>
                      </td>
                      {TEAM_SIZES.map((size, idx) => (
                        <td key={size} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={rates[p.id]?.[idx] ?? ''}
                            onChange={(e) => setRate(p.id, idx, e.target.value)}
                            title={`${p.stockCode} — ${size} ${size === 1 ? 'person' : 'people'} (units/hour)`}
                            placeholder="—"
                            className="w-16 px-1.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-amber-50/60 tabular-nums"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-black text-emerald-700 bg-emerald-50/50 tabular-nums">
                        {dailyOutput(entry, shiftHoursNum)}
                      </td>
                      <td className="px-3 py-2 text-center font-black text-emerald-700 bg-emerald-50/50 tabular-nums">
                        {monthlyOutput(entry, shiftHoursNum, workingDaysNum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-zinc-400 font-medium">
            Leave a team size blank if not applicable. Daily = best rate × shift hours; Monthly = daily × working days.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} title="Cancel"
              className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving || products.length === 0} title="Save reading"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50">
              {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5 stroke-[3]" />}
              {editReading ? 'Update Reading' : 'Save Reading'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
