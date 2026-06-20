import React from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { StatusBadge } from './StatusBadge';

export function RecentInvoicesTable({
  invoices,
  paginatedInvoices,
  invoicesPage,
  setInvoicesPage,
  totalInvoicesPages,
  invoicesPerPage,
  deleteInvoice
}: {
  invoices: UIInvoice[];
  paginatedInvoices: UIInvoice[];
  invoicesPage: number;
  setInvoicesPage: React.Dispatch<React.SetStateAction<number>>;
  totalInvoicesPages: number;
  invoicesPerPage: number;
  deleteInvoice: (id: string) => void;
}) {
  return (
    <div className="saas-card p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Recent Invoices</h3>
        <Link to="/invoices" className="text-xs font-bold text-zinc-400 hover:text-brand-accent flex items-center gap-1 transition-colors">
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center border border-dashed border-zinc-100 rounded-xl">
          <FileSearch className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-sm font-medium text-zinc-900">Your invoice list is empty</p>
          <p className="text-xs text-zinc-500 mt-1 mb-6">Start by uploading a PDF invoice for AI extraction.</p>
          <Link
            to="/invoices/import"
            className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
          >
            Get Started
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 italic font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="pb-4 font-normal">Invoice</th>
                <th className="pb-4 font-normal">Client</th>
                <th className="pb-4 font-normal">Date</th>
                <th className="pb-4 font-normal">Amount</th>
                <th className="pb-4 font-normal">Status</th>
                <th className="pb-4 font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paginatedInvoices.map((invoice) => (
                <tr key={invoice.id} className="group hover:bg-zinc-50/50 transition-colors">
                  <td className="py-4">
                    <Link to={`/invoices/${invoice.id}`} className="font-mono text-xs font-medium hover:text-brand-accent">
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{invoice.client}</span>
                      <span className="text-[10px] text-zinc-500">{invoice.clientEmail}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-zinc-600 font-mono italic">{invoice.date}</td>
                  <td className="py-4 text-sm font-bold tabular-nums">R {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => deleteInvoice(invoice.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-lg text-red-500"
                      title="Delete Invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalInvoicesPages > 1 && (
          <div className="flex items-center justify-between px-2 py-4 border-t border-zinc-150 mt-4 bg-zinc-50/50 rounded-xl">
            <span className="text-xs text-zinc-500 font-medium">
              Showing <span className="font-bold text-zinc-800">{((invoicesPage - 1) * invoicesPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(invoicesPage * invoicesPerPage, invoices.length)}</span> of <span className="font-bold text-zinc-800">{invoices.length}</span> invoices
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setInvoicesPage(prev => Math.max(1, prev - 1))}
                disabled={invoicesPage === 1}
                className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalInvoicesPages }).map((_, i) => {
                  const pNum = i + 1;
                  if (totalInvoicesPages > 5 && Math.abs(invoicesPage - pNum) > 1 && pNum !== 1 && pNum !== totalInvoicesPages) {
                    if (Math.abs(invoicesPage - pNum) === 2) {
                      return <span key={pNum} className="text-xs text-zinc-400 font-bold px-0.5">...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setInvoicesPage(pNum)}
                      className={cn(
                        "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                        invoicesPage === pNum
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
                onClick={() => setInvoicesPage(prev => Math.min(totalInvoicesPages, prev + 1))}
                disabled={invoicesPage === totalInvoicesPages}
                className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
