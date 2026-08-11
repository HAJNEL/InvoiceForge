import { useState } from 'react';
import { Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TimeAttendanceSettings } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { WEEKDAY_OPTIONS, PAY_INTERVAL_OPTIONS, OVERTIME_UNIT_LABEL } from '../constants';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

export function TimeAttendanceSettingsModalMobile({ settings, onSave, onClose }: {
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
    <MobileSheet
      isOpen
      onClose={onClose}
      title="Working Time Configuration"
      footer={
        <button
          type="button"
          title="Save configuration"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SettingsIcon className="w-4 h-4" />}
          Save Configuration
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
              <label className="flex items-center gap-1.5 cursor-pointer select-none mobile-tap-target">
                <input
                  type="checkbox"
                  title="Enable tea break by default on new logs"
                  checked={form.teaBreakEnabledByDefault}
                  onChange={e => set('teaBreakEnabledByDefault', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
                />
                <span className="text-[10px] font-bold text-zinc-500">Default on</span>
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
              <label className="flex items-center gap-1.5 cursor-pointer select-none mobile-tap-target">
                <input
                  type="checkbox"
                  title="Enable lunch break by default on new logs"
                  checked={form.lunchBreakEnabledByDefault}
                  onChange={e => set('lunchBreakEnabledByDefault', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
                />
                <span className="text-[10px] font-bold text-zinc-500">Default on</span>
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
            <label className={labelClass}>Overtime ({OVERTIME_UNIT_LABEL[form.payInterval]})</label>
            <input title={`Hours threshold per ${form.payInterval === 'daily' ? 'day' : form.payInterval === 'monthly' ? 'month' : 'fortnight'} before overtime applies`} type="number" min="0" step="0.5" value={form.overtimeThresholdHours} onChange={e => set('overtimeThresholdHours', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Once a staff member's logged hours pass the {OVERTIME_UNIT_LABEL[form.payInterval]} overtime threshold, the excess is shown as overtime on the Hours Logged graph.
        </p>
      </div>
    </MobileSheet>
  );
}
