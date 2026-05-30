import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/utils';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Save, 
  BrainCircuit,
  FileText,
  Building2,
  User,
  Truck,
  CreditCard,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { DetailedInvoice } from '../../services/geminiService';

export function ExtractionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<DetailedInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = window.location.pathname.includes('/edit');

  useEffect(() => {
    async function fetchInvoice() {
      if (!id) return;
      try {
        const docRef = doc(db, 'invoices', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInvoice(docSnap.data() as DetailedInvoice);
        } else {
          console.error("No such invoice!");
          navigate(isEditing ? '/invoices' : '/invoices/import');
        }
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError("Failed to load invoice data.");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id, navigate, isEditing]);

  const handleSave = async (status: 'pending' | 'draft' = 'pending') => {
    if (!id || !invoice) return;
    setSaving(true);
    setError(null);
    try {
      // Check for duplicates (excluding current document)
      if (invoice.taxInvoice) {
        const q = query(
          collection(db, 'invoices'),
          where('userId', '==', auth.currentUser?.uid),
          where('taxInvoice', '==', String(invoice.taxInvoice))
        );
        const querySnapshot = await getDocs(q);
        const isDuplicate = querySnapshot.docs.some(doc => doc.id !== id);
        
        if (isDuplicate) {
          setError(`Duplicate Error: An invoice with number ${invoice.taxInvoice} already exists.`);
          setSaving(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      const docRef = doc(db, 'invoices', id);
      const currentStatus = (invoice as { status?: string }).status;
      await updateDoc(docRef, {
        ...invoice,
        status: isEditing ? currentStatus || status : status,
        updatedAt: new Date().toISOString()
      });
      navigate(isEditing ? `/invoices/${id}` : '/invoices');
    } catch (err) {
      console.error("Error updating invoice:", err);
      setError("Failed to save invoice. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof DetailedInvoice>(field: K, value: DetailedInvoice[K]) => {
    setInvoice((prev) => prev ? ({ ...prev, [field]: value }) : null);
  };

  const updateLineItems = (newItems: DetailedInvoice['lineItems']) => {
    if (!invoice) return;
    
    // Calculate new values for each item
    const itemsWithValues = newItems.map(item => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return {
        ...item,
        qty,
        unitPrice,
        disc: item.disc || 0,
        value: Number((qty * unitPrice).toFixed(2))
      };
    });

    // Calculate totals
    const subTotal = Number(itemsWithValues.reduce((sum, item) => sum + item.value, 0).toFixed(2));
    const vatAmount = Number((subTotal * 0.15).toFixed(2));
    const freight = Number(invoice.freight) || 0;
    const totalDue = Number((subTotal + vatAmount + freight).toFixed(2));

    setInvoice({
      ...invoice,
      lineItems: itemsWithValues,
      subTotal,
      vatAmount,
      totalDue
    });
  };

  const handleAddLineItem = () => {
    if (!invoice) return;
    const currentItems = invoice.lineItems || [];
    const newItem = {
      stockCode: '',
      description: '',
      qty: 1,
      unitPrice: 0,
      disc: 0,
      value: 0
    };
    updateLineItems([...currentItems, newItem]);
  };

  const handleDeleteLineItem = (indexToDelete: number) => {
    if (!invoice) return;
    const currentItems = invoice.lineItems || [];
    const newItems = currentItems.filter((_, idx) => idx !== indexToDelete);
    updateLineItems(newItems);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-pulse">
        <BrainCircuit className="w-12 h-12 text-brand-accent mb-4 animate-bounce" />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">{isEditing ? 'Loading Invoice...' : 'Loading AI Extraction...'}</p>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(isEditing ? `/invoices/${id}` : '/invoices/import')}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Invoice' : 'Review Extraction'}</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{isEditing ? 'Saved Data' : 'AI Processed'}</span>
              </div>
            </div>
            <p className="text-zinc-500 text-sm mt-1">Invoice: <strong>{invoice.taxInvoice || invoice.originalFileName}</strong></p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button 
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
            >
              Save as Draft
            </button>
          )}
          <button 
            onClick={() => handleSave(isEditing ? 'pending' : 'pending')}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            {saving ? <BrainCircuit className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Update Invoice' : 'Confirm & Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Info */}
          <div className="saas-card bg-white p-8 space-y-8">
            <div className="flex items-center gap-3 text-brand-primary">
              <FileText className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Document Header</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <ReviewField label="TAX INVOICE #" value={invoice.taxInvoice} onChange={(v) => updateField('taxInvoice', v)} />
              <ReviewField label="Invoice Date" value={invoice.invoiceDate} onChange={(v) => updateField('invoiceDate', v)} />
              <ReviewField label="Customer P/O" value={invoice.customerPO} onChange={(v) => updateField('customerPO', v)} />
              <ReviewField label="Sales Order No" value={invoice.salesOrderNo} onChange={(v) => updateField('salesOrderNo', v)} />
              <ReviewField label="Delivery Note" value={invoice.deliveryNoteNo} onChange={(v) => updateField('deliveryNoteNo', v)} />
              <ReviewField label="Account Terms" value={invoice.accountTerms} onChange={(v) => updateField('accountTerms', v)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Customer Details */}
            <div className="saas-card bg-white p-8 space-y-6">
              <div className="flex items-center gap-3 text-zinc-500">
                <User className="w-5 h-5" />
                <h3 className="font-bold text-xs uppercase tracking-widest">Customer Details</h3>
              </div>
              <div className="space-y-4">
                <ReviewField label="Customer Name" value={invoice.customerName} onChange={(v) => updateField('customerName', v)} />
                <ReviewField label="School Name" value={invoice.schoolName} onChange={(v) => updateField('schoolName', v)} />
                <ReviewField label="Street Address" value={invoice.streetAddress} onChange={(v) => updateField('streetAddress', v)} />
                <ReviewField label="Suburb" value={invoice.suburb} onChange={(v) => updateField('suburb', v)} />
                <ReviewField label="District" value={invoice.district} onChange={(v) => updateField('district', v)} />
                <ReviewField label="Customer Code" value={invoice.customerCode} onChange={(v) => updateField('customerCode', v)} />
                <ReviewField label="Address Line 1" value={invoice.customerAddressLine1} onChange={(v) => updateField('customerAddressLine1', v)} />
                <ReviewField label="Address Line 2" value={invoice.customerAddressLine2} onChange={(v) => updateField('customerAddressLine2', v)} />
                <ReviewField label="Postal Code" value={invoice.postalCode} onChange={(v) => updateField('postalCode', v)} />
                <ReviewField label="VAT No" value={invoice.vatNo} onChange={(v) => updateField('vatNo', v)} />
              </div>
            </div>

            {/* Delivery Details */}
            <div className="saas-card bg-white p-8 space-y-6">
              <div className="flex items-center gap-3 text-zinc-500">
                <Truck className="w-5 h-5" />
                <h3 className="font-bold text-xs uppercase tracking-widest">Delivery Details</h3>
              </div>
              <div className="space-y-4">
                <ReviewField label="Address Line 1" value={invoice.deliveryAddressLine1} onChange={(v) => updateField('deliveryAddressLine1', v)} />
                <ReviewField label="Address Line 2" value={invoice.deliveryAddressLine2} onChange={(v) => updateField('deliveryAddressLine2', v)} />
                <ReviewField label="Region" value={invoice.deliveryRegion} onChange={(v) => updateField('deliveryRegion', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Totals & Company Info */}
        <div className="space-y-8">
          <div className="saas-card bg-zinc-900 text-white p-8 space-y-8">
            <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-500">Totals</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400 font-medium">Sub Total</span>
                <span className="font-bold font-mono whitespace-nowrap">{formatCurrency(invoice.subTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400 font-medium">VAT (15%)</span>
                <span className="font-bold font-mono whitespace-nowrap">{formatCurrency(invoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-amber-500">
                <span className="font-medium">Freight</span>
                <span className="font-bold font-mono whitespace-nowrap">{formatCurrency(invoice.freight)}</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-black border-t border-zinc-800 pt-6">
                <span className="uppercase tracking-tighter">Total Due</span>
                <span className="text-brand-accent font-mono whitespace-nowrap">{formatCurrency(invoice.totalDue)}</span>
              </div>
            </div>
          </div>

          <div className="saas-card bg-white p-8 space-y-6">
            <div className="flex items-center gap-3 text-zinc-500">
              <Building2 className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Company Info</h3>
            </div>
            <div className="space-y-4">
              <ReviewField label="Company Name" value={invoice.companyName} onChange={(v) => updateField('companyName', v)} />
              <ReviewField label="Registration #" value={invoice.registrationNo} onChange={(v) => updateField('registrationNo', v)} />
              <ReviewField label="Company VAT #" value={invoice.companyVatNo} onChange={(v) => updateField('companyVatNo', v)} />
              <ReviewField label="Email" value={invoice.email} onChange={(v) => updateField('email', v)} />
            </div>
          </div>

          <div className="saas-card bg-zinc-50 border-zinc-100 p-8 space-y-6">
            <div className="flex items-center gap-3 text-zinc-500">
              <CreditCard className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Banking Details</h3>
            </div>
            <div className="space-y-4">
              <ReviewField label="Bank Name" value={invoice.bankName} onChange={(v) => updateField('bankName', v)} />
              <ReviewField label="Account" value={invoice.account} onChange={(v) => updateField('account', v)} />
              <ReviewField label="SWIFT" value={invoice.swift} onChange={(v) => updateField('swift', v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items - FULL WIDTH */}
      <div className="saas-card bg-white p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-zinc-500">
            <div className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 shadow-sm text-brand-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 leading-tight">Line Items</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Please check and verify all extracted items</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-zinc-50 text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-100 rounded-lg select-none">
            {invoice.lineItems?.length || 0} items extracted
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 italic font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="px-4 pb-4 font-semibold text-left w-[18%]">Stock Code</th>
                <th className="px-4 pb-4 font-semibold text-left w-[42%]">Description</th>
                <th className="px-4 pb-4 font-semibold text-right w-[12%]">Qty</th>
                <th className="px-4 pb-4 font-semibold text-right w-[14%]">Price</th>
                <th className="px-4 pb-4 font-semibold text-right w-[14%]">Value</th>
                <th className="px-4 pb-4 font-semibold text-center w-[10%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm font-bold text-zinc-400 uppercase tracking-tight">
                    No line items found. Click add to create one.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((item, idx: number) => (
                  <tr key={idx} className="group hover:bg-zinc-50/40 transition-colors">
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={item.stockCode || ''} 
                        onChange={(e) => {
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], stockCode: e.target.value };
                          updateLineItems(newItems);
                        }}
                        placeholder="STOCK CODE"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-mono transition-all focus:outline-none"
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={item.description || ''}
                        onChange={(e) => {
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], description: e.target.value };
                          updateLineItems(newItems);
                        }}
                        placeholder="Item Description"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm transition-all focus:outline-none"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <input 
                        type="number" 
                        step="any"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], qty: val === '' ? 0 : parseFloat(val) };
                          updateLineItems(newItems);
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-semibold font-mono text-right focus:outline-none transition-all"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
                        <input 
                          type="number" 
                          step="any"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newItems = [...invoice.lineItems];
                            newItems[idx] = { ...newItems[idx], unitPrice: val === '' ? 0 : parseFloat(val) };
                            updateLineItems(newItems);
                          }}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-semibold font-mono text-right focus:outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-black font-mono text-zinc-900 pr-2">
                        {formatCurrency(item.value)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLineItem(idx)}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all inline-flex items-center justify-center border border-red-100"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 group">
      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-brand-accent transition-colors">{label}</label>
      <input 
        type="text" 
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
      />
    </div>
  );
}

