import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, CheckCircle2, AlertTriangle, Search, ArrowRight, Loader2 } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import { MoveInvoiceModal } from '../../trips/tripFormComponents/MoveInvoiceModal';
import { useInvoices } from '../../invoices/hooks/useInvoices';
import type { UIInvoice } from '../../invoices/hooks/useInvoices';
import { useTrips } from '../../trips/hooks/useTrips';
import { useTrucks } from '../../trucks/hooks/useTrucks';
import { TripStatus, TripStop } from '../../../types';
import { cn, formatCurrency } from '../../../lib/utils';
import type { OrderRow } from '../utils/phaseCalculations';
import type { Order as SchoolOrder } from '../../orders/hooks/useOrders';

const norm = (s: string) => (s || '').trim().toLowerCase();

function FallbackBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

function MatchCard({ invoice, onSelect, highlight }: { invoice: UIInvoice; onSelect: (inv: UIInvoice) => void; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 p-3 rounded-xl border transition-all',
      highlight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-zinc-50/50 border-zinc-150'
    )}>
      <div className="min-w-0">
        <p className="text-xs font-black text-brand-primary truncate">Invoice #{invoice.number}</p>
        <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
          PO {invoice.orderNumber || '—'} &middot; {invoice.schoolName || invoice.client}
        </p>
        <p className="text-[10px] font-mono text-zinc-400 mt-0.5">R {formatCurrency(invoice.amount)} &middot; {invoice.date}</p>
      </div>
      <button
        type="button"
        title={`Use invoice #${invoice.number}`}
        onClick={() => onSelect(invoice)}
        className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary hover:bg-zinc-800 text-white text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer shrink-0"
      >
        Use This <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export function LinkInvoiceModal({
  order,
  schoolOrders,
  onClose,
  updateSchoolOrder
}: {
  order: OrderRow | null;
  schoolOrders: SchoolOrder[];
  onClose: () => void;
  updateSchoolOrder: (id: string, data: { status: 'Active' | 'Complete' }) => Promise<boolean>;
}) {
  const { invoices } = useInvoices();
  const { trips, addTrip, updateTrip } = useTrips();
  const { trucks } = useTrucks();

  const [step, setStep] = useState<'lookup' | 'email'>('lookup');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UIInvoice | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Fresh state each time a different order is opened for linking.
  useEffect(() => {
    if (!order) return;
    setStep('lookup');
    setSearch(order.orderNumber || '');
    setSelected(null);
    setAssigning(false);

    // Best-effort prefill: reuse a contact email from any other invoice on file
    // for this same school, since the order itself carries no contact details.
    const priorContact = invoices.find(inv =>
      norm(inv.schoolName || inv.client) === norm(order.schoolName) && inv.clientEmail && inv.clientEmail !== 'No Email'
    );
    setEmailTo(priorContact?.clientEmail || '');
    setEmailSubject(`Invoice Request — Order ${order.orderNumber || order.schoolName}`);
    setEmailBody(
      `Hi,\n\n` +
      `We have ${order.totalOrdered} unit${order.totalOrdered === 1 ? '' : 's'} ready for delivery for ${order.schoolName}` +
      `${order.orderNumber ? ` (Order ${order.orderNumber})` : ''}, but we don't yet have a matching invoice on file to schedule the delivery.\n\n` +
      `Could you please send through the invoice for this order, or confirm the purchase order number so we can locate it on our side?\n\n` +
      `Thank you,`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.invoiceId]);

  // An invoice-backed order already has its invoice in hand (order.invoiceId is
  // that invoice's own id) — no search needed, just confirm it. A standalone
  // Orders-collection order has never been linked to one, so it's found by
  // matching Customer P/O against still-draft invoices.
  const autoMatches = useMemo(() => {
    if (!order) return [];
    if (order.source === 'invoice') {
      const direct = invoices.find(inv => inv.id === order.invoiceId);
      return direct ? [direct] : [];
    }
    if (!order.orderNumber) return [];
    return invoices.filter(inv => norm(inv.orderNumber || '') === norm(order.orderNumber) && norm(inv.status) === 'draft');
  }, [order, invoices]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return invoices.filter(inv =>
      inv.number.toLowerCase().includes(q) ||
      (inv.orderNumber || '').toLowerCase().includes(q) ||
      inv.client.toLowerCase().includes(q) ||
      (inv.schoolName || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [invoices, search]);

  if (!order) return null;

  const buildStop = (invoice: UIInvoice): TripStop => {
    const address = [invoice.deliveryAddressLine1, invoice.deliveryAddressLine2, invoice.district].filter(Boolean).join(', ');
    const stopDetails = invoice.stopDetails || {};
    return {
      id: 'stop-' + Math.random().toString(36).substr(2, 9),
      location: stopDetails.location || address || invoice.schoolName || invoice.client,
      type: stopDetails.type || 'Delivery',
      startTime: stopDetails.startTime || '',
      endTime: stopDetails.endTime || '',
      duration: stopDetails.duration || '30m',
      invoiceId: invoice.id,
      client: invoice.client,
      number: invoice.number,
      amount: invoice.amount,
      address
    };
  };

  // Marks the matching Orders-collection order(s) Complete once the invoice has
  // an actual trip — graduated from "needs an invoice"/"ready" to "being
  // delivered", so it stops showing as a Ready card. The same real-world order
  // can exist as both a standalone Orders-collection row (source: 'order') AND
  // its own invoice-backed row (source: 'invoice') if it was separately
  // imported and invoiced, so this always looks up by Customer P/O rather than
  // only touching order.invoiceId — an invoice-backed row's invoiceId is the
  // invoice's own id, not an orders/{id}, and wouldn't find anything on its own.
  const finishAssignment = async (confirmedInvoice: UIInvoice) => {
    const poKey = norm(confirmedInvoice.orderNumber || order.orderNumber);
    const matches = order.source === 'order'
      ? schoolOrders.filter(so => so.id === order.invoiceId)
      : poKey ? schoolOrders.filter(so => norm(so.orderNumber) === poKey && so.status === 'Active') : [];

    if (matches.length > 0) {
      const results = await Promise.all(matches.map(so => updateSchoolOrder(so.id, { status: 'Complete' })));
      if (results.every(Boolean)) {
        toast.success('Order Completed', { description: `${order.schoolName} was added to the trip and marked Complete.` });
      } else {
        toast.warning('Added to trip', { description: 'The trip was updated, but the order status could not be marked Complete.' });
      }
    } else {
      toast.success('Added to Trip', { description: `${order.schoolName} was added to the trip.` });
    }
    onClose();
  };

  const handleMoveToExisting = async (destTripId: string) => {
    if (!selected) return;
    const destTrip = trips.find(t => t.id === destTripId);
    if (!destTrip) return;
    setAssigning(true);
    try {
      await updateTrip(destTripId, {
        invoiceIds: [...destTrip.invoiceIds, selected.id],
        stops: [...(destTrip.stops || []), buildStop(selected)]
      });
      await finishAssignment(selected);
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateAndMove = async (data: { name: string; date: string; truckId: string }) => {
    if (!selected) return;
    setAssigning(true);
    try {
      const truck = trucks.find(t => t.id === data.truckId);
      const newTripId = await addTrip({
        name: data.name,
        date: data.date,
        truckId: data.truckId,
        truckName: truck?.name || '',
        status: TripStatus.PENDING,
        invoiceIds: [selected.id],
        stops: [buildStop(selected)]
      });
      if (!newTripId) {
        toast.error('Could Not Create Trip', { description: 'The order was not added.' });
        return;
      }
      await finishAssignment(selected);
    } finally {
      setAssigning(false);
    }
  };

  const handleSendEmail = () => {
    if (!emailTo.trim()) return;
    const mailto = `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;
    toast.success('Draft Email Opened', { description: 'Finish and send it from your email app.' });
    onClose();
  };

  if (selected) {
    return (
      <MoveInvoiceModal
        isOpen={true}
        onClose={onClose}
        invoiceLabel={`#${selected.number} — ${selected.schoolName || selected.client}`}
        trips={trips}
        trucks={trucks}
        defaultDate={new Date().toISOString().split('T')[0]}
        onMoveToExisting={handleMoveToExisting}
        onCreateAndMove={handleCreateAndMove}
      />
    );
  }

  return (
    <PhaseModal
      isOpen={!!order}
      onClose={onClose}
      title="Add to Trip"
      subtitle={`${order.schoolName} · ${order.orderNumber || 'No PO'}`}
      maxWidth="max-w-lg"
    >
      {assigning ? (
        <div className="py-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          <p className="text-xs text-zinc-500 font-mono uppercase">Assigning to trip…</p>
        </div>
      ) : step === 'lookup' ? (
        <div className="space-y-4">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {order.source === 'order'
              ? "This order was imported from a delivery schedule and isn't linked to an invoice yet — a trip needs a real invoice to deliver against. We looked for a matching draft invoice by Customer P/O."
              : 'Confirm this is the right invoice before scheduling a delivery trip for it.'}
          </p>

          {order.source === 'order' && !order.orderNumber ? (
            <FallbackBanner text="This order has no order number to match against — search for the invoice manually below." />
          ) : autoMatches.length === 0 ? (
            <FallbackBanner text={
              order.source === 'invoice'
                ? 'The linked invoice could not be found — it may have been deleted. Search for it manually below.'
                : `No draft invoice found for Customer P/O ${order.orderNumber}.`
            } />
          ) : autoMatches.length === 1 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {order.source === 'invoice' ? 'Linked Invoice' : 'Draft Invoice Found'}
              </div>
              <MatchCard invoice={autoMatches[0]} onSelect={setSelected} highlight />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-amber-700">{autoMatches.length} draft invoices share this PO — choose the right one:</p>
              {autoMatches.map(inv => <MatchCard key={inv.id} invoice={inv} onSelect={setSelected} />)}
            </div>
          )}

          <div className="space-y-2 pt-3 border-t border-zinc-100">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wide">Or search all invoices</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                title="Search invoices"
                placeholder="Invoice #, PO, or school name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
            {search.trim() && (
              searchResults.length === 0 ? (
                <p className="text-[11px] text-zinc-400 py-2 text-center">No invoices match "{search}".</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {searchResults.map(inv => <MatchCard key={inv.id} invoice={inv} onSelect={setSelected} />)}
                </div>
              )
            )}
          </div>

          <button
            type="button"
            title="Email the client to request the invoice"
            onClick={() => setStep('email')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[11px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            Can't Find It? Email the Client
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-zinc-500">
            <Mail className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wide">Request Invoice From Client</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">To</label>
            <input
              type="email"
              title="Recipient email address"
              placeholder="client@school.gov.za"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
            />
            {!emailTo.trim() && (
              <p className="text-[10px] text-amber-600">No email on file for this school — enter one to continue.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Subject</label>
            <input
              type="text"
              title="Email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Message</label>
            <textarea
              title="Email message"
              rows={7}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              title="Back to invoice lookup"
              onClick={() => setStep('lookup')}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              title="Open this email in your email app"
              onClick={handleSendEmail}
              disabled={!emailTo.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              Open in Email App
            </button>
          </div>
        </div>
      )}
    </PhaseModal>
  );
}
