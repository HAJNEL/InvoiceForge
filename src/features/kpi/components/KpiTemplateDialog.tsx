import { useState, useMemo, useEffect } from 'react';
import { X, Search, Loader2, Check, RefreshCw, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { Product } from '../../products/hooks/useProducts';
import { KpiTemplateKind } from '../hooks/useKpiTemplates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kind: KpiTemplateKind;
  products: Product[];
  selectedIds: string[];
  onSave: (kind: KpiTemplateKind, productIds: string[]) => Promise<boolean>;
}

export function KpiTemplateDialog({ isOpen, onClose, kind, products, selectedIds, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(selectedIds));
      setSearchQuery('');
    }
  }, [isOpen, selectedIds]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      p.stockCode.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const syncAll = () => {
    setSelected(new Set(products.map(p => p.id)));
    toast.success('All Products Synced', {
      description: `${products.length} product${products.length !== 1 ? 's' : ''} added to the template.`
    });
  };

  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSave(kind, Array.from(selected));
    setIsSaving(false);
    if (ok) {
      toast.success('Template Saved', {
        description: `${selected.size} KPI product${selected.size !== 1 ? 's' : ''} saved.`
      });
      onClose();
    } else {
      toast.error('Save Failed', { description: 'Could not save the KPI template.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent shrink-0 mt-0.5">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                  {kind === 'employee' ? 'Employees' : 'Trucks'} KPI Template
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Tick the products to track, or sync all products at once.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} title="Close"
              className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search + Sync all */}
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products by code or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} title="Clear search"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button type="button" onClick={syncAll} title="Sync all products to this template"
              className="flex items-center gap-1.5 px-3 py-2.5 border border-brand-accent/30 bg-brand-accent/5 hover:bg-brand-accent/10 text-brand-accent font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap">
              <RefreshCw className="w-3.5 h-3.5" />
              Sync All
            </button>
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-zinc-400">
              {products.length === 0
                ? 'No products found. Add products first on the Products screen.'
                : <>No products match "<strong>{searchQuery}</strong>"</>}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map(p => {
                const isChecked = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => toggle(p.id)}
                      title={isChecked ? `Remove ${p.stockCode} from template` : `Add ${p.stockCode} to template`}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3 border',
                        isChecked ? 'bg-brand-accent/5 border-brand-accent/30' : 'bg-white border-transparent hover:bg-zinc-50'
                      )}>
                      <span className={cn(
                        'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                        isChecked ? 'bg-brand-accent border-brand-accent text-white' : 'border-zinc-300 bg-white'
                      )}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                      <span className="font-mono text-[10px] font-black text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-lg shrink-0 whitespace-nowrap">
                        {p.stockCode}
                      </span>
                      <span className="flex-1 text-xs font-semibold text-zinc-800 truncate min-w-0">
                        {p.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-zinc-400 font-medium">
              {selected.size} of {products.length} selected
            </p>
            {selected.size > 0 && (
              <button type="button" onClick={clearAll} title="Deselect all products"
                className="text-[11px] font-bold text-zinc-400 hover:text-red-500 uppercase tracking-wider cursor-pointer">
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} title="Cancel"
              className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} title="Save template"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50">
              {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5 stroke-[3]" />}
              Save Template
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
