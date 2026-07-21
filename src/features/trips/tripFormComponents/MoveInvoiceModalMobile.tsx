import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, ArrowRightLeft, Loader2, Truck as TruckIcon, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip } from '../../../types';
import { Truck } from '../../trucks/hooks/useTrucks';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

interface MoveInvoiceModalMobileProps {
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

export function MoveInvoiceModalMobile({
  isOpen,
  onClose,
  invoiceLabel,
  currentTripId,
  trips,
  trucks,
  defaultDate,
  onMoveToExisting,
  onCreateAndMove
}: MoveInvoiceModalMobileProps) {
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
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Move Invoice To Trip"
      subtitle={invoiceLabel}
      headerLeft={<ArrowRightLeft className="w-4 h-4 text-brand-primary shrink-0" />}
    >
      <div className="space-y-4 text-xs">
        {/* Create new trip */}
        <div className="border border-dashed border-zinc-250 rounded-2xl p-3.5 bg-zinc-50/50 space-y-3">
          <button
            type="button"
            title={showCreate ? 'Collapse create trip form' : 'Expand create trip form'}
            onClick={() => setShowCreate(prev => !prev)}
            className="w-full flex items-center justify-between gap-2 font-black uppercase text-[10px] tracking-wider text-brand-primary mobile-tap-target"
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
                title="New trip name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Trip name (optional, auto-generated)"
                className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-zinc-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</label>
                  <input title="New trip date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-zinc-500 flex items-center gap-1"><TruckIcon className="w-3 h-3" /> Truck</label>
                  <select title="New trip truck"
                    value={newTruckId}
                    onChange={(e) => setNewTruckId(e.target.value)}
                    className="w-full p-2 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
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
                title="Create & Move"
                disabled={creating || !newDate || !newTruckId}
                onClick={handleCreate}
                className="w-full px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl font-black transition-all text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 mobile-tap-target"
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
              title="Search existing trips"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search existing trips..."
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            />
          </div>

          <div className="space-y-2">
            {otherTrips.length === 0 ? (
              <p className="text-center text-zinc-400 py-6 text-[11px]">No other trips found.</p>
            ) : (
              otherTrips.map(trip => (
                <div
                  key={trip.id}
                  className="flex items-center justify-between gap-2 p-3 border border-zinc-200 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{trip.name || 'Unnamed Trip'}</p>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      {trip.date} · {trip.truckName || 'Unassigned'} · {trip.invoiceIds?.length || 0} {trip.invoiceIds?.length === 1 ? 'stop' : 'stops'}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Move Here"
                    disabled={movingTripId !== null}
                    onClick={() => handleMove(trip.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg font-black uppercase text-[10px] tracking-wider shrink-0 transition-all flex items-center gap-1.5 mobile-tap-target",
                      "bg-brand-primary/10 text-brand-primary disabled:opacity-50"
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
    </MobileSheet>
  );
}
