import { useState } from 'react';
import { X, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RateGroup, RateTier } from '../../../types';
import { newTier, isTierValid } from './rateGroupUtils';

export function RateGroupModal({ group, onSave, onClose }: {
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
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-accent/10 rounded-xl border border-zinc-200">
              <Layers className="w-4 h-4 text-brand-accent" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">{isNew ? 'New Rate Group' : 'Edit Rate Group'}</h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Group Name</label>
            <input
              type="text"
              title="Rate group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Casuals, Drivers, Floor Managers"
              autoFocus
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_140px_36px] gap-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tier</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rate / 15 min (R)</span>
              <span />
            </div>
            {tiers.map((tier, idx) => (
              <div key={tier.id} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                <input
                  type="text"
                  title={`Tier ${idx + 1} label`}
                  value={tier.label}
                  onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                  placeholder="e.g. Tier 1"
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  title={`Tier ${idx + 1} rate per 15 minutes`}
                  value={tier.ratePerQuarterHour}
                  onChange={(e) => updateTier(tier.id, { ratePerQuarterHour: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
                <button
                  type="button"
                  title="Remove tier"
                  onClick={() => removeTier(tier.id)}
                  disabled={tiers.length <= 1}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTier}
              title="Add another tier"
              className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:text-brand-primary/80 transition-colors px-1 pt-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Tier
            </button>
            <p className="text-[10px] text-zinc-400 px-1 pt-1">
              Staff start on a lower tier and move up as they're promoted — each tier pays its own rate per 15 minutes.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
          <button type="button" title="Cancel" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            type="button"
            title={canSave ? 'Save rate group' : 'Name and all tiers must be filled in'}
            onClick={handleSubmit}
            disabled={submitting || !canSave}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            {isNew ? 'Create Rate Group' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
