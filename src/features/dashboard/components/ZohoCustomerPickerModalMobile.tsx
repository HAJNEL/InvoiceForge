import { useMemo, useState } from 'react';
import { Search, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ZohoContactSummary } from '../../../lib/zoho';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

export function ZohoCustomerPickerModalMobile({
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
    <MobileSheet
      isOpen
      onClose={onCancel}
      title="Link to Zoho Customer"
      subtitle="Choose who this invoice belongs to"
      headerLeft={<Building2 className="w-5 h-5 text-brand-primary shrink-0" />}
      fullHeight={false}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            title="Cancel without linking to Zoho"
            onClick={onCancel}
            className="px-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600 mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            title={selected ? `Link this invoice to ${selected.name}` : 'Select a customer first'}
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || busy}
            className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mobile-tap-target"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Link Invoice
          </button>
        </div>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          title="Search customers"
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-xs text-zinc-400 py-10">No customers match your search.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              title={`Link this invoice to ${c.name}`}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-left text-sm transition-all mobile-tap-target",
                selectedId === c.id ? "bg-brand-primary/5 text-brand-primary font-bold" : "hover:bg-zinc-50 text-zinc-700"
              )}
            >
              <span className="truncate">{c.name}</span>
              {selectedId === c.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </MobileSheet>
  );
}
