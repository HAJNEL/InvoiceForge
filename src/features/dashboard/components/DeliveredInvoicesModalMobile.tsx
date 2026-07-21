import { useState } from 'react';
import { Loader2, FileCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { STATUS_DISPLAY_MAP } from '../constants';
import { MobileNavStack, useNavStack } from '../../../components/mobile/MobileNavStack';
import { MobileCard } from '../../../components/mobile/MobileCard';
import { MobileLineItemRow } from '../../../components/mobile/MobileLineItemRow';

export function DeliveredInvoicesModalMobile({ invoices, onClose, onUpdateStatus }: {
  invoices: UIInvoice[];
  onClose: () => void;
  onUpdateStatus: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
}) {
  const { stack, push, pop } = useNavStack();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMarkAsInvoiced = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await onUpdateStatus(invoiceId, { status: 'invoiced' });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderDetail = (inv: UIInvoice) => (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3 shadow-inner">
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">School / Client Name</span>
          <p className="text-sm font-bold text-zinc-800">{inv.client}</p>
        </div>
        {inv.clientEmail && (
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Client Email</span>
            <p className="text-xs text-zinc-650 font-mono">{inv.clientEmail}</p>
          </div>
        )}
        {inv.district && (
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery District</span>
            <p className="text-xs text-zinc-650 font-bold">{inv.district}</p>
          </div>
        )}
        {(inv.deliveryAddressLine1 || inv.deliveryAddressLine2) && (
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery Address</span>
            <p className="text-xs text-zinc-650 leading-relaxed">
              {inv.deliveryAddressLine1} {inv.deliveryAddressLine2}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3.5 shadow-inner">
        <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Invoice Subtotal</span>
          <span className="text-sm font-black text-zinc-900">R {inv.amount.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Invoice Issue Date</span>
          <p className="text-xs text-zinc-700">{inv.date}</p>
        </div>
      </div>

      {inv.lineItems && inv.lineItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Product Line Items</h4>
          <div className="space-y-2">
            {inv.lineItems.map((item, idx) => (
              <MobileLineItemRow key={idx} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const openDetail = (inv: UIInvoice) => {
    push({
      title: inv.number,
      subtitle: 'Invoice Information',
      content: renderDetail(inv),
      footer: inv.status.toLowerCase() !== 'invoiced' ? (
        <button
          type="button"
          title="Mark this invoice as invoiced"
          onClick={() => handleMarkAsInvoiced(inv.id)}
          disabled={updatingId === inv.id}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mobile-tap-target"
        >
          {updatingId === inv.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileCheck className="w-3.5 h-3.5" />
          )}
          Mark Invoiced
        </button>
      ) : undefined
    });
  };

  const root = {
    title: 'Delivered Invoices',
    subtitle: `Completed & Partially Complete (${invoices.length})`,
    content: (
      <div className="space-y-3">
        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileCheck className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
            <p className="text-zinc-400 text-[10px] mt-1">When trip deliveries are finalized, invoices appear here.</p>
          </div>
        ) : (
          invoices.map((inv) => {
            const s = inv.status.toLowerCase();
            const isPartial = s === 'partially_complete' || s === 'partially-completed' || s === 'partially complete';
            const label = STATUS_DISPLAY_MAP[s] || STATUS_DISPLAY_MAP[s.replace(/-/g, '_')] || inv.status;
            return (
              <MobileCard key={inv.id} onClick={() => openDetail(inv)}>
                <MobileCard.Primary>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 flex-wrap">
                      {inv.number}
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 font-bold tracking-widest uppercase rounded",
                        isPartial ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {label}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{inv.client}</p>
                  </div>
                  <span className="text-sm font-black text-zinc-800 shrink-0">R {inv.amount.toLocaleString()}</span>
                </MobileCard.Primary>
                <MobileCard.Secondary>
                  <span>{inv.date}</span>
                </MobileCard.Secondary>
                {s !== 'invoiced' && (
                  <MobileCard.Actions>
                    <button
                      type="button"
                      title="Mark this invoice as invoiced"
                      onClick={() => handleMarkAsInvoiced(inv.id)}
                      disabled={updatingId === inv.id}
                      className="ml-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 mobile-tap-target"
                    >
                      {updatingId === inv.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FileCheck className="w-3.5 h-3.5" />
                      )}
                      Invoice
                    </button>
                  </MobileCard.Actions>
                )}
              </MobileCard>
            );
          })
        )}
      </div>
    )
  };

  return (
    <MobileNavStack isOpen onClose={onClose} root={root} stack={stack} onPop={pop} />
  );
}
