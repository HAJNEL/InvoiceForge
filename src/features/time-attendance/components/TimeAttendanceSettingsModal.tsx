import { useState } from 'react';
import { X, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TimeAttendanceSettings } from '../../../types';
import { WEEKDAY_OPTIONS, PAY_INTERVAL_OPTIONS, OVERTIME_UNIT_LABEL } from '../constants';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

export function TimeAttendanceSettingsModal({ settings, onSave, onClose }: {
  settings: TimeAttendanceSettings;
  onSave: (settings: TimeAttendanceSettings) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TimeAttendanceSettings>(settings);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof TimeAttendanceSettings>(key: K, value: TimeAttendanceSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ok = await onSave(form);
      if (ok) {
        toast.success('Working time configuration saved');
        onClose();
      }
    } catch (err) {
      console.error('Failed to save time attendance settings:', err);
      toast.error('Could not save configuration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200">
              <SettingsIcon className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Working Time Configuration</h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Default Check In</label>
              <input title="Default check-in time" type="time" value={form.checkInTime} onChange={e => set('checkInTime', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Default Check Out</label>
              <input title="Default check-out time" type="time" value={form.checkOutTime} onChange={e => set('checkOutTime', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Tea Time</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    title="Enable tea break by default on new logs"
                    checked={form.teaBreakEnabledByDefault}
                    onChange={e => set('teaBreakEnabledByDefault', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
                  />
                  <span className="text-[10px] font-bold text-zinc-500">Enabled by default</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input title="Tea break start time" type="time" value={form.teaBreakStart} onChange={e => set('teaBreakStart', e.target.value)} className={inputClass} />
                <input title="Tea break end time" type="time" value={form.teaBreakEnd} onChange={e => set('teaBreakEnd', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Lunch Time</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    title="Enable lunch break by default on new logs"
                    checked={form.lunchBreakEnabledByDefault}
                    onChange={e => set('lunchBreakEnabledByDefault', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
                  />
                  <span className="text-[10px] font-bold text-zinc-500">Enabled by default</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input title="Lunch break start time" type="time" value={form.lunchBreakStart} onChange={e => set('lunchBreakStart', e.target.value)} className={inputClass} />
                <input title="Lunch break end time" type="time" value={form.lunchBreakEnd} onChange={e => set('lunchBreakEnd', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Week Start</label>
              <select title="Week start day" value={form.weekStartDay} onChange={e => set('weekStartDay', Number(e.target.value))} className={inputClass}>
                {WEEKDAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Week End</label>
              <select title="Week end day" value={form.weekEndDay} onChange={e => set('weekEndDay', Number(e.target.value))} className={inputClass}>
                {WEEKDAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Pay Interval</label>
              <select title="Pay interval" value={form.payInterval} onChange={e => set('payInterval', e.target.value as TimeAttendanceSettings['payInterval'])} className={inputClass}>
                {PAY_INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Overtime Threshold ({OVERTIME_UNIT_LABEL[form.payInterval]})</label>
              <input title={`Hours threshold per ${form.payInterval === 'daily' ? 'day' : form.payInterval === 'monthly' ? 'month' : 'fortnight'} before overtime applies`} type="number" min="0" step="0.5" value={form.overtimeThresholdHours} onChange={e => set('overtimeThresholdHours', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Once a staff member's logged hours pass the {OVERTIME_UNIT_LABEL[form.payInterval]} overtime threshold, the excess is shown as overtime on the Hours Logged graph.
          </p>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
          <button type="button" title="Cancel" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            type="button"
            title="Save configuration"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SettingsIcon className="w-3.5 h-3.5" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
