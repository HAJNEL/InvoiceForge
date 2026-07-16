/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  X, Save, Plus, Trash2, AlertTriangle, Loader2, DollarSign, Calendar, MapPin, Clock
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleMapsAutocomplete } from './GoogleMapsAutocomplete';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any; // the UIInvoice object to edit
  trips?: any[]; // optional list of trips to detect partial completeness
  onSuccess?: () => void;
}

export function EditInvoiceModal({ isOpen, onClose, invoice, trips = [], onSuccess }: EditInvoiceModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable Form fields
  const [clientName, setClientName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  // The actual location used for the map pin. Editing it moves the pin (the trip
  // maps re-geocode when this differs from the cached pin's searchAddress).
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [status, setStatus] = useState('draft');
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Stop Details Form Fields
  const [stopLocation, setStopLocation] = useState('');
  const [stopType, setStopType] = useState('Delivery');
  const [stopStartTime, setStopStartTime] = useState('');
  const [stopEndTime, setStopEndTime] = useState('');

  // Helper to calculate stop duration
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

  // Detected partial flags
  const [partialFlags, setPartialFlags] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    // Load original invoice fields
    setClientName(invoice.client || invoice.schoolName || '');
    setInvoiceNumber(invoice.number || invoice.taxInvoice || '');
    setInvoiceDate(invoice.date || invoice.invoiceDate || '');
    setDistrict(invoice.district || '');
    setAddressLine1(invoice.deliveryAddressLine1 || '');
    setAddressLine2(invoice.deliveryAddressLine2 || '');
    setDeliveryAddress(invoice.deliveryAddress || '');
    setStatus(invoice.status || 'draft');

    // Load stop details (if exists)
    const sd = invoice.stopDetails || {};
    const defaultLoc = [invoice.deliveryAddressLine1, invoice.deliveryAddressLine2, invoice.district].filter(Boolean).join(', ') || invoice.client || '';
    setStopLocation(sd.location || defaultLoc);
    setStopType(sd.type || 'Delivery');
    setStopStartTime(sd.startTime || (invoice.invoiceDate ? invoice.invoiceDate + 'T08:00' : ''));
    setStopEndTime(sd.endTime || (invoice.invoiceDate ? invoice.invoiceDate + 'T08:30' : ''));

    // Load line items (ensure safety structure)
    const items = (invoice.lineItems || []).map((item: any) => ({
      stockCode: item.stockCode || item.stock_code || 'N/A',
      description: item.description || '',
      qty: typeof item.qty === 'number' ? item.qty : (typeof item.quantity === 'number' ? item.quantity : 0),
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : (typeof item.unit_price === 'number' ? item.unit_price : 0),
      value: typeof item.value === 'number' ? item.value : (typeof item.line_item_value === 'number' ? item.line_item_value : 0)
    }));
    setLineItems(items);

    // Detect if this invoice has partial completeness reports in trips
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

  if (!isOpen || !invoice) return null;

  // Recalculating totals
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

  const handleUpdateLineItem = (index: number, field: string, value: any) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'unitPrice') {
          const qty = field === 'qty' ? Number(value) : Number(item.qty);
          const price = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
          updated.value = qty * price;
        }
        return updated;
      }
      return item;
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
      // Build double format (camelCase and snake_case) of line items for DB
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

      // Mark the delivery address as manual only when the user actually changed it,
      // so Refresh Pins preserves hand-picked pins but keeps re-looking-up the rest.
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in text-zinc-900">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-sans font-black text-sm uppercase tracking-wider text-brand-primary">Edit Invoice Information</h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">ID: {invoice.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
            disabled={isSaving}
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-left">
          
          {/* Global DB Errors */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 text-red-750 border border-red-200 rounded-2xl font-bold uppercase tracking-tight text-[10px]">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Reported Discrepancies Info Section */}
          {partialFlags.length > 0 && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-black uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-4 h-4 animate-pulse stroke-[2.5]" />
                Team-Reported Discrepancies on Active Trips:
              </div>
              <div className="space-y-2 divide-y divide-amber-200/50">
                {partialFlags.map((flag, idx) => (
                  <div key={idx} className="pt-2 first:pt-0">
                    <p className="font-bold text-zinc-800">
                      Trip: <span className="text-zinc-650 font-black">{flag.tripName}</span> ({flag.tripDate})
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Line Item: <strong className="text-amber-900">[{flag.stockCode}] {flag.description}</strong>
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      Expected quantity: <strong className="text-zinc-700">{flag.expectedQty}</strong> | Actual there: <strong className="text-amber-800 font-extrabold">{flag.actualQty} units</strong>
                    </p>
                    <p className="text-[10px] text-zinc-500 italic mt-0.5">
                      Reason: "{flag.reason}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stop Details Section */}
          <div className="bg-amber-50/20 p-4 rounded-2xl border border-amber-500/20 space-y-3.5 shadow-xs">
            <h4 className="font-sans font-black uppercase tracking-wider text-[10px] text-zinc-500 flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Clock className="w-3.5 h-3.5 text-brand-accent stroke-[2.5]" /> Stop Details Section
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 block">Location</label>
                <GoogleMapsAutocomplete
                  value={stopLocation}
                  onChange={setStopLocation}
                  placeholder="Search stop or delivery address..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 block">Type</label>
                <select aria-label="Type"
                  value={stopType}
                  onChange={(e) => setStopType(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900 cursor-pointer"
                >
                  <option value="Delivery">Delivery</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Refuel">Refuel</option>
                  <option value="Sleep">Sleep</option>
                  <option value="Rest">Rest</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 block">Start Date & Time</label>
                <input aria-label="Start Date and Time"
                  type="datetime-local"
                  value={stopStartTime}
                  onChange={(e) => setStopStartTime(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 text-xs text-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 block">End Date & Time</label>
                <input aria-label="End Date and Time"
                  type="datetime-local"
                  value={stopEndTime}
                  onChange={(e) => setStopEndTime(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 text-xs text-zinc-900"
                />
              </div>
            </div>
            
            {stopStartTime && stopEndTime && (
              <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-650" />
                Duration: {getStopDurationString(stopStartTime, stopEndTime)}
              </div>
            )}
          </div>

          {/* Primary client and invoice info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">Client / School Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 focus:bg-white"
                placeholder="Client Name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">TAX INVOICE #</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono font-black uppercase focus:ring-2 focus:ring-brand-accent/20 focus:bg-white"
                placeholder="Invoice Number"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date
              </label>
              <input aria-label="Date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">Current Status</label>
              <select aria-label="Current Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-black focus:ring-2 focus:ring-brand-accent/20 focus:bg-white cursor-pointer"
              >
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
            </div>
          </div>

          {/* Regional Area and Address */}
          <div className="bg-zinc-50/50 p-4 rounded-2xl border border-zinc-150 space-y-3.5">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-zinc-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Delivery Routing Address
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-500 block">District / Region</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full p-2 bg-white border border-zinc-200 rounded-lg font-bold"
                  placeholder="e.g. Durban North"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-zinc-500 block">Delivery Street line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full p-2 bg-white border border-zinc-200 rounded-lg font-bold"
                  placeholder="Street"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-bold uppercase text-zinc-500 block">Delivery Suite / Suburb (Line 2)</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full p-2 bg-white border border-zinc-200 rounded-lg font-bold"
                  placeholder="Additional details"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-bold uppercase text-zinc-500 block">Delivery Address (map pin location)</label>
                <GoogleMapsAutocomplete
                  value={deliveryAddress}
                  onChange={setDeliveryAddress}
                  placeholder="Search the delivery address on Google Maps..."
                  className="w-full p-2 bg-white border border-zinc-200 rounded-lg font-bold"
                />
                <p className="text-[10px] text-zinc-400 font-medium normal-case">Actual location used for the map pin. Auto-filled from the Google Maps school lookup; edit to override where the pin is placed.</p>
              </div>
            </div>
          </div>

          {/* Dynamic line items editor */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-sans font-black uppercase text-[10px] tracking-wider text-brand-primary">Line Items Editor</h4>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg font-black uppercase text-[9px] flex items-center gap-1 text-zinc-650"
              >
                <Plus className="w-3 h-3 text-brand-primary shrink-0" /> Add Item
              </button>
            </div>

            <div className="border border-zinc-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200">
                    <th className="py-2.5 px-3">Stock Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center w-20">Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Unit Price</th>
                    <th className="py-2.5 px-3 text-right w-28">Value (ZAR)</th>
                    <th className="py-2.5 px-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 italic font-medium">
                        No items. Click Add Item to start.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => {
                      // Check if this item is flagged as partially completed
                      const itemFlagged = partialFlags.some(f => 
                        String(f.stockCode).trim().toLowerCase() === String(item.stockCode).trim().toLowerCase() &&
                        String(f.description).trim().toLowerCase() === String(item.description).trim().toLowerCase()
                      );

                      return (
                        <tr key={idx} className={`hover:bg-zinc-50/50 transition-colors ${itemFlagged ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-2 w-28">
                            <input aria-label="Stock code"
                              type="text"
                              value={item.stockCode}
                              onChange={(e) => handleUpdateLineItem(idx, 'stockCode', e.target.value)}
                              className="w-full p-1 bg-white border border-zinc-200 rounded font-mono font-bold text-[11px] text-brand-primary uppercase"
                            />
                            {itemFlagged && (
                              <span className="text-[7px] text-amber-700 font-extrabold uppercase bg-amber-100 px-1 rounded block mt-0.5 max-w-max select-none">
                                FLAG
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <input aria-label="Description"
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateLineItem(idx, 'description', e.target.value)}
                              className="w-full p-1 bg-white border border-zinc-200 rounded text-[11px]"
                            />
                          </td>
                          <td className="p-2 w-20">
                            <input aria-label="Quantity"
                              type="number"
                              min={0}
                              value={item.qty}
                              onChange={(e) => handleUpdateLineItem(idx, 'qty', Number(e.target.value))}
                              className="w-full p-1 bg-white border border-zinc-200 rounded text-center font-bold text-[11px]"
                            />
                          </td>
                          <td className="p-2 w-28">
                            <input aria-label="Unit price"
                              type="number"
                              min={0}
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', Number(e.target.value))}
                              className="w-full p-1 bg-white border border-zinc-200 rounded text-right font-bold text-[11px]"
                            />
                          </td>
                          <td className="p-2 w-28 text-right font-mono font-bold text-[11px] tabular-nums text-zinc-700 bg-zinc-50/50">
                            R {((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)).toLocaleString()}
                          </td>
                          <td className="p-2 w-12 text-center">
                            <button
                              title='Remove'
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total recap bar */}
            <div className="bg-zinc-50 p-3.5 rounded-2xl flex justify-between items-center border border-zinc-200">
              <span className="font-bold uppercase tracking-wide text-zinc-400 font-mono text-[10px]">Total Due (Incl. VAT)</span>
              <span className="font-mono text-base font-black text-brand-primary flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-brand-accent stroke-[2.5]" />
                R {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-650 font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-brand-primary hover:bg-zinc-850 disabled:bg-zinc-450 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" /> Save Invoice & Recalculate
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
