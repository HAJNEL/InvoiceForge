import { useState } from 'react';
import { Plus, Trash2, Edit2, Loader2, Layers, Inbox, Settings as SettingsIcon } from 'lucide-react';
import { RateGroup } from '../../../types';
import { useRateGroups } from '../hooks/useRateGroups';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_RATE_SETTINGS } from '../rateConstants';
import { RateGroupModalMobile } from './RateGroupModalMobile';
import { RateSettingsModalMobile } from './RateSettingsModalMobile';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';

export function RatesSectionMobile() {
  const { rateGroups, loading, addRateGroup, updateRateGroup, deleteRateGroup } = useRateGroups();
  const { settings, saveSettings } = useSettings();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RateGroup | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const rateSettings = { ...DEFAULT_RATE_SETTINGS, ...settings?.rateSettings };

  const handleDelete = async (group: RateGroup) => {
    if (window.confirm(`Delete rate group "${group.name}"?`)) {
      await deleteRateGroup(group.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-accent shrink-0" />
            Rate Groups
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Tiered pay per job title — staff move up a tier as they're promoted.</p>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Rate Configuration"
          className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 shrink-0 shadow-2xs mobile-tap-target"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }}
        title="Add a new rate group"
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
      >
        <Plus className="w-3.5 h-3.5" />
        New Group
      </button>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-7 h-7 text-brand-accent animate-spin" />
        </div>
      ) : rateGroups.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-200 rounded-2xl">
          <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
          <p className="text-zinc-400 text-xs">No rate groups yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rateGroups.map(group => (
            <MobileCard key={group.id}>
              <MobileCard.Primary>
                <p className="text-sm font-semibold text-zinc-850 min-w-0 truncate">{group.name}</p>
                <MobileCard.Actions>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Edit', icon: Edit2, onClick: () => { setEditingGroup(group); setIsGroupModalOpen(true); } },
                      { label: 'Delete', icon: Trash2, onClick: () => handleDelete(group), destructive: true },
                    ]}
                  />
                </MobileCard.Actions>
              </MobileCard.Primary>
              <MobileCard.Secondary>
                {group.tiers.map(tier => (
                  <span key={tier.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 text-zinc-600 font-semibold">
                    {tier.label || 'Untitled'} · R{tier.ratePerQuarterHour.toFixed(2)}/15min
                  </span>
                ))}
              </MobileCard.Secondary>
            </MobileCard>
          ))}
        </div>
      )}

      {isGroupModalOpen && (
        <RateGroupModalMobile
          group={editingGroup}
          onSave={async (name, tiers) => {
            if (editingGroup) return updateRateGroup(editingGroup.id, { name, tiers });
            const id = await addRateGroup(name, tiers);
            return !!id;
          }}
          onClose={() => { setIsGroupModalOpen(false); setEditingGroup(null); }}
        />
      )}

      {isSettingsOpen && (
        <RateSettingsModalMobile
          settings={rateSettings}
          onSave={(updated) => saveSettings({ rateSettings: updated })}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
