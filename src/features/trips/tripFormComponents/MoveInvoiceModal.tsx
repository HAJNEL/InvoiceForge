import { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, ArrowRightLeft, Loader2, Truck as TruckIcon, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip } from '../../../types';
import { Truck } from '../../trucks/hooks/useTrucks';

interface MoveInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceLabel: string;
  currentTripId?: string;
  trips: Trip[];
  trucks: Truck[];
  defaultDate: string;
  onMoveToExisting: (destTripId: string) => Promise<void>;
  onCreateAndMove: (data: { name: string; date: string; truckId: string }) => Promise<void>;
}

// Lets the user reassign a single invoice off its current trip: either onto
// another existing trip, or onto a brand-new one created on the spot (only
// asks for the fields a trip actually needs - name, date, truck).
export function MoveInvoiceModal({
  isOpen,
  onClose,
  invoiceLabel,
  currentTripId,
  trips,
  trucks,
  defaultDate,
  onMoveToExisting,
  onCreateAndMove
}: MoveInvoiceModalProps) {
  const [search, setSearch] = useState('');
  const [movingTripId, setMovingTripId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(defaultDate);
  const [newTruckId, setNewTruckId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setMovingTripId(null);
    setShowCreate(false);
    setNewName('');
    setNewDate(defaultDate);
    setNewTruckId(trucks[0]?.id || '');
  }, [isOpen, defaultDate, trucks]);

  const otherTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips
      .filter(t => t.id !== currentTripId)
      .filter(t => !q || t.name.toLowerCase().includes(q));
  }, [trips, currentTripId, search]);

  if (!isOpen) return null;

  const handleMove = async (tripId: string) => {
    setMovingTripId(tripId);
    try {
      await onMoveToExisting(tripId);
    } finally {
      setMovingTripId(null);
    }
  };

  const handleCreate = async () => {
    if (!newDate || !newTruckId) return;
    setCreating(true);
    try {
      const truckName = trucks.find(t => t.id === newTruckId)?.name || '';
      await onCreateAndMove({
        name: newName.trim() || `${truckName} - ${newDate}`,
        date: newDate,
        truckId: newTruckId
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
          <div className="min-w-0">
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
              Move Invoice To Trip
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase truncate">{invoiceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-left overflow-y-auto">
          {/* Create new trip */}
          <div className="border border-dashed border-zinc-250 rounded-2xl p-3.5 bg-zinc-50/50 space-y-3">
            <button
              type="button"
              onClick={() => setShowCreate(prev => !prev)}
              className="w-full flex items-center justify-between gap-2 font-black uppercase text-[10px] tracking-wider text-brand-primary"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create A New Trip
              </span>
              <span className="text-zinc-400">{showCreate ? '−' : '+'}</span>
            </button>

            {showCreate && (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Trip name (optional, auto-generated)"
                  className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</label>
                    <input aria-label="New trip date"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full p-2 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 flex items-center gap-1"><TruckIcon className="w-3 h-3" /> Truck</label>
                    <select aria-label="New trip truck"
                      value={newTruckId}
                      onChange={(e) => setNewTruckId(e.target.value)}
                      className="w-full p-2 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900 cursor-pointer"
                    >
                      {trucks.length === 0 && <option value="">No trucks available</option>}
                      {trucks.map(truck => (
                        <option key={truck.id} value={truck.id}>{truck.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={creating || !newDate || !newTruckId}
                  onClick={handleCreate}
                  className="w-full px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl font-black transition-all cursor-pointer text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create & Move
                </button>
              </div>
            )}
          </div>

          {/* Existing trips */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search existing trips..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {otherTrips.length === 0 ? (
                <p className="text-center text-zinc-400 py-6 text-[11px]">No other trips found.</p>
              ) : (
                otherTrips.map(trip => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between gap-2 p-3 border border-zinc-200 rounded-xl hover:border-zinc-300 hover:bg-zinc-50/50 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{trip.name || 'Unnamed Trip'}</p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                        {trip.date} · {trip.truckName || 'Unassigned'} · {trip.invoiceIds?.length || 0} {trip.invoiceIds?.length === 1 ? 'stop' : 'stops'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={movingTripId !== null}
                      onClick={() => handleMove(trip.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider shrink-0 transition-all flex items-center gap-1.5",
                        "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white disabled:opacity-50 cursor-pointer"
                      )}
                    >
                      {movingTripId === trip.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Move Here'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
