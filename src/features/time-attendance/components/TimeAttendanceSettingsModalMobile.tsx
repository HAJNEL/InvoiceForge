import { useState, ReactNode } from 'react';
import { Settings as SettingsIcon, Loader2, ChevronDown, ChevronRight, Clock3, CalendarDays, Repeat, Layers, Plus, Edit2, Trash2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { TimeAttendanceSettings, RateSettings, RateGroup, RateTier } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';
import { WEEKDAY_OPTIONS, PAY_INTERVAL_OPTIONS, OVERTIME_UNIT_LABEL } from '../constants';
import { RateGroupModalMobile } from '../../settings/components/RateGroupModalMobile';
import { cn } from '../../../lib/utils';

const inputClass = "w-full min-w-0 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

type Section = 'general' | 'workingDays' | 'billing' | 'rates';

export function TimeAttendanceSettingsModalMobile({
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
  const [openSection, setOpenSection] = useState<Section>('general');
  const [form, setForm] = useState<TimeAttendanceSettings>(settings);
  const [rateForm, setRateForm] = useState<RateSettings>(rateSettings);
  const [submitting, setSubmitting] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RateGroup | null>(null);

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

  const handleDeleteGroup = async (group: RateGroup) => {
    if (window.confirm(`Delete rate group "${group.name}"?`)) {
      await deleteRateGroup(group.id);
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
      <div className="space-y-3">
        <AccordionSection
          title="General"
          icon={Clock3}
          isOpen={openSection === 'general'}
          onOpen={() => setOpenSection('general')}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>Default Check In</label>
              <input title="Default check-in time" type="time" value={form.checkInTime} onChange={e => set('checkInTime', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1 min-w-0">
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
          </div>
        </AccordionSection>

        <AccordionSection
          title="Working Days"
          icon={CalendarDays}
          isOpen={openSection === 'workingDays'}
          onOpen={() => setOpenSection('workingDays')}
        >
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
            Weekdays staff are expected to work — drives missing-entry prompts in each staff member's timecard.
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_OPTIONS.map(o => {
              const active = form.workingDays.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  title={`${active ? 'Remove' : 'Add'} ${o.label} as a working day`}
                  onClick={() => toggleWorkingDay(o.value)}
                  className={cn(
                    "px-1 py-2.5 rounded-lg text-[11px] font-bold border transition-all mobile-tap-target",
                    active ? "bg-brand-accent/10 border-brand-accent text-brand-primary" : "bg-white border-zinc-200 text-zinc-400"
                  )}
                >
                  {o.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Billing Cycle"
          icon={Repeat}
          isOpen={openSection === 'billing'}
          onOpen={() => setOpenSection('billing')}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>Pay Interval</label>
              <select title="Pay interval" value={form.payInterval} onChange={e => set('payInterval', e.target.value as TimeAttendanceSettings['payInterval'])} className={inputClass}>
                {PAY_INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>Overtime ({OVERTIME_UNIT_LABEL[form.payInterval]})</label>
              <input title={`Hours threshold per ${form.payInterval} before overtime applies`} type="number" min="0" step="0.5" value={form.overtimeThresholdHours} onChange={e => set('overtimeThresholdHours', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
            </div>
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>Week Start</label>
              <select title="Week start day" value={form.weekStartDay} onChange={e => set('weekStartDay', Number(e.target.value))} className={inputClass}>
                {WEEKDAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>Week End</label>
              <select title="Week end day" value={form.weekEndDay} onChange={e => set('weekEndDay', Number(e.target.value))} className={inputClass}>
                {WEEKDAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Rates"
          icon={Layers}
          isOpen={openSection === 'rates'}
          onOpen={() => setOpenSection('rates')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 min-w-0">
                <label className={labelClass}>Overtime x</label>
                <input title="Multiplier applied to a staff member's tier rate for overtime hours" type="number" min="1" step="0.1" value={rateForm.overtimeMultiplier} onChange={e => setRate('overtimeMultiplier', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
              </div>
              <div className="space-y-1 min-w-0">
                <label className={labelClass}>Holiday x</label>
                <input title="Multiplier applied to a staff member's tier rate for public holidays" type="number" min="1" step="0.1" value={rateForm.holidayMultiplier} onChange={e => setRate('holidayMultiplier', Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-800">Rate Groups</p>
              <button
                type="button"
                title="Add a new rate group"
                onClick={() => { setEditingGroup(null); setIsGroupModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-accent text-white font-semibold text-[11px] rounded-xl mobile-tap-target"
              >
                <Plus className="w-3.5 h-3.5" />
                New Group
              </button>
            </div>

            {rateGroupsLoading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
              </div>
            ) : rateGroups.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-zinc-200 rounded-xl">
                <Inbox className="w-7 h-7 text-zinc-200 mx-auto mb-1.5" />
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
                            { label: 'Delete', icon: Trash2, onClick: () => handleDeleteGroup(group), destructive: true },
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
          </div>
        </AccordionSection>
      </div>

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
    </MobileSheet>
  );
}

function AccordionSection({ title, icon: Icon, isOpen, onOpen, children }: {
  title: string;
  icon: typeof Clock3;
  isOpen: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        title={isOpen ? `Collapse ${title}` : `Expand ${title}`}
        onClick={onOpen}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-zinc-50/50 mobile-tap-target"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-700">
          <Icon className="w-3.5 h-3.5 text-brand-accent" />
          {title}
        </span>
        {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}
