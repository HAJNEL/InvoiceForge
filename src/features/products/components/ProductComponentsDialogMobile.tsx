import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Trash2, Layers, ShoppingBag, Link2, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { Product, ProductComponent } from '../hooks/useProducts';
import { KnockdownItem } from '../../stock/hooks/useStock';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  knockdownItems: KnockdownItem[];
  consumableItems: (KnockdownItem | Product)[];
  onSave: (productId: string, components: ProductComponent[]) => Promise<boolean>;
}

type SearchResultItem = {
  id: string;
  stockCode: string;
  description: string;
  type: 'knockdown' | 'consumable';
};

const TYPE_CONFIG = {
  knockdown: {
    label: 'Knockdown',
    icon: Layers,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  consumable: {
    label: 'Consumable',
    icon: ShoppingBag,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
} as const;

export function ProductComponentsDialogMobile({
  isOpen, onClose, product, knockdownItems, consumableItems, onSave,
}: Props) {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setComponents(product.components ? [...product.components] : []);
      setSearchQuery('');
      setShowResults(false);
    }
  }, [isOpen, product]);

  const catalog = useMemo((): SearchResultItem[] => {
    const items: SearchResultItem[] = [];
    knockdownItems.forEach(k => items.push({
      id: k.id,
      stockCode: k.stockCode,
      description: k.displayName || k.description,
      type: 'knockdown',
    }));
    consumableItems.forEach(c => {
      const id = (c as KnockdownItem).id ?? (c as Product).id;
      const desc = (c as KnockdownItem).displayName ?? (c as Product).description;
      items.push({ id, stockCode: c.stockCode, description: desc, type: 'consumable' });
    });
    return items;
  }, [knockdownItems, consumableItems]);

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const linkedIds = new Set(components.map(c => c.id));
    const unlinked = catalog.filter(item => !linkedIds.has(item.id));

    if (!q) {
      return [
        ...unlinked.filter(i => i.type === 'knockdown'),
        ...unlinked.filter(i => i.type === 'consumable'),
      ].slice(0, 12);
    }

    return unlinked
      .filter(item =>
        item.stockCode.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, catalog, components]);

  const addComponent = (item: SearchResultItem) => {
    setComponents(prev => [...prev, { ...item, qtyPerUnit: 1 }]);
    setSearchQuery('');
    setShowResults(false);
    searchRef.current?.focus();
  };

  const removeComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
  };

  const updateQty = (id: string, value: string) => {
    const qty = Math.max(1, parseFloat(value) || 1);
    setComponents(prev => prev.map(c => c.id === id ? { ...c, qtyPerUnit: qty } : c));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSave(product.id, components);
    setIsSaving(false);
    if (ok) {
      toast.success('Components Saved', {
        description: `${components.length} component${components.length !== 1 ? 's' : ''} linked to ${product.stockCode}.`,
      });
      onClose();
    } else {
      toast.error('Save Failed', { description: 'Could not update product components.' });
    }
  };

  const knockdownLinked = components.filter(c => c.type === 'knockdown');
  const consumableLinked = components.filter(c => c.type === 'consumable');

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Link Components"
      subtitle={`${product.stockCode} · ${product.description}`}
      headerLeft={
        <div className="p-2 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent shrink-0">
          <Link2 className="w-4 h-4" />
        </div>
      }
      footer={
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-400 font-medium text-center">
            {components.length === 0
              ? 'No components linked'
              : `${knockdownLinked.length} knockdown · ${consumableLinked.length} consumable`}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              title="Cancel"
              className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all mobile-tap-target"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              title="Save components"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm disabled:opacity-50 mobile-tap-target"
            >
              {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5 stroke-[3]" />
              }
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search parts or consumables to link…"
            title="Search components"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="w-full pl-10 pr-9 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all"
          />
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(''); setShowResults(false); }}
              title="Clear search" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 mobile-tap-target">
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {showResults && (
            <div className="mt-2 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              {searchResults.length > 0 ? (
                <ul className="divide-y divide-zinc-100 max-h-56 overflow-y-auto py-1">
                  {searchResults.map(item => {
                    const cfg = TYPE_CONFIG[item.type];
                    const Icon = cfg.icon;
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => addComponent(item)}
                          title={`Link ${item.description}`}
                          className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3 mobile-tap-target">
                          <div className={cn('p-1.5 rounded-lg border shrink-0', cfg.badgeClass)}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-800 truncate">{item.description}</p>
                            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{item.stockCode}</p>
                          </div>
                          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0', cfg.badgeClass)}>
                            {cfg.label}
                          </span>
                          <Plus className="w-4 h-4 text-zinc-300 shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-5 text-center text-xs text-zinc-400">
                  {searchQuery.trim()
                    ? <>No unlinked items match "<strong>{searchQuery}</strong>"</>
                    : 'All available items are already linked'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Component list */}
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4">
              <Link2 className="w-6 h-6 text-zinc-300" />
            </div>
            <p className="text-sm font-black text-zinc-400 uppercase tracking-wide">No Components Linked</p>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
              Use the search above to find knockdown parts and consumables, then set the qty required per unit.
            </p>
          </div>
        ) : (
          <>
            {knockdownLinked.length > 0 && (
              <ComponentSection
                title="Knockdown Parts"
                icon={Layers}
                badgeClass="bg-purple-50 text-purple-700 border-purple-200"
                items={knockdownLinked}
                onQtyChange={updateQty}
                onRemove={removeComponent}
              />
            )}

            {consumableLinked.length > 0 && (
              <ComponentSection
                title="Consumables"
                icon={ShoppingBag}
                badgeClass="bg-amber-50 text-amber-700 border-amber-200"
                items={consumableLinked}
                onQtyChange={updateQty}
                onRemove={removeComponent}
              />
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ElementType;
  badgeClass: string;
  items: ProductComponent[];
  onQtyChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}

function ComponentSection({ title, icon: Icon, badgeClass, items, onQtyChange, onRemove }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-1 rounded-lg border', badgeClass)}>
          <Icon className="w-3 h-3" />
        </div>
        <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{title}</h3>
        <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full border', badgeClass)}>
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[10px] font-black text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-lg whitespace-nowrap inline-block">
                  {item.stockCode}
                </span>
                <p className="text-xs font-semibold text-zinc-800 mt-1.5">
                  {item.description}
                </p>
              </div>
              <button type="button" onClick={() => onRemove(item.id)} title="Remove component"
                className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg transition-colors mobile-tap-target shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                Qty / unit
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={item.qtyPerUnit}
                onChange={(e) => onQtyChange(item.id, e.target.value)}
                title="Quantity per unit"
                className="w-20 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-zinc-50 tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
