import { useState } from 'react';
import { Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RateGroup, RateTier } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { newTier, isTierValid } from './rateGroupUtils';

export function RateGroupModalMobile({ group, onSave, onClose }: {
  group: RateGroup | null;
  onSave: (name: string, tiers: RateTier[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const isNew = group === null;
  const [name, setName] = useState(group?.name || '');
  const [tiers, setTiers] = useState<RateTier[]>(group?.tiers?.length ? group.tiers : [newTier('Tier 1')]);
  const [submitting, setSubmitting] = useState(false);

  const canSave = name.trim().length > 0 && tiers.length > 0 && tiers.every(isTierValid);

  const updateTier = (id: string, patch: Partial<RateTier>) => {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const addTier = () => {
    setTiers(prev => [...prev, newTier(`Tier ${prev.length + 1}`)]);
  };

  const removeTier = (id: string) => {
    setTiers(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ok = await onSave(name.trim(), tiers);
      if (ok) {
        toast.success(isNew ? 'Rate group created' : 'Rate group saved');
        onClose();
      } else {
        toast.error('Failed to save rate group');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileSheet
      isOpen
      onClose={onClose}
      title={isNew ? 'New Rate Group' : 'Edit Rate Group'}
      footer={
        <button
          type="button"
          title={canSave ? 'Save rate group' : 'Name and all tiers must be filled in'}
          onClick={handleSubmit}
          disabled={submitting || !canSave}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          {isNew ? 'Create Rate Group' : 'Save Changes'}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Group Name</label>
          <input
            type="text"
            title="Rate group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Casuals, Drivers, Floor Managers"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>

        <div className="space-y-3">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="border border-zinc-200 rounded-xl p-3 space-y-2 bg-zinc-50/30">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  title={`Tier ${idx + 1} label`}
                  value={tier.label}
                  onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                  placeholder="e.g. Tier 1"
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
                />
                <button
                  type="button"
                  title="Remove tier"
                  onClick={() => removeTier(tier.id)}
                  disabled={tiers.length <= 1}
                  className="p-2 text-zinc-400 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed mobile-tap-target"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Rate / 15 min (R)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  title={`Tier ${idx + 1} rate per 15 minutes`}
                  value={tier.ratePerQuarterHour}
                  onChange={(e) => updateTier(tier.id, { ratePerQuarterHour: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addTier}
            title="Add another tier"
            className="flex items-center gap-1.5 text-xs font-bold text-brand-primary px-1 mobile-tap-target"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Tier
          </button>
          <p className="text-[10px] text-zinc-400 px-1">
            Staff start on a lower tier and move up as they're promoted — each tier pays its own rate per 15 minutes.
          </p>
        </div>
      </div>
    </MobileSheet>
  );
}
