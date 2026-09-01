import { useState } from 'react';
import { X, Settings as SettingsIcon, Loader2, Clock3, CalendarDays, Repeat, Layers, Plus, Edit2, Trash2, Check, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { TimeAttendanceSettings, RateSettings, RateGroup, RateTier } from '../../../types';
import { WEEKDAY_OPTIONS, PAY_INTERVAL_OPTIONS, OVERTIME_UNIT_LABEL } from '../constants';
import { RateGroupModal } from '../../settings/components/RateGroupModal';
import { cn } from '../../../lib/utils';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

type Tab = 'general' | 'workingDays' | 'billing' | 'rates';

const TABS: { key: Tab; label: string; icon: typeof Clock3 }[] = [
  { key: 'general', label: 'General', icon: Clock3 },
  { key: 'workingDays', label: 'Working Days', icon: CalendarDays },
  { key: 'billing', label: 'Billing Cycle', icon: Repeat },
  { key: 'rates', label: 'Rates', icon: Layers },
];

export function TimeAttendanceSettingsModal({
  settings, onSave, rateSettings, onSaveRateSettings,
  rateGroups, rateGroupsLoading, addRateGroup, updateRateGroup, deleteRateGroup,
  onClose,
}: {
  settings: TimeAttendanceSettings;
  onSave: (settings: TimeAttendanceSettings) => Promise<boolean>;
  rateSettings: RateSettings;
  onSaveRateSettings: (settings: RateSettings) => Promise<boolean>;
  rateGroups: RateGroup[];
  rateGroupsLoading: boolean;
  addRateGroup: (name: string, tiers: RateTier[]) => Promise<string | null>;
  updateRateGroup: (id: string, data: Partial<Pick<RateGroup, 'name' | 'tiers'>>) => Promise<boolean>;
  deleteRateGroup: (id: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [form, setForm] = useState<TimeAttendanceSettings>(settings);
  const [rateForm, setRateForm] = useState<RateSettings>(rateSettings);
  const [submitting, setSubmitting] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RateGroup | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const set = <K extends keyof TimeAttendanceSettings>(key: K, value: TimeAttendanceSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };
  const setRate = <K extends keyof RateSettings>(key: K, value: RateSettings[K]) => {
    setRateForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleWorkingDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day].sort(),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const [ok, rateOk] = await Promise.all([onSave(form), onSaveRateSettings(rateForm)]);
      if (ok && rateOk) {
        toast.success('Working time configuration saved');
        onClose();
      } else {
        toast.error('Could not save configuration');
      }
    } catch (err) {
      console.error('Failed to save time attendance settings:', err);
      toast.error('Could not save configuration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteRateGroup(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
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

        <div className="px-6 pt-4 border-b border-zinc-100 flex items-center gap-1 shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              title={tab.label}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px cursor-pointer",
                activeTab === tab.key ? "border-brand-accent text-brand-primary" : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'general' && (
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
            </div>
          )}

          {activeTab === 'workingDays' && (
            <div className="space-y-4">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Which weekdays staff are expected to work. This drives which days show up as missing entries in each staff member's timecard breakdown on the payroll table.
              </p>
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAY_OPTIONS.map(o => {
                  const active = form.workingDays.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      title={`${active ? 'Remove' : 'Add'} ${o.label} as a working day`}
                      onClick={() => toggleWorkingDay(o.value)}
                      className={cn(
                        "px-2 py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        active ? "bg-brand-accent/10 border-brand-accent text-brand-primary" : "bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-50"
                      )}
                    >
                      {o.label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Pay Interval</label>
                <select title="Pay interval" value={form.payInterval} onChange={e => set('payInterval', e.target.value as TimeAttendanceSettings['payInterval'])} className={inputClass}>
                  {PAY_INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Overtime Threshold ({OVERTIME_UNIT_LABEL[form.payInterval]})</label>
                <input title={`Hours threshold per ${form.payInterval} before overtime applies`} type="number" min="0" step="0.5" value={form.overtimeThresholdHours} onChange={e => set('overtimeThresholdHours', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
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
              <p className="text-[11px] text-zinc-400 leading-relaxed col-span-2">
                The pay interval controls both the payroll table's stepper (weekly steps a week at a time, monthly a calendar month) and when the overtime threshold resets.
              </p>
            </div>
          )}

          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Overtime Multiplier</label>
                  <input title="Multiplier applied to a staff member's tier rate for overtime hours" type="number" min="1" step="0.1" value={rateForm.overtimeMultiplier} onChange={e => setRate('overtimeMultiplier', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Holiday Multiplier</label>
                  <input title="Multiplier applied to a staff member's tier rate for public holidays" type="number" min="1" step="0.1" value={rateForm.holidayMultiplier} onChange={e => setRate('holidayMultiplier', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-800">Rate Groups</p>
                    <p className="text-[11px] text-zinc-400">Group staff by job title with a tiered pay scale, in R per 15 minutes.</p>
                  </div>
                  <button
                    type="button"
                    title="Add a new rate group"
                    onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-accent text-white font-semibold text-xs rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Group
                  </button>
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  {rateGroupsLoading ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                    </div>
                  ) : rateGroups.length === 0 ? (
                    <div className="p-8 text-center">
                      <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                      <p className="text-zinc-400 text-xs">No rate groups yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {rateGroups.map(group => (
                        <div key={group.id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-850">{group.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {group.tiers.map(tier => (
                                <span key={tier.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 text-[11px] font-semibold">
                                  {tier.label || 'Untitled'} · R{tier.ratePerQuarterHour.toFixed(2)}/15min
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 shrink-0">
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
                                  onClick={() => handleDeleteGroup(group.id)}
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}
