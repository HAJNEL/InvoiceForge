import { useState, useMemo } from 'react';
import { RefreshCcw, Plus, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const recurring = [
  { id: '1', name: 'Monthly Platform Fee', client: 'Stripe Inc.', amount: 1200.00, frequency: 'Monthly', nextDate: 'Jun 11, 2026', status: 'active' },
  { id: '2', name: 'Retainer - AWS Services', client: 'Vercel Co.', amount: 450.00, frequency: 'Weekly', nextDate: 'May 17, 2026', status: 'paused' },
];

export function RecurringList() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(recurring.length / itemsPerPage);

  const paginatedRecurring = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return recurring.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, itemsPerPage]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Invoices</h1>
          <p className="text-zinc-500 text-sm mt-1">Set up automated billing for subscription-based clients.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors">
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-100 italic font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              <th className="px-6 py-4 font-normal">Schedule Name</th>
              <th className="px-6 py-4 font-normal">Client</th>
              <th className="px-6 py-4 font-normal">Frequency</th>
              <th className="px-6 py-4 font-normal text-right">Amount</th>
              <th className="px-6 py-4 font-normal">Next Generation</th>
              <th className="px-6 py-4 font-normal text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {paginatedRecurring.map((item) => (
              <tr key={item.id} className="group hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg bg-zinc-100 text-zinc-500",
                      item.status === 'active' ? "text-brand-accent bg-brand-accent/5" : ""
                    )}>
                      <RefreshCcw className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">{item.client}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{item.frequency}</td>
                <td className="px-6 py-4 text-sm font-bold text-right tabular-nums">R {item.amount.toFixed(2)}</td>
                <td className="px-6 py-4 text-xs font-mono italic text-zinc-500">{item.nextDate}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-150 bg-zinc-50/50">
            <span className="text-xs text-zinc-500 font-medium">
              Showing <span className="font-bold text-zinc-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, recurring.length)}</span> of <span className="font-bold text-zinc-800">{recurring.length}</span> schedules
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                        currentPage === pNum 
                          ? "bg-brand-primary border-brand-primary text-white" 
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
