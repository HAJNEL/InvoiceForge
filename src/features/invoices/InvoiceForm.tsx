import { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  User,
  Calendar,
  Hash
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useInvoices } from './hooks/useInvoices';

export function InvoiceForm() {
  const navigate = useNavigate();
  const { addInvoice } = useInvoices();
  const [lineItems, setLineItems] = useState([
    { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Math.random().toString(36).substr(2, 9), 
      description: '', 
      quantity: 1, 
      unitPrice: 0, 
      amount: 0 
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: string, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = (updated.quantity as number) * (updated.unitPrice as number);
        }
        return updated;
      }
      return item;
    }));
  };

  const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const id = await addInvoice({
        taxInvoice: invoiceNumber,
        invoiceDate: issueDate,
        dueDate,
        deliveryAddress: billingAddress,
        notes,
        subTotal: subtotal,
        line_items: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_item_value: item.amount,
        })),
      });
      if (id) {
        toast.success('Invoice saved', { description: 'The invoice was created successfully.' });
        navigate('/invoices');
      } else {
        toast.error('Failed to save invoice', { description: 'Please try again.' });
      }
    } catch (err) {
      console.error('Save invoice error:', err);
      toast.error('Failed to save invoice', { description: 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/invoices"
            aria-label="Back to invoices"
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Invoice</h1>
            <p className="text-zinc-500 text-sm mt-1">Manually enter invoice details or use AI extraction.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
            onClick={() => navigate('/invoices')}
          >
            Discard
          </button>
          <button
            type="submit"
            form="invoice-form"
            title="Save Invoice"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Invoice'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form id="invoice-form" className="lg:col-span-2 space-y-8" onSubmit={handleSaveInvoice}>
          {/* Main Info */}
          <div className="saas-card p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invoice Details</label>
                <div className="space-y-4">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Invoice Number (e.g. INV-1001)"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="date"
                      aria-label="Issue Date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="date"
                      aria-label="Due Date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Client Selection</label>
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <select title='client' className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all appearance-none cursor-pointer">
                      <option value="">Select a Client</option>
                      <option value="plus">+ Add New Client</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Billing Address (Auto-filled if client selected)"
                    rows={3}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Line Items</label>
              <div className="space-y-3">
                <table className="w-full">
                   <thead>
                     <tr className="italic font-mono text-[10px] uppercase tracking-wider text-zinc-400 text-left border-b border-zinc-100">
                        <th className="pb-2 font-normal">Description</th>
                        <th className="pb-2 font-normal w-24 text-right">Qty</th>
                        <th className="pb-2 font-normal w-32 text-right">Price</th>
                        <th className="pb-2 font-normal w-32 text-right">Amount</th>
                        <th className="pb-2 font-normal w-12 text-right"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-50">
                     {lineItems.map((item) => (
                       <tr key={item.id}>
                         <td className="py-3">
                           <input 
                             type="text" 
                             value={item.description}
                             onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                             placeholder="Item name or description"
                             className="w-full px-2 py-2 bg-transparent border-none text-sm focus:outline-none placeholder:italic placeholder:text-zinc-300"
                           />
                         </td>
                         <td className="py-3">
                           <input 
                           placeholder='qty'
                             type="number" 
                             value={item.quantity}
                             onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value))}
                             className="w-full px-2 py-2 bg-transparent border-none text-sm text-right focus:outline-none font-mono"
                           />
                         </td>
                         <td className="py-3">
                           <input 
                            placeholder='number'
                             type="number" 
                             value={item.unitPrice}
                             onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value))}
                             className="w-full px-2 py-2 bg-transparent border-none text-sm text-right focus:outline-none font-mono"
                           />
                         </td>
                         <td className="py-3 text-right text-sm font-bold tabular-nums">
                           R {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </td>
                         <td className="py-3 text-right">
                           <button 
                             title='item'
                             type="button"
                             onClick={() => removeLineItem(item.id)}
                             className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
                <button 
                  type="button"
                  onClick={addLineItem}
                  className="w-full py-3 border-2 border-dashed border-zinc-100 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-400 hover:border-brand-accent hover:text-brand-accent transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Line Item
                </button>
              </div>
            </div>
          </div>

          <div className="saas-card p-8">
             <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Additional Notes</label>
             <textarea
               placeholder="Terms, payment instructions, or personal note to client..."
               rows={4}
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
             ></textarea>
          </div>
        </form>

        <div className="space-y-8">
           <div className="saas-card p-6 bg-brand-primary text-white sticky top-24">
              <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-400 mb-6">Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm opacity-70 font-medium">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-mono">R {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm opacity-70 font-medium">
                  <span>Tax (0%)</span>
                  <span className="tabular-nums font-mono">R 0.00</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between">
                  <span className="text-sm font-bold uppercase tracking-widest">Total Amount</span>
                  <span className="text-2xl font-black tabular-nums">R {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              
              <div className="mt-8 space-y-3">
                 <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    <span>Currency</span>
                    <span className="text-white">ZAR (R)</span>
                 </div>
                 <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    <span>Default Status</span>
                    <span className="text-white">Draft</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
