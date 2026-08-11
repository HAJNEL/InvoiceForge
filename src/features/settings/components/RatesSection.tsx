import { useState } from 'react';
import { Plus, Trash2, Edit2, Loader2, Check, X, Layers, Inbox, Settings as SettingsIcon } from 'lucide-react';
import { RateGroup } from '../../../types';
import { useRateGroups } from '../hooks/useRateGroups';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_RATE_SETTINGS } from '../rateConstants';
import { RateGroupModal } from './RateGroupModal';
import { RateSettingsModal } from './RateSettingsModal';

export function RatesSection() {
  const { rateGroups, loading, addRateGroup, updateRateGroup, deleteRateGroup } = useRateGroups();
  const { settings, saveSettings } = useSettings();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RateGroup | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rateSettings = { ...DEFAULT_RATE_SETTINGS, ...settings?.rateSettings };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteRateGroup(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-accent shrink-0" />
            Rate Groups
          </h3>
          <p className="text-sm text-zinc-500 mt-1">Group staff by job title and give each a tiered pay scale — staff move up a tier as they're promoted.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Rate Configuration"
            className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-all shadow-2xs cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }}
            title="Add a new rate group"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          </div>
        ) : rateGroups.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No rate groups yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Group Name</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tiers</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rateGroups.map(group => (
                  <tr key={group.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-zinc-850 align-top">{group.name}</td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {group.tiers.map(tier => (
                          <span key={tier.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-semibold">
                            {tier.label || 'Untitled'} · R{tier.ratePerQuarterHour.toFixed(2)}/15min
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap align-top">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit rate group"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === group.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(group.id)}
                              disabled={busyId === group.id}
                              className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === group.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(group.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete rate group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isGroupModalOpen && (
        <RateGroupModal
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
        <RateSettingsModal
          settings={rateSettings}
          onSave={(updated) => saveSettings({ rateSettings: updated })}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
