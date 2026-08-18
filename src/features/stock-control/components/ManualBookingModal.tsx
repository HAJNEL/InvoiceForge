import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import { useInvoices } from '../../invoices/hooks/useInvoices';

interface DraftLine {
  id: string;
  stockCode: string;
  description: string;
  qty: number;
}

function emptyLine(): DraftLine {
  return { id: Math.random().toString(36).slice(2), stockCode: '', description: '', qty: 1 };
}

export function ManualBookingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addInvoice } = useInvoices();
  const [schoolName, setSchoolName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [area, setArea] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSchoolName(''); setOrderNumber(''); setArea(''); setSchoolType('');
    setClientNumber(''); setDueDate(''); setLines([emptyLine()]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleSave = async () => {
    if (!schoolName.trim() || !orderNumber.trim()) {
      toast.error('Enter a school name and order number.');
      return;
    }
    // Blank/zero-quantity SKU rows never become order lines (spec §25).
    const validLines = lines.filter(l => l.stockCode.trim() && l.qty > 0);
    if (validLines.length === 0) {
      toast.error('Add at least one SKU with a quantity.');
      return;
    }

    setSaving(true);
    const id = await addInvoice({
      schoolName: schoolName.trim(),
      taxInvoice: orderNumber.trim(),
      district: area.trim() || 'Unassigned',
      schoolType: schoolType.trim(),
      clientNumber: clientNumber.trim(),
      dueDate: dueDate || '',
      status: 'draft',
      invoiceDate: new Date().toISOString().split('T')[0],
      line_items: validLines.map(l => ({
        stock_code: l.stockCode.trim(),
        description: l.description.trim(),
        quantity: l.qty
      }))
    });
    setSaving(false);

    if (id) {
      toast.success(`Booking created for ${schoolName}.`);
      handleClose();
    } else {
      toast.error('Unable to create booking. Please try again.');
    }
  };

  return (
    <PhaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Manual Booking"
      subtitle="Creates a new draft order"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            title="Cancel"
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save booking"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Booking'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        <input title="School name" placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
          className="col-span-2 px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
        <input title="Order number" placeholder="Order number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
          className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
        <input title="Area" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)}
          className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
        <input title="School type" placeholder="School type" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}
          className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
        <input title="Client number" placeholder="Client number" value={clientNumber} onChange={(e) => setClientNumber(e.target.value)}
          className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
        <input title="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="col-span-2 px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">SKUs & Quantities</label>
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-1.5">
            <input title="SKU" placeholder="SKU" value={line.stockCode} onChange={(e) => updateLine(line.id, { stockCode: e.target.value })}
              className="w-24 px-2.5 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
            <input title="Description" placeholder="Description" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })}
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
            <input title="Quantity" type="number" min={0} value={line.qty} onChange={(e) => updateLine(line.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
              className="w-16 px-2 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
            <button
              type="button"
              title="Remove line"
              onClick={() => setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== line.id) : prev)}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          title="Add another SKU line"
          onClick={() => setLines(prev => [...prev, emptyLine()])}
          className="flex items-center gap-1 text-[10px] font-black uppercase text-brand-accent hover:bg-brand-accent/5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Line
        </button>
      </div>
    </PhaseModal>
  );
}
