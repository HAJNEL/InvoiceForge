import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Order, OrderLineItem, OrderStatus } from '../hooks/useOrders';

interface DraftLine {
  id: string;
  stockCode: string;
  qty: number;
}

function emptyLine(): DraftLine {
  return { id: Math.random().toString(36).slice(2), stockCode: '', qty: 1 };
}

function toDraftLines(lineItems: OrderLineItem[]): DraftLine[] {
  if (lineItems.length === 0) return [emptyLine()];
  return lineItems.map(l => ({ id: Math.random().toString(36).slice(2), stockCode: l.stockCode, qty: l.qty }));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSave: (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<unknown>;
}

export function OrderFormModal({ isOpen, onClose, order, onSave }: Props) {
  const [schoolId, setSchoolId] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [area, setArea] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Active');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setSchoolId(order.schoolId);
      setClientNumber(order.clientNumber);
      setSchoolName(order.schoolName);
      setArea(order.area);
      setSchoolType(order.schoolType);
      setOrderNumber(order.orderNumber);
      setStatus(order.status);
      setLines(toDraftLines(order.lineItems));
    } else {
      setSchoolId(''); setClientNumber(''); setSchoolName(''); setArea('');
      setSchoolType(''); setOrderNumber(''); setStatus('Active'); setLines([emptyLine()]);
    }
  }, [order, isOpen]);

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleSave = async () => {
    if (!schoolName.trim()) return;
    // Blank/zero-quantity SKU rows never become order lines.
    const lineItems: OrderLineItem[] = lines
      .filter(l => l.stockCode.trim() && l.qty > 0)
      .map(l => ({ stockCode: l.stockCode.trim(), qty: l.qty }));

    setSaving(true);
    const result = await onSave({
      schoolId: schoolId.trim(),
      clientNumber: clientNumber.trim(),
      schoolName: schoolName.trim(),
      area: area.trim(),
      schoolType: schoolType.trim(),
      orderNumber: orderNumber.trim(),
      status,
      lineItems
    });
    setSaving(false);
    if (result) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
          <div>
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary">
              {order ? 'Edit Order' : 'Add Order'}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">School, area and SKU quantities</p>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 hover:bg-zinc-200 rounded-xl text-zinc-400 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <input title="School" placeholder="School" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
              className="col-span-2 px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="Order number" placeholder="Order No." value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="School ID" placeholder="School ID" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="Area" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="School type" placeholder="School Type" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="Client number" placeholder="Client Number" value={clientNumber} onChange={(e) => setClientNumber(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <select title="Status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent">
              <option value="Active">Active</option>
              <option value="Complete">Complete</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">SKUs & Quantities</label>
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-1.5">
                <input title="SKU" placeholder="SKU" value={line.stockCode} onChange={(e) => updateLine(line.id, { stockCode: e.target.value })}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
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
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save order"
            onClick={handleSave}
            disabled={saving || !schoolName.trim()}
            className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            {saving ? 'Saving…' : order ? 'Save Changes' : 'Add Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
