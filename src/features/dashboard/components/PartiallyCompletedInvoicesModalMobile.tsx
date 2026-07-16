import { Package } from 'lucide-react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { MobileNavStack, useNavStack } from '../../../components/mobile/MobileNavStack';
import { MobileCard } from '../../../components/mobile/MobileCard';
import { MobileLineItemRow } from '../../../components/mobile/MobileLineItemRow';

export function PartiallyCompletedInvoicesModalMobile({ invoices, onClose }: {
  invoices: UIInvoice[];
  onClose: () => void;
}) {
  const { stack, push, pop } = useNavStack();

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
            <p className="text-xs font-bold text-zinc-650">{inv.district}</p>
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
      content: renderDetail(inv)
    });
  };

  const root = {
    title: 'Partially Completed',
    subtitle: `Awaiting remaining stock (${invoices.length})`,
    content: (
      <div className="space-y-3">
        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Partial Invoices</p>
            <p className="text-zinc-400 text-[10px] mt-1">Invoices split during partial delivery will appear here.</p>
          </div>
        ) : (
          invoices.map((inv) => (
            <MobileCard key={inv.id} onClick={() => openDetail(inv)}>
              <MobileCard.Primary>
                <div className="min-w-0">
                  <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 flex-wrap">
                    {inv.number}
                    <span className="text-[9px] px-1.5 py-0.5 font-bold tracking-widest uppercase rounded bg-amber-50 text-amber-600">
                      Partial
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 truncate">{inv.client}</p>
                </div>
                <span className="text-sm font-black text-zinc-800 shrink-0">R {inv.amount.toLocaleString()}</span>
              </MobileCard.Primary>
              <MobileCard.Secondary>
                <span>{inv.date}</span>
              </MobileCard.Secondary>
            </MobileCard>
          ))
        )}
      </div>
    )
  };

  return (
    <MobileNavStack isOpen onClose={onClose} root={root} stack={stack} onPop={pop} />
  );
}
