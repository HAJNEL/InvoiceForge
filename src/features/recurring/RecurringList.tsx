import { RefreshCcw, Plus, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

const recurring = [
  { id: '1', name: 'Monthly Platform Fee', client: 'Stripe Inc.', amount: 1200.00, frequency: 'Monthly', nextDate: 'Jun 11, 2026', status: 'active' },
  { id: '2', name: 'Retainer - AWS Services', client: 'Vercel Co.', amount: 450.00, frequency: 'Weekly', nextDate: 'May 17, 2026', status: 'paused' },
];

export function RecurringList() {
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
            {recurring.map((item) => (
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
      </div>
    </div>
  );
}
