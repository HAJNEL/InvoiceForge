import { useNavigate } from 'react-router-dom';
import { Calendar, Plus } from 'lucide-react';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip, TripStatus } from '../../../types';
import { cn, formatCurrency } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

export function DispatchTripsModalMobile({
  dateString,
  truck,
  trips,
  invoices,
  onClose,
  onUpdateStatus,
  onUpdateInvoice
}: {
  dateString: string;
  truck?: Truck;
  trips: Trip[];
  invoices: UIInvoice[];
  onClose: () => void;
  onUpdateStatus: (id: string, tripData: Partial<Trip>) => Promise<boolean>;
  onUpdateInvoice: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
}) {
  const navigate = useNavigate();

  const invoiceAmountById = new Map(invoices.map(i => [i.id, i.amount || 0]));

  const dateFormatted = new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <MobileSheet
      isOpen
      onClose={onClose}
      title={`Trips for ${truck?.name || 'Truck'}`}
      subtitle={dateFormatted}
      fullHeight={false}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Add another trip on this day"
            onClick={() => {
              onClose();
              navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
            }}
            className="flex-1 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-1 shadow-sm mobile-tap-target"
          >
            <Plus className="w-4 h-4 text-zinc-500" />
            Add Trip
          </button>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm mobile-tap-target"
          >
            Close
          </button>
        </div>
      }
    >
      {trips.length === 0 ? (
        <div className="py-12 text-center">
          <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Trips Scheduled</p>
          <p className="text-zinc-400 text-[10px] mt-1 mb-6">There are no trips created for this truck on this day.</p>
          <button
            type="button"
            title="Schedule a trip on this day"
            onClick={() => {
              onClose();
              navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
            }}
            className="px-4 py-2.5 bg-brand-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-1.5 mx-auto shadow-sm mobile-tap-target"
          >
            <Plus className="w-4 h-4" />
            Schedule a Trip
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const statusLower = (trip.status || '').toLowerCase();
            const isCompleted = statusLower === 'completed' || statusLower === 'delivered';
            const isPartial = statusLower === 'partially-completed' || statusLower === 'partially_complete';
            const tripValue = (trip.invoiceIds || []).reduce((sum, id) => sum + (invoiceAmountById.get(id) || 0), 0);
            return (
              <div key={trip.id} className="p-4 border border-zinc-100 bg-zinc-50/20 rounded-xl space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900">{trip.name || 'Unnamed Trip'}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Invoices: <span className="font-bold font-mono">{trip.invoiceIds?.length || 0}</span>
                  </p>
                  <span className={cn(
                    "inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums",
                    isCompleted ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : isPartial ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-zinc-100 text-zinc-500"
                  )}>
                    {isCompleted ? 'Delivered Value' : isPartial ? 'Partial Value' : 'Est. Value'}: R {formatCurrency(tripValue)}
                  </span>
                </div>

                <select
                  title="Trip status"
                  value={trip.status}
                  onChange={async (e) => {
                    const nextStatus = e.target.value as TripStatus;
                    if (nextStatus === TripStatus.PROPOSED) {
                      await onUpdateStatus(trip.id, { status: nextStatus, checkedItems: {}, partialItems: {} });
                      await Promise.all((trip.invoiceIds || []).map(id => onUpdateInvoice(id, { status: 'proposed' })));
                    } else {
                      await onUpdateStatus(trip.id, { status: nextStatus });
                    }
                  }}
                  className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-lg px-2.5 py-2 outline-none text-zinc-700 shadow-sm"
                >
                  <option value="proposed">Proposed</option>
                  <option value="assembled">Assembled</option>
                  <option value="on-route">On Route</option>
                  <option value="partially-completed">Partially Completed</option>
                  <option value="completed">Completed</option>
                  <option value="invoiced">Invoiced</option>
                </select>

                <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100">
                  <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
                    Status: {trip.status}
                  </span>
                  <button
                    type="button"
                    title="Edit trip details"
                    onClick={() => {
                      onClose();
                      navigate(`/trips/edit/${trip.id}`);
                    }}
                    className="px-3 py-1.5 text-[11px] font-bold bg-brand-primary text-white rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-1 mobile-tap-target"
                  >
                    Edit Trip Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MobileSheet>
  );
}
