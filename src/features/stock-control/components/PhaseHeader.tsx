import { Workflow, RefreshCw, PackageSearch, Plus } from 'lucide-react';

export function PhaseHeader({
  onSyncFromStock,
  onSyncFromOrders,
  onAddManualBooking,
  syncingOrders
}: {
  onSyncFromStock: () => void;
  onSyncFromOrders: () => void;
  onAddManualBooking: () => void;
  syncingOrders: boolean;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-200 pb-5">
      <div className="space-y-1 text-left">
        <h1 className="text-xl font-black uppercase tracking-wider text-brand-primary flex items-center gap-2">
          <Workflow className="w-6 h-6 text-brand-accent stroke-[2.5]" />
          Product Phases
        </h1>
        <p className="text-xs text-zinc-500 font-mono uppercase">
          Move stock from knockdown &rarr; booked to schools &rarr; assembled &rarr; ready to deliver. Track your build progress in real-time.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          title="Refresh live stock calculations"
          onClick={onSyncFromStock}
          className="px-3.5 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync From Stock
        </button>
        <button
          type="button"
          title="Scan orders for SKUs missing from the product catalog"
          onClick={onSyncFromOrders}
          disabled={syncingOrders}
          className="px-3.5 py-2.5 bg-white hover:bg-zinc-50 disabled:opacity-50 border border-zinc-200 text-zinc-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
        >
          <PackageSearch className="w-3.5 h-3.5" />
          {syncingOrders ? 'Syncing…' : 'Sync From Orders'}
        </button>
        <button
          type="button"
          title="Add a manual booking"
          onClick={onAddManualBooking}
          className="px-4 py-2.5 bg-brand-primary hover:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          Add Manual Booking
        </button>
      </div>
    </div>
  );
}
