import { useEffect, useState } from 'react';
import { CalendarCheck, Loader2, X, Truck, CheckCircle2, ArrowRightLeft, RotateCw } from 'lucide-react';
import { Trip } from '../../types';

interface SyncRecordLite { scheduledDate: string; syncedAt: string }

interface CalendarSyncModalProps {
  open: boolean;
  onClose: () => void;
  unsyncedTrips: Trip[];
  syncedTrips: Trip[];
  syncedMap: Record<string, SyncRecordLite>;
  syncing: boolean;
  onSync: (tripIds: string[]) => Promise<void>;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

export function CalendarSyncModal({ open, onClose, unsyncedTrips, syncedTrips, syncedMap, syncing, onSync }: CalendarSyncModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'pending' | 'synced'>('pending');
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  // Default every unsynced trip to selected each time the picker opens, and
  // land on whichever tab actually has something to show.
  useEffect(() => {
    if (open) {
      const next: Record<string, boolean> = {};
      unsyncedTrips.forEach(t => { next[t.id] = true; });
      setSelected(next);
      setTab(unsyncedTrips.length > 0 ? 'pending' : 'synced');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const selectedIds = unsyncedTrips.filter(t => selected[t.id]).map(t => t.id);
  const allSelected = unsyncedTrips.length > 0 && selectedIds.length === unsyncedTrips.length;

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    if (!allSelected) unsyncedTrips.forEach(t => { next[t.id] = true; });
    setSelected(next);
  };

  const handleSync = async () => {
    if (selectedIds.length === 0) return;
    await onSync(selectedIds);
    onClose();
  };

  const handleResync = async (tripId: string) => {
    setResyncingId(tripId);
    try {
      await onSync([tripId]);
    } finally {
      setResyncingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-200 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-150 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-zinc-900">Google Calendar Sync</h2>
              <p className="text-[11px] text-zinc-500">{unsyncedTrips.length} trip{unsyncedTrips.length === 1 ? '' : 's'} not yet synced</p>
            </div>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-3 py-2 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all ${
              tab === 'pending' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            To Sync {unsyncedTrips.length > 0 && `(${unsyncedTrips.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab('synced')}
            className={`px-3 py-2 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all ${
              tab === 'synced' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            Synced {syncedTrips.length > 0 && `(${syncedTrips.length})`}
          </button>
        </div>

        {tab === 'pending' ? (
          unsyncedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-bold text-zinc-800">You're all caught up</p>
              <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                Every upcoming trip is already on your Google Calendar. New trips will appear here once they're eligible.
              </p>
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-100 shrink-0">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] font-black uppercase tracking-wider text-brand-primary hover:underline"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-[11px] font-bold text-zinc-400">{selectedIds.length} selected</span>
              </div>

              {/* Trip list */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                {unsyncedTrips.map(trip => {
                  const isChecked = Boolean(selected[trip.id]);
                  const isMove = Boolean(syncedMap[trip.id]) && syncedMap[trip.id].scheduledDate !== trip.date;
                  return (
                    <label
                      key={trip.id}
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setSelected(prev => ({ ...prev, [trip.id]: !prev[trip.id] }))}
                        className="w-4 h-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent/30"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900 text-sm truncate">{trip.name}</p>
                          {isMove && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                              <ArrowRightLeft className="w-3 h-3" /> Moved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="font-mono font-bold">{formatDate(trip.date)}</span>
                          {trip.truckName && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <Truck className="w-3 h-3 text-zinc-400" /> {trip.truckName}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-zinc-150 shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={syncing}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 transition-all border border-zinc-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing || selectedIds.length === 0}
                  className="flex-[2] bg-brand-primary text-white py-3 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                  Sync {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                </button>
              </div>
            </>
          )
        ) : (
          syncedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
              <CalendarCheck className="w-12 h-12 text-zinc-200" />
              <p className="text-sm font-bold text-zinc-800">Nothing synced yet</p>
              <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                Trips you sync will show up here, and you'll be able to push them again at any time.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {syncedTrips.map(trip => {
                const rec = syncedMap[trip.id];
                const isResyncingThis = resyncingId === trip.id;
                return (
                  <div key={trip.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-900 text-sm truncate">{trip.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                        <span className="font-mono font-bold">{formatDate(trip.date)}</span>
                        {trip.truckName && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Truck className="w-3 h-3 text-zinc-400" /> {trip.truckName}
                          </span>
                        )}
                        {rec?.syncedAt && (
                          <span className="text-zinc-400">Synced {new Date(rec.syncedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Push this trip to Google Calendar again"
                      onClick={() => handleResync(trip.id)}
                      disabled={syncing}
                      className="shrink-0 flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      {isResyncingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                      Resync
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
