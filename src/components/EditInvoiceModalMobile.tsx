/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Save, Plus } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleMapsAutocomplete } from './GoogleMapsAutocomplete';
import { MobileSheet } from './mobile/MobileSheet';
import { MobileLineItemEditRow, MobileLineItem } from './mobile/MobileLineItemRow';

interface EditInvoiceModalMobileProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  trips?: any[];
  onSuccess?: () => void;
}

export function EditInvoiceModalMobile({ isOpen, onClose, invoice, trips = [], onSuccess }: EditInvoiceModalMobileProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [status, setStatus] = useState('draft');
  const [lineItems, setLineItems] = useState<MobileLineItem[]>([]);

  const [stopLocation, setStopLocation] = useState('');
  const [stopType, setStopType] = useState('Delivery');
  const [stopStartTime, setStopStartTime] = useState('');
  const [stopEndTime, setStopEndTime] = useState('');

  const getStopDurationString = (start: string, end: string) => {
    if (!start || !end) return '';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diff) || diff < 0) return '0 mins';
    const totalMinutes = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins} mins`;
    if (mins === 0) return `${hrs} hours`;
    return `${hrs}h ${mins}m`;
  };

  const [partialFlags, setPartialFlags] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    setClientName(invoice.client || invoice.schoolName || '');
    setInvoiceNumber(invoice.number || invoice.taxInvoice || '');
    setInvoiceDate(invoice.date || invoice.invoiceDate || '');
    setDistrict(invoice.district || '');
    setAddressLine1(invoice.deliveryAddressLine1 || '');
    setAddressLine2(invoice.deliveryAddressLine2 || '');
    setDeliveryAddress(invoice.deliveryAddress || '');
    setStatus(invoice.status || 'draft');

    const sd = invoice.stopDetails || {};
    const defaultLoc = [invoice.deliveryAddressLine1, invoice.deliveryAddressLine2, invoice.district].filter(Boolean).join(', ') || invoice.client || '';
    setStopLocation(sd.location || defaultLoc);
    setStopType(sd.type || 'Delivery');
    setStopStartTime(sd.startTime || (invoice.invoiceDate ? invoice.invoiceDate + 'T08:00' : ''));
    setStopEndTime(sd.endTime || (invoice.invoiceDate ? invoice.invoiceDate + 'T08:30' : ''));

    const items = (invoice.lineItems || []).map((item: any) => ({
      stockCode: item.stockCode || item.stock_code || 'N/A',
      description: item.description || '',
      qty: typeof item.qty === 'number' ? item.qty : (typeof item.quantity === 'number' ? item.quantity : 0),
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : (typeof item.unit_price === 'number' ? item.unit_price : 0),
      value: typeof item.value === 'number' ? item.value : (typeof item.line_item_value === 'number' ? item.line_item_value : 0)
    }));
    setLineItems(items);

    const flags: any[] = [];
    trips.forEach((trip: any) => {
      if (trip.invoiceIds?.includes(invoice.id) && trip.partialItems) {
        Object.keys(trip.partialItems).forEach(key => {
          const pi = trip.partialItems[key];
          if (pi?.isPartial) {
            flags.push({
              tripName: trip.name,
              tripDate: trip.date,
              stockCode: pi.stockCode || '',
              description: pi.description || '',
              expectedQty: pi.expectedQty || 0,
              actualQty: pi.actualQty || 0,
              reason: pi.reason || ''
            });
          }
        });
      }
    });
    setPartialFlags(flags);
    setErrorMsg(null);
  }, [isOpen, invoice, trips]);

  if (!invoice) return null;

  const totalDue = lineItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0);

  const handleAddLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { stockCode: 'NEW_CODE', description: 'New item description', qty: 1, unitPrice: 0, value: 0 }
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index: number, patch: Partial<MobileLineItem>) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...patch };
      if ('qty' in patch || 'unitPrice' in patch) {
        const qty = Number('qty' in patch ? patch.qty : item.qty) || 0;
        const price = Number('unitPrice' in patch ? patch.unitPrice : item.unitPrice) || 0;
        updated.value = qty * price;
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!invoiceNumber.trim()) {
      setErrorMsg("Invoice number (taxInvoice) is required.");
      return;
    }
    if (!clientName.trim()) {
      setErrorMsg("Client/School name is required.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const formattedLineItemsDb = lineItems.map((item: any) => ({
        stockCode: item.stockCode || 'N/A',
        stock_code: item.stockCode || 'N/A',
        description: item.description || '',
        qty: Number(item.qty) || 0,
        quantity: Number(item.qty) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        unit_price: Number(item.unitPrice) || 0,
        value: Number(item.qty) * Number(item.unitPrice),
        line_item_value: Number(item.qty) * Number(item.unitPrice)
      }));

      const invoiceRef = doc(db, 'invoices', invoice.id);

      const deliveryChanged = deliveryAddress.trim() !== (invoice.deliveryAddress || '').trim();
      const deliveryAddressManual = deliveryChanged ? deliveryAddress.trim().length > 0 : (invoice.deliveryAddressManual === true);

      await updateDoc(invoiceRef, {
        schoolName: clientName,
        taxInvoice: invoiceNumber,
        invoiceDate: invoiceDate,
        district: district,
        deliveryAddressLine1: addressLine1,
        deliveryAddressLine2: addressLine2,
        deliveryAddress: deliveryAddress,
        deliveryAddressManual: deliveryAddressManual,
        status: status,
        lineItems: formattedLineItemsDb,
        line_items: formattedLineItemsDb,
        subTotal: totalDue,
        totalDue: totalDue,
        stopDetails: {
          location: stopLocation,
          type: stopType,
          startTime: stopStartTime,
          endTime: stopEndTime,
          duration: getStopDurationString(stopStartTime, stopEndTime)
        },
        updatedAt: new Date().toISOString()
      });

      setIsSaving(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error editing invoice:", err);
      setErrorMsg(err.message || "Permissions or database connection failed. Please verify Firestore rules.");
      setIsSaving(false);
    }
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Invoice"
      subtitle={invoice.id}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-3 border border-zinc-200 text-zinc-650 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save invoice"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-brand-primary disabled:bg-zinc-450 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 mobile-tap-target"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-750 border border-red-200 rounded-2xl font-bold uppercase text-[10px]">
            {errorMsg}
          </div>
        )}

        {partialFlags.length > 0 && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-black uppercase tracking-wider text-[10px]">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
              Team-Reported Discrepancies
            </div>
            {partialFlags.map((flag, idx) => (
              <div key={idx} className="text-[10px] text-zinc-600">
                <strong className="text-zinc-800">{flag.tripName}</strong> — [{flag.stockCode}] {flag.description}: expected {flag.expectedQty}, actual {flag.actualQty}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-zinc-500">Client / School Name</span>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} title="Client / School Name"
              className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-zinc-500">Tax Invoice #</span>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} title="Tax Invoice Number"
              className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono font-black uppercase" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-zinc-500">Date</span>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} title="Invoice Date"
                className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-zinc-500">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} title="Invoice Status"
                className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-black">
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="proposed">Proposed</option>
                <option value="assembled">Assembled</option>
                <option value="on_route">On Route</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="partially_complete">Partially Complete</option>
                <option value="invoiced">Invoiced</option>
              </select>
            </label>
          </div>
        </div>

        <div className="bg-amber-50/20 p-3 rounded-2xl border border-amber-500/20 space-y-3">
          <h4 className="font-black uppercase tracking-wider text-[10px] text-zinc-500 border-b border-zinc-100 pb-2">Stop Details</h4>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-zinc-500">Location</span>
            <div className="mt-1">
              <GoogleMapsAutocomplete value={stopLocation} onChange={setStopLocation} placeholder="Search stop or delivery address..." />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-zinc-500">Type</span>
            <select value={stopType} onChange={(e) => setStopType(e.target.value)} title="Stop Type"
              className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold">
              <option value="Delivery">Delivery</option>
              <option value="Pickup">Pickup</option>
              <option value="Refuel">Refuel</option>
              <option value="Sleep">Sleep</option>
              <option value="Rest">Rest</option>
              <option value="Service">Service</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-zinc-500">Start</span>
              <input type="datetime-local" value={stopStartTime} onChange={(e) => setStopStartTime(e.target.value)} title="Stop start time"
                className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-zinc-500">End</span>
              <input type="datetime-local" value={stopEndTime} onChange={(e) => setStopEndTime(e.target.value)} title="Stop end time"
                className="w-full mt-1 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold" />
            </label>
          </div>
          {stopStartTime && stopEndTime && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-block">
              Duration: {getStopDurationString(stopStartTime, stopEndTime)}
            </div>
          )}
        </div>

        <div className="bg-zinc-50/50 p-3 rounded-2xl border border-zinc-150 space-y-3">
          <h4 className="font-bold uppercase tracking-wider text-[10px] text-zinc-400">Delivery Routing Address</h4>
          <label className="block">
            <span className="text-[9px] font-bold uppercase text-zinc-500">District / Region</span>
            <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} title="District"
              className="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg font-bold" />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase text-zinc-500">Street Line 1</span>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} title="Address line 1"
              className="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg font-bold" />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase text-zinc-500">Suite / Suburb (Line 2)</span>
            <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} title="Address line 2"
              className="w-full mt-1 p-2 bg-white border border-zinc-200 rounded-lg font-bold" />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase text-zinc-500">Delivery Address (map pin)</span>
            <div className="mt-1">
              <GoogleMapsAutocomplete value={deliveryAddress} onChange={setDeliveryAddress} placeholder="Search the delivery address..." />
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-black uppercase text-[10px] tracking-wider text-brand-primary">Line Items</h4>
            <button type="button" title="Add line item" onClick={handleAddLineItem}
              className="px-2.5 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg font-black uppercase text-[9px] flex items-center gap-1 text-zinc-650 mobile-tap-target">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
          {lineItems.length === 0 ? (
            <p className="py-6 text-center text-zinc-400 italic font-medium text-xs">No items. Tap Add Item to start.</p>
          ) : (
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <MobileLineItemEditRow
                  key={idx}
                  item={item}
                  onChange={(patch) => handleUpdateLineItem(idx, patch)}
                  onRemove={() => handleRemoveLineItem(idx)}
                />
              ))}
            </div>
          )}
          <div className="bg-zinc-50 p-3 rounded-2xl flex justify-between items-center border border-zinc-200">
            <span className="font-bold uppercase tracking-wide text-zinc-400 font-mono text-[10px]">Total Due</span>
            <span className="font-mono text-base font-black text-brand-primary">
              R {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </MobileSheet>
  );
}
