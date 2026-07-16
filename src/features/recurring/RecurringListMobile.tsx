import { RefreshCcw, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';

interface RecurringItem {
  id: string;
  name: string;
  client: string;
  amount: number;
  frequency: string;
  nextDate: string;
  status: string;
}

interface RecurringListMobileProps {
  paginatedRecurring: RecurringItem[];
  totalCount: number;
  currentPage: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
  totalPages: number;
  itemsPerPage: number;
}

export function RecurringListMobile({
  paginatedRecurring,
  totalCount,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage
}: RecurringListMobileProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Recurring Invoices</h1>
        <p className="text-zinc-500 text-xs">Set up automated billing for subscription-based clients.</p>
      </div>

      <button
        type="button"
        title="Create schedule"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors mobile-tap-target"
      >
        <RefreshCcw className="w-4 h-4" />
        Create Schedule
      </button>

      {paginatedRecurring.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <RefreshCcw className="w-10 h-10 text-zinc-200 mb-2" />
          <p className="text-sm font-bold text-zinc-500 italic">No recurring schedules found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedRecurring.map((item) => (
            <MobileCard key={item.id}>
              <MobileCard.Primary>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "p-2 rounded-lg bg-zinc-100 text-zinc-500 shrink-0",
                    item.status === 'active' ? "text-brand-accent bg-brand-accent/5" : ""
                  )}>
                    <RefreshCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{item.client}</p>
                  </div>
                </div>
                <MobileCard.Actions>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Edit', icon: Edit2, onClick: () => {} },
                      { label: 'Delete', icon: Trash2, destructive: true, onClick: () => {} }
                    ]}
                  />
                </MobileCard.Actions>
              </MobileCard.Primary>
              <MobileCard.Secondary className="justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tight bg-zinc-100 px-2 py-0.5 rounded">
                    {item.frequency}
                  </span>
                  <span className="font-mono italic text-[11px]">{item.nextDate}</span>
                </div>
                <span className="font-mono font-black text-sm text-zinc-900 tabular-nums">
                  R {item.amount.toFixed(2)}
                </span>
              </MobileCard.Secondary>
            </MobileCard>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Previous page"
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page <span className="font-bold text-zinc-800">{currentPage}</span> of <span className="font-bold text-zinc-800">{totalPages}</span>
            {' '}({totalCount} schedules, {itemsPerPage}/page)
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            title="Next page"
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
