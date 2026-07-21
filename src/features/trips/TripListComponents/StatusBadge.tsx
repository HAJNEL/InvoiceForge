import { cn } from '../../../lib/utils';
import { TripStatus } from '../../../types';

export function StatusBadge({ status, onClick }: { status: TripStatus; onClick?: () => void }) {
  const styles = {
    [TripStatus.PENDING]: "bg-violet-50 text-violet-600 border-violet-100",
    [TripStatus.PROPOSED]: "bg-blue-50 text-blue-600 border-blue-100",
    [TripStatus.ASSEMBLED]: "bg-indigo-50 text-indigo-600 border-indigo-100",
    [TripStatus.ON_ROUTE]: "bg-amber-50 text-amber-600 border-amber-100",
    [TripStatus.PARTIALLY_COMPLETED]: "bg-sky-50 text-sky-600 border-sky-100",
    [TripStatus.COMPLETED]: "bg-emerald-50 text-emerald-600 border-emerald-100",
    [TripStatus.DELIVERED]: "bg-emerald-50 text-emerald-600 border-emerald-100",
    [TripStatus.INVOICED]: "bg-zinc-100 text-zinc-600 border-zinc-200"
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border whitespace-nowrap transition-all text-left",
        styles[status],
        onClick ? "cursor-pointer hover:shadow-sm hover:scale-105 active:scale-95 hover:bg-opacity-80" : ""
      )}
      title={onClick ? "Click to toggle next status" : undefined}
    >
      {status.replace(/-/g, ' ')}
    </button>
  );
}
