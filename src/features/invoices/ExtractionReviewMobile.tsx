/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CheckCircle2,
  ArrowLeft,
  Save,
  BrainCircuit,
  FileText,
  User,
  Truck,
  AlertCircle,
  Plus
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { DetailedInvoice } from '../../services/geminiService';
import { GoogleMapsAutocomplete } from '../../components/GoogleMapsAutocomplete';
import { MobileLineItemEditRow } from '../../components/mobile/MobileLineItemRow';

interface ExtractionReviewMobileProps {
  invoice: DetailedInvoice;
  isEditing: boolean;
  saving: boolean;
  error: string | null;
  hasValidMapsKey: boolean;
  updateField: <K extends keyof DetailedInvoice>(field: K, value: DetailedInvoice[K]) => void;
  updateLineItems: (newItems: DetailedInvoice['lineItems']) => void;
  handleAddLineItem: () => void;
  handleDeleteLineItem: (index: number) => void;
  handleSave: (status?: 'pending' | 'draft') => void;
  onBack: () => void;
}

export function ExtractionReviewMobile({
  invoice,
  isEditing,
  saving,
  error,
  hasValidMapsKey,
  updateField,
  updateLineItems,
  handleAddLineItem,
  handleDeleteLineItem,
  handleSave,
  onBack
}: ExtractionReviewMobileProps) {
  const lineItems = invoice.lineItems || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          title="Back"
          className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-500 shrink-0 mobile-tap-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold tracking-tight truncate">{isEditing ? 'Edit Invoice' : 'Review Extraction'}</h1>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-wider">{isEditing ? 'Saved' : 'AI Processed'}</span>
            </div>
          </div>
          <p className="text-zinc-500 text-xs mt-0.5 truncate">
            Invoice: <strong>{invoice.taxInvoice || invoice.originalFileName}</strong>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Document Header */}
      <div className="saas-card bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 text-brand-primary">
          <FileText className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-widest">Document Header</h3>
        </div>
        <div className="space-y-3">
          <ReviewField label="TAX INVOICE #" value={invoice.taxInvoice} onChange={(v) => updateField('taxInvoice', v)} />
          <ReviewField label="Invoice Date" value={invoice.invoiceDate} onChange={(v) => updateField('invoiceDate', v)} />
          <ReviewField label="Customer P/O" value={invoice.customerPO} onChange={(v) => updateField('customerPO', v)} />
          <ReviewField label="Sales Order No" value={invoice.salesOrderNo} onChange={(v) => updateField('salesOrderNo', v)} />
          <ReviewField label="Delivery Note" value={invoice.deliveryNoteNo} onChange={(v) => updateField('deliveryNoteNo', v)} />
          <ReviewField label="Customer Contact" value={invoice.customerContact || ''} onChange={(v) => updateField('customerContact', v)} />
        </div>
      </div>

      {/* Shipping Details */}
      <div className="saas-card bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 text-brand-primary">
          <Truck className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-widest">Shipping Details</h3>
        </div>
        <div className="space-y-3">
          <ReviewField label="Shipping Name" value={invoice.deliveryCustomerName || ''} onChange={(v) => updateField('deliveryCustomerName', v)} />
          <ReviewField label="School Name" value={invoice.schoolName || ''} onChange={(v) => updateField('schoolName', v)} />
          {hasValidMapsKey ? (
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Street Address</label>
              <GoogleMapsAutocomplete
                value={invoice.deliveryAddressLine1 || ''}
                onChange={(v) => updateField('deliveryAddressLine1', v)}
                placeholder="Search delivery address..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
              />
            </div>
          ) : (
            <ReviewField label="Street Address" value={invoice.deliveryAddressLine1 || ''} onChange={(v) => updateField('deliveryAddressLine1', v)} />
          )}
          <ReviewField label="City" value={invoice.deliveryAddressLine2 || ''} onChange={(v) => updateField('deliveryAddressLine2', v)} />
          <ReviewField label="Region" value={invoice.deliveryRegion || ''} onChange={(v) => updateField('deliveryRegion', v)} />
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Delivery Address</label>
            {hasValidMapsKey ? (
              <GoogleMapsAutocomplete
                value={invoice.deliveryAddress || ''}
                onChange={(v) => updateField('deliveryAddress', v)}
                placeholder="Search the delivery address on Google Maps..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
              />
            ) : (
              <input
                aria-label="Delivery Address"
                title="The exact location used for this invoice's map pin. Auto-filled from the Google Maps school lookup; edit to move the pin."
                type="text"
                value={invoice.deliveryAddress || ''}
                onChange={(v) => updateField('deliveryAddress', v.target.value)}
                placeholder="Auto-filled from the Google Maps school lookup on save"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
              />
            )}
            <p className="text-[10px] text-zinc-400">This is the actual location used for the map pin. Leave blank to use the looked-up school address; type an address here to override where the pin is placed.</p>
          </div>
        </div>
      </div>

      {/* Bill To Details */}
      <div className="saas-card bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 text-brand-primary">
          <User className="w-4 h-4" />
          <h3 className="font-bold text-xs uppercase tracking-widest">Bill To Details</h3>
        </div>
        <ReviewField label="Billing Name" value={invoice.customerName} onChange={(v) => updateField('customerName', v)} />
      </div>

      {/* Invoice Summary */}
      <div className="saas-card bg-white p-4 space-y-4">
        <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-400">Invoice Summary</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm border-b border-zinc-100 pb-3">
            <span className="text-zinc-500 font-medium font-sans uppercase text-[10px] tracking-wider">Sub Total</span>
            <span className="font-extrabold font-mono text-zinc-900 text-sm">{formatCurrency(invoice.subTotal)}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">VAT Rate</label>
            <div className="flex gap-2">
              <input
                type="text"
                title="VAT rate"
                value={invoice.vatRate || '15%'}
                onChange={(e) => {
                  updateField('vatRate', e.target.value);
                  setTimeout(() => updateLineItems(invoice.lineItems), 0);
                }}
                className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                placeholder="15%"
              />
              <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-sm font-bold font-mono text-zinc-600 whitespace-nowrap flex items-center justify-center">
                {formatCurrency(invoice.vatAmount)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Freight Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
              <input
                type="number"
                step="any"
                title="Freight amount"
                value={invoice.freight === 0 ? '' : invoice.freight}
                onChange={(e) => {
                  const val = e.target.value;
                  const fVal = val === '' ? 0 : parseFloat(val);
                  updateField('freight', fVal);
                  setTimeout(() => updateLineItems(invoice.lineItems), 0);
                }}
                className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Amount Incl. of VAT</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
              <input
                type="number"
                step="any"
                title="Amount including VAT"
                value={invoice.amountIncl === 0 ? '' : invoice.amountIncl}
                onChange={(e) => {
                  const val = e.target.value;
                  const aVal = val === '' ? 0 : parseFloat(val);
                  updateField('amountIncl', aVal);
                }}
                className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-lg font-black border-t border-zinc-100 pt-4 mt-2">
            <span className="uppercase tracking-tighter text-zinc-500 text-xs">Total Due</span>
            <span className="text-brand-primary font-bold font-mono text-lg">{formatCurrency(invoice.totalDue)}</span>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="saas-card bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 text-brand-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-zinc-900 leading-tight">Line Items</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">Check and verify all extracted items</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-zinc-50 text-[9px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-100 rounded-lg select-none shrink-0">
            {lineItems.length} items
          </span>
        </div>

        {lineItems.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-zinc-400 uppercase tracking-tight">
            No line items found. Tap add to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <MobileLineItemEditRow
                key={idx}
                item={item}
                onChange={(patch) => {
                  const newItems = [...lineItems];
                  newItems[idx] = { ...newItems[idx], ...patch } as any;
                  updateLineItems(newItems);
                }}
                onRemove={() => handleDeleteLineItem(idx)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddLineItem}
          title="Add line item"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary/5 text-brand-primary border border-brand-primary/10 rounded-xl text-xs font-bold uppercase tracking-wider mobile-tap-target"
        >
          <Plus className="w-4 h-4" />
          Add Line Item
        </button>
      </div>

      {/* Sticky footer actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t border-zinc-100 flex items-center gap-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {!isEditing && (
          <button
            disabled={saving}
            onClick={() => handleSave('draft')}
            title="Save as draft"
            className="flex-1 px-4 py-3 text-sm font-semibold text-zinc-500 border border-zinc-200 rounded-xl disabled:opacity-50 mobile-tap-target"
          >
            Save Draft
          </button>
        )}
        <button
          onClick={() => handleSave('pending')}
          disabled={saving}
          title={isEditing ? 'Update invoice' : 'Confirm and save'}
          className="flex-[2] inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold tracking-widest uppercase shadow-lg shadow-zinc-200 disabled:opacity-50 mobile-tap-target"
        >
          {saving ? <BrainCircuit className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Update' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  );
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400">{label}</label>
      <input
        aria-label={label}
        title={label}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
      />
    </div>
  );
}
