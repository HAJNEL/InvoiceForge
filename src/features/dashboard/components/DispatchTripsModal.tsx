import { useNavigate } from 'react-router-dom';
import { X, Calendar, Plus } from 'lucide-react';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip, TripStatus } from '../../../types';

export function DispatchTripsModal({
  dateString,
  truck,
  trips,
  onClose,
  onUpdateStatus
}: {
  dateString: string;
  truck?: Truck;
  trips: Trip[];
  onClose: () => void;
  onUpdateStatus: (id: string, tripData: Partial<Trip>) => Promise<boolean>;
}) {
  const navigate = useNavigate();

  // Format readable date
  const dateFormatted = new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white rounded-2xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-bold">Trips for {truck?.name || 'Truck'}</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{dateFormatted}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {trips.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Trips Scheduled</p>
              <p className="text-zinc-400 text-[10px] mt-1 mb-6">There are no trips created for this truck on this day.</p>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
                }}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-1.5 mx-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule a Trip
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <div key={trip.id} className="p-4 border border-zinc-100 bg-zinc-50/20 rounded-xl space-y-3 hover:border-zinc-200 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900">{trip.name || 'Unnamed Trip'}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Invoices: <span className="font-bold font-mono">{trip.invoiceIds?.length || 0}</span>
                      </p>
                    </div>
                    {/* Status Select inside dialog to edit status immediately! */}
                    <div className="flex flex-col items-end gap-1.5">
                      <select
                      title='trip status'
                        value={trip.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as TripStatus;
                          await onUpdateStatus(trip.id, { status: nextStatus });
                        }}
                        className="text-xs font-bold bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none text-zinc-700 shadow-sm"
                      >
                        <option value="proposed">Proposed</option>
                        <option value="assembled">Assembled</option>
                        <option value="on-route">On Route</option>
                        <option value="partially-completed">Partially Completed</option>
                        <option value="completed">Completed</option>
                        <option value="invoiced">Invoiced</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
                      Status: {trip.status}
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/trips/edit/${trip.id}`);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-brand-primary text-white rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-1"
                    >
                      Edit Trip Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              onClose();
              navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
            }}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50 transition-all flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-500" />
            Add Another Trip
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
