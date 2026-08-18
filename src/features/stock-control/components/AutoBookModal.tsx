import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Zap, Loader2, ChevronRight } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import { PhaseProgressBar } from './PhaseColumn';
import { computeAutoBookCandidates, normalize } from '../utils/phaseCalculations';
import type { OrderRow, StockRow } from '../utils/phaseCalculations';
import { cn } from '../../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderRows: OrderRow[];
  stockRows: StockRow[];
  allocateStock: (params: { invoiceId: string; orderNumber: string; schoolName: string; stockCode: string; qty: number }) => Promise<{ success: boolean; error?: string }>;
}

export function AutoBookModal({ isOpen, onClose, orderRows, stockRows, allocateStock }: Props) {
  const candidates = useMemo(() => computeAutoBookCandidates(orderRows, stockRows), [orderRows, stockRows]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ fullyBooked: number; partiallyBooked: number; unitsBooked: number } | null>(null);

  // Fresh selection (default to everything Auto-Book can fully close out) each
  // time the dialog opens, and drop the previous run's summary.
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(candidates.filter(c => c.pct >= 100).map(c => c.order.invoiceId)));
      setSubmitting(false);
      setProgress(0);
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const allSelected = candidates.length > 0 && selectedIds.size === candidates.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(candidates.map(c => c.order.invoiceId)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const selected = candidates.filter(c => selectedIds.has(c.order.invoiceId));
    if (selected.length === 0) return;

    setSubmitting(true);
    setProgress(0);

    // Running per-SKU available pool, decremented as each order books — so two
    // selected orders competing for the same SKU never both get the full amount
    // this dialog originally estimated for them.
    const remaining = new Map<string, number>();
    stockRows.forEach(r => remaining.set(normalize(r.stockCode), r.available));

    const totalOps = selected.reduce((s, c) => s + c.lines.length, 0);
    let opsDone = 0, fullyBooked = 0, partiallyBooked = 0, unitsBooked = 0;

    for (const candidate of selected) {
      let orderUnitsBooked = 0;

      for (const line of candidate.lines) {
        const codeKey = normalize(line.stockCode);
        const avail = remaining.get(codeKey) || 0;
        const qty = Math.min(line.shortBy, avail);

        if (qty > 0) {
          const result = await allocateStock({
            invoiceId: candidate.order.invoiceId,
            orderNumber: candidate.order.orderNumber,
            schoolName: candidate.order.schoolName,
            stockCode: line.stockCode,
            qty
          });
          if (result.success) {
            remaining.set(codeKey, avail - qty);
            orderUnitsBooked += qty;
            unitsBooked += qty;
          }
        }

        opsDone++;
        setProgress(Math.round((opsDone / totalOps) * 100));
      }

      if (orderUnitsBooked > 0) {
        if (orderUnitsBooked >= candidate.neededUnits) fullyBooked++;
        else partiallyBooked++;
      }
    }

    setSubmitting(false);
    setSummary({ fullyBooked, partiallyBooked, unitsBooked });

    if (unitsBooked > 0) {
      toast.success(`Booked ${unitsBooked} units`, {
        description: `${fullyBooked} order${fullyBooked === 1 ? '' : 's'} fully booked${partiallyBooked > 0 ? `, ${partiallyBooked} partially (short of stock)` : ''}.`
      });
    } else {
      toast.warning('Nothing booked', { description: 'Stock ran out before any selected order could be reserved.' });
    }
  };

  return (
    <PhaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Auto-Book Orders"
      subtitle="Reserve available stock against open orders automatically"
      maxWidth="max-w-xl"
      footer={
        summary ? (
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              title="Cancel"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              title="Book the selected orders"
              onClick={handleSubmit}
              disabled={selectedIds.size === 0 || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />}
              {submitting ? 'Booking…' : `Book ${selectedIds.size || ''} Selected`}
            </button>
          </>
        )
      }
    >
      {summary ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center">
            <Zap className="w-7 h-7" />
          </div>
          <p className="text-sm font-black text-zinc-800 uppercase tracking-wide">{summary.unitsBooked} Units Booked</p>
          <p className="text-xs text-zinc-500">
            {summary.fullyBooked} order{summary.fullyBooked === 1 ? '' : 's'} fully booked
            {summary.partiallyBooked > 0 && `, ${summary.partiallyBooked} partially booked (ran short of stock)`}.
          </p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="py-10 text-center">
          <Zap className="w-10 h-10 text-zinc-200 mx-auto stroke-[1.5]" />
          <p className="text-sm font-black text-zinc-600 uppercase tracking-wide mt-3">Nothing to auto-book</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
            No open order currently has both an unmet requirement and matching stock on hand.
          </p>
        </div>
      ) : (
        <>
          {submitting && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500">
                <span>Booking…</span>
                <span>{progress}%</span>
              </div>
              <PhaseProgressBar pct={progress} accent="indigo" />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              title="Select all candidates"
              checked={allSelected}
              onChange={toggleAll}
              disabled={submitting}
              className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30"
            />
            Select all ({candidates.length})
          </label>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {candidates.map((c) => {
              const selected = selectedIds.has(c.order.invoiceId);
              return (
                <label
                  key={c.order.invoiceId}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    selected ? 'bg-brand-accent/5 border-brand-accent/30' : 'bg-zinc-50/50 border-zinc-150 hover:border-zinc-250'
                  )}
                >
                  <input
                    type="checkbox"
                    title={`Select ${c.order.schoolName}`}
                    checked={selected}
                    onChange={() => toggleOne(c.order.invoiceId)}
                    disabled={submitting}
                    className="w-4 h-4 mt-0.5 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-brand-primary uppercase truncate">{c.order.schoolName}</p>
                      <span className={cn('text-[10px] font-black shrink-0', c.pct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>{c.pct}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      <span>{c.order.orderNumber || '—'}</span>
                      <span>&middot;</span>
                      <span>{c.order.area || 'Unassigned'}</span>
                    </div>
                    <PhaseProgressBar pct={c.pct} accent={c.pct >= 100 ? 'emerald' : 'amber'} />
                    <p className="text-[10px] font-mono text-zinc-500">
                      Needs {c.neededUnits} &middot; In stock now: <strong className="text-zinc-700">{c.coverableUnits}</strong>
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
    </PhaseModal>
  );
}
