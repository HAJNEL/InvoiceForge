import { useMemo, useState } from 'react';
import { X, Search, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ZohoContactSummary } from '../../../lib/zoho';

// Shown on Complete when a self-invoice's Zoho Books org has more than one
// customer - the user must say which existing Zoho contact this invoice gets
// linked to, since a bundle can span multiple underlying clients/schools and
// there's no reliable way to infer the billing entity from that.
export function ZohoCustomerPickerModal({
  contacts,
  busy,
  onConfirm,
  onCancel,
}: {
  contacts: ZohoContactSummary[];
  busy: boolean;
  onConfirm: (contact: ZohoContactSummary) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => c.name.toLowerCase().includes(q));
  }, [contacts, search]);

  const selected = contacts.find(c => c.id === selectedId) || null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm" onClick={onCancel}></div>

      <div className="bg-white rounded-2xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-brand-primary" />
              Link to Zoho Customer
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
              Choose who this invoice belongs to
            </p>
          </div>
          <button onClick={onCancel} title="Cancel" className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-zinc-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-zinc-400 py-10">No customers match your search.</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                title={`Link this invoice to ${c.name}`}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-left text-sm transition-all",
                  selectedId === c.id ? "bg-brand-primary/5 text-brand-primary font-bold" : "hover:bg-zinc-50 text-zinc-700"
                )}
              >
                <span className="truncate">{c.name}</span>
                {selectedId === c.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            title="Cancel without linking to Zoho"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            title={selected ? `Link this invoice to ${selected.name}` : 'Select a customer first'}
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || busy}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Link Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
