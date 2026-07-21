/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../core/hooks/useAuth';
import { MobileSheet } from './mobile/MobileSheet';

interface PartialConfirmModalMobileProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  trip: any;
  itemKeys: string[];
  onSuccess?: () => void;
}

export function PartialConfirmModalMobile({ isOpen, onClose, invoice, trip, itemKeys, onSuccess }: PartialConfirmModalMobileProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedQtys, setConfirmedQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen || !invoice || !trip) return;
    const initialQtys: Record<string, number> = {};
    itemKeys.forEach(k => {
      const pItem = trip.partialItems?.[k];
      if (pItem) {
        initialQtys[k] = pItem.actualQty;
      }
    });
    setConfirmedQtys(initialQtys);
  }, [isOpen, invoice, trip, itemKeys, user]);

  if (!invoice || !trip) return null;

  const handleProcess = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const batch = writeBatch(db);
      const finalOwnerId = trip.userId || invoice.userId || user?.uid;

      const findMatchedKey = (item: any) => {
        const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
        return itemKeys.find(k => {
          if (k === keyUnified) return true;
          const [kStock, ...kDescParts] = k.split('_');
          const kDesc = kDescParts.join('_');
          return String(item.stockCode || 'NO_STOCK').trim().toLowerCase() === String(kStock).trim().toLowerCase() &&
                 String(item.description).trim().toLowerCase() === String(kDesc).trim().toLowerCase();
        });
      };

      const updatedLineItems = (invoice.lineItems || []).map((item: any) => {
        const matchedKey = findMatchedKey(item);
        if (matchedKey && confirmedQtys[matchedKey] !== undefined) {
          const confirmedQty = Number(confirmedQtys[matchedKey]) || 0;
          return {
            ...item,
            qty: confirmedQty,
            quantity: confirmedQty,
            value: item.line_item_value || item.value || (item.qty * (item.unitPrice || 0)),
            line_item_value: item.line_item_value || item.value || (item.qty * (item.unitPrice || 0))
          };
        }
        return {
          ...item,
          quantity: item.qty || 0,
          line_item_value: item.line_item_value || ((item.qty || 0) * (item.unitPrice || 0))
        };
      });

      const originalInvoiceRef = doc(db, 'invoices', invoice.id);
      const originalSubtotal = invoice.subTotal || invoice.sub_total || invoice.totalDue || invoice.total_due || invoice.totalAmount || 0;
      const originalTotalDue = originalSubtotal;

      batch.update(originalInvoiceRef, {
        lineItems: updatedLineItems,
        line_items: updatedLineItems,
        status: 'partially_complete',
        subTotal: originalSubtotal,
        totalDue: originalTotalDue,
        updatedAt: new Date().toISOString()
      });

      const originalTripRef = doc(db, 'trips', trip.id);

      const originalStops = (trip.stops || []).map((s: any) => {
        if (s.number === (invoice.taxInvoice || invoice.number)) {
          return { ...s, amount: originalSubtotal };
        }
        return s;
      });

      const splitLineItems = (invoice.lineItems || []).map((item: any) => {
        const matchedKey = findMatchedKey(item);
        if (matchedKey && confirmedQtys[matchedKey] !== undefined) {
          const confirmedQty = Number(confirmedQtys[matchedKey]) || 0;
          const remainingQty = Math.max(0, (item.qty || 0) - confirmedQty);
          return {
            ...item,
            qty: remainingQty,
            quantity: remainingQty,
            value: 0,
            line_item_value: 0
          };
        }
        return { ...item, qty: 0, quantity: 0, value: 0, line_item_value: 0 };
      }).filter((item: any) => item.qty > 0);

      const originalManifestItems = (trip.manifestItems || []).map((mi: any) => {
        const splitItem = splitLineItems.find((si: any) =>
          String(si.stockCode).trim().toLowerCase() === String(mi.stockCode).trim().toLowerCase() &&
          String(si.description).trim().toLowerCase() === String(mi.description).trim().toLowerCase()
        );
        if (splitItem) {
          return { ...mi, qty: Math.max(0, (mi.qty || 0) - splitItem.qty) };
        }
        return mi;
      });

      batch.update(originalTripRef, {
        status: 'partially-completed',
        stops: originalStops,
        manifestItems: originalManifestItems,
        updatedAt: new Date().toISOString()
      });

      const splitInvoiceNumber = `${invoice.taxInvoice || invoice.number}-R`;
      const splitInvoiceId = `SPLIT-${Date.now()}`;
      const splitInvoiceRef = doc(db, 'invoices', splitInvoiceId);

      const splitLineItemsDb = splitLineItems.map((item: any) => ({
        stockCode: item.stockCode || 'N/A',
        stock_code: item.stockCode || 'N/A',
        description: item.description || '',
        qty: item.qty || 0,
        quantity: item.qty || 0,
        unitPrice: 0,
        unit_price: 0,
        value: 0,
        line_item_value: 0
      }));

      batch.set(splitInvoiceRef, {
        userId: finalOwnerId,
        taxInvoice: splitInvoiceNumber,
        invoiceNumber: splitInvoiceNumber,
        schoolName: invoice.client || invoice.schoolName || 'Split Customer',
        district: invoice.district || 'Unassigned',
        status: 'partially_complete',
        lineItems: splitLineItemsDb,
        line_items: splitLineItemsDb,
        totalDue: 0,
        subTotal: 0,
        sub_total: 0,
        deliveryAddressLine1: invoice.deliveryAddressLine1 || '',
        deliveryAddressLine2: invoice.deliveryAddressLine2 || '',
        isPartialSplit: true,
        parentInvoiceId: invoice.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await batch.commit();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error processing partial split transactions:", err);
      setErrorMsg(err.message || "Permission or network error in the database transaction. Check if database permissions are valid.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Partial Completion"
      subtitle={invoice.taxInvoice || invoice.number}
      fullHeight={false}
      footer={
        <div className="flex gap-2">
          <button type="button" title="Cancel" onClick={onClose} disabled={isProcessing}
            className="flex-1 px-4 py-3 border border-zinc-200 text-zinc-650 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target">
            Cancel
          </button>
          <button type="button" title="Confirm and process split" onClick={handleProcess} disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-brand-primary disabled:bg-zinc-400 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 mobile-tap-target">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
          <span className="font-black text-[11px] uppercase tracking-wider">Reported partial delivery</span>
        </div>

        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 space-y-2">
          <div className="flex justify-between text-[11px] text-zinc-400 font-mono font-bold uppercase">
            <span>Invoice</span>
            <span>Trip</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-black text-sm">{invoice.taxInvoice || invoice.number}</span>
            <span className="font-black text-xs text-zinc-700 capitalize">{trip.name}</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Customer: <strong className="text-zinc-800">{invoice.client || invoice.schoolName}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-bold text-zinc-500 uppercase tracking-widest text-[9px] font-mono">Reported Partial Items</p>
          {itemKeys.map(k => {
            const pItem = trip.partialItems?.[k];
            const confirmedQty = confirmedQtys[k] !== undefined ? confirmedQtys[k] : (pItem?.actualQty || 0);
            if (!pItem) return null;

            return (
              <div key={k} className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                      {pItem.stockCode}
                    </span>
                    <h4 className="font-black text-xs text-zinc-900 mt-1">{pItem.description}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-500 font-bold block">Expected: {pItem.expectedQty}</span>
                    <span className="text-[10px] text-amber-700 font-extrabold block">Reported: {pItem.actualQty}</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">
                  <strong className="text-zinc-700">Reason:</strong> "{pItem.reason}"
                </p>
                <div className="space-y-1.5 pt-2 border-t border-amber-200/50">
                  <label className="text-[10px] font-black uppercase text-zinc-500 block">Confirm actual amount there</label>
                  <input
                    type="number"
                    title="Confirmed actual quantity"
                    min={0}
                    max={pItem.expectedQty}
                    value={confirmedQty}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(pItem.expectedQty, Number(e.target.value)));
                      setConfirmedQtys(prev => ({ ...prev, [k]: val }));
                    }}
                    className="w-full p-2.5 bg-white border border-zinc-300 rounded-lg text-sm text-center font-black focus:ring-2 focus:ring-amber-500/20"
                  />
                  <p className="text-[10px] font-mono font-bold text-amber-700">
                    Confirmed: {confirmedQty} | Split-off: {pItem.expectedQty - confirmedQty}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-500 leading-relaxed text-[10px]">
          Confirming splits the missing stock into a new unassigned <strong>Partially Completed</strong> invoice valued at <strong>R 0</strong>. The original invoice keeps the confirmed delivered quantity at the full amount.
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-750 border border-red-200 rounded-2xl font-black text-[10px] uppercase">
            {errorMsg}
          </div>
        )}
      </div>
    </MobileSheet>
  );
}
