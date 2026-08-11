import { useState } from 'react';
import { Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RateSettings } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

export function RateSettingsModalMobile({ settings, onSave, onClose }: {
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
    <MobileSheet
      isOpen
      onClose={onClose}
      title="Rate Configuration"
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
    </MobileSheet>
  );
}
