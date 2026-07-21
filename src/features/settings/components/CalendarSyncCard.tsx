import { useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Settings } from '../../../types';
import { GOOGLE_OAUTH_CLIENT_ID, requestCalendarToken } from '../../../lib/googleCalendar';

// Lets the account owner opt in to Google Calendar sync for their own trips,
// mirroring the per-team-member toggle on TeamProfile.tsx.
export function CalendarSyncCard({
  settings,
  onSave
}: {
  settings: Settings | null;
  onSave: (data: Partial<Settings>) => Promise<boolean>;
}) {
  const [toggling, setToggling] = useState(false);
  const enabled = Boolean(settings?.calendarSyncEnabled);

  const handleToggle = async () => {
    if (toggling) return;
    const next = !enabled;
    setToggling(true);
    try {
      if (next) {
        if (!GOOGLE_OAUTH_CLIENT_ID) {
          toast.error('Not Configured', { description: 'Google Calendar sync is not configured for this app yet.' });
          return;
        }
        // Force the consent prompt so the owner explicitly grants calendar access.
        await requestCalendarToken(true);
      }
      const success = await onSave({ calendarSyncEnabled: next });
      if (!success) throw new Error('Failed to save preference.');
      toast.success(next ? 'Calendar Sync Enabled' : 'Calendar Sync Disabled', {
        description: next
          ? 'You can now sync trips to your Google Calendar from Trip Management.'
          : 'Trips will no longer sync to your Google Calendar.'
      });
    } catch (err) {
      console.error('Calendar toggle failed:', err);
      toast.error('Could Not Enable', {
        description: err instanceof Error ? err.message : 'Google Calendar permission was not granted.'
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-zinc-900">Sync with Google Calendar</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Add your upcoming trips to your Google Calendar, then sync new or rescheduled trips from Trip Management.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        title={enabled ? 'Disable Google Calendar sync' : 'Enable Google Calendar sync'}
        onClick={handleToggle}
        disabled={toggling}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-all disabled:opacity-50 ${
          enabled ? 'bg-brand-primary' : 'bg-zinc-300'
        }`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all flex items-center justify-center ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}>
          {toggling && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />}
        </span>
      </button>
    </div>
  );
}
