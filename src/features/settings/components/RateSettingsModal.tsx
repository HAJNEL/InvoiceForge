import { useState } from 'react';
import { X, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RateSettings } from '../../../types';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

export function RateSettingsModal({ settings, onSave, onClose }: {
  settings: RateSettings;
  onSave: (settings: RateSettings) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RateSettings>(settings);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof RateSettings>(key: K, value: RateSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ok = await onSave(form);
      if (ok) {
        toast.success('Rate configuration saved');
        onClose();
      }
    } catch (err) {
      console.error('Failed to save rate settings:', err);
      toast.error('Could not save configuration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200">
              <SettingsIcon className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Rate Configuration</h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Overtime Multiplier</label>
              <input
                title="Multiplier applied to a staff member's tier rate for overtime hours"
                type="number"
                min="1"
                step="0.1"
                value={form.overtimeMultiplier}
                onChange={e => set('overtimeMultiplier', Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Holiday Multiplier</label>
              <input
                title="Multiplier applied to a staff member's tier rate for public holidays"
                type="number"
                min="1"
                step="0.1"
                value={form.holidayMultiplier}
                onChange={e => set('holidayMultiplier', Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            These multipliers apply on top of a staff member's assigned tier rate — e.g. an overtime multiplier of 1.5 means overtime hours pay 1.5&times; their normal rate per 15 minutes.
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
