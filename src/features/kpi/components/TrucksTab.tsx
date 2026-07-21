import { useState, useMemo, useEffect } from 'react';
import { ClipboardList, Loader2, Check, Truck as TruckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { Product } from '../../products/hooks/useProducts';
import { useTrucks } from '../../trucks/hooks/useTrucks';
import { KpiTemplateKind } from '../hooks/useKpiTemplates';
import { useKpiTruckCapacity, CapacityGrid } from '../hooks/useKpiTruckCapacity';
import { KpiTemplateDialog } from './KpiTemplateDialog';

interface Props {
  products: Product[]; // all products
  templateProductIds: string[];
  onSaveTemplate: (kind: KpiTemplateKind, productIds: string[]) => Promise<boolean>;
  isMobile?: boolean;
}

// Local editable state: capacities[productId][truckId] = input string
type GridState = Record<string, Record<string, string>>;

export function TrucksTab({ products, templateProductIds, onSaveTemplate, isMobile }: Props) {
  const { trucks, loading: trucksLoading } = useTrucks();
  const { capacityDoc, loading: capacityLoading, saveCapacities } = useKpiTruckCapacity();
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [grid, setGrid] = useState<GridState>({});
  const [isDirty, setDirty] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const templateProducts = useMemo(
    () => products.filter(p => templateProductIds.includes(p.id)),
    [products, templateProductIds]
  );

  const activeTrucks = useMemo(
    () => trucks.filter(t => (t.status ?? 'Active') === 'Active'),
    [trucks]
  );

  // Initialise the grid from the saved doc whenever it changes (unless mid-edit)
  useEffect(() => {
    if (isDirty) return;
    const next: GridState = {};
    templateProducts.forEach(p => {
      next[p.id] = {};
      activeTrucks.forEach(t => {
        const v = capacityDoc?.capacities?.[p.id]?.[t.id];
        next[p.id][t.id] = typeof v === 'number' ? String(v) : '';
      });
    });
    setGrid(next);
  }, [capacityDoc, templateProducts, activeTrucks, isDirty]);

  const setCell = (productId: string, truckId: string, value: string) => {
    setDirty(true);
    setGrid(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [truckId]: value }
    }));
  };

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    activeTrucks.forEach(truck => {
      t[truck.id] = templateProducts.reduce((sum, p) => {
        const n = parseFloat(grid[p.id]?.[truck.id] ?? '');
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
    });
    return t;
  }, [grid, activeTrucks, templateProducts]);

  const handleSave = async () => {
    setSaving(true);
    const capacities: CapacityGrid = { ...(capacityDoc?.capacities ?? {}) };
    templateProducts.forEach(p => {
      capacities[p.id] = { ...(capacities[p.id] ?? {}) };
      activeTrucks.forEach(t => {
        const n = parseFloat(grid[p.id]?.[t.id] ?? '');
        capacities[p.id][t.id] = Number.isFinite(n) && n >= 0 ? n : null;
      });
    });
    const ok = await saveCapacities(capacities);
    setSaving(false);
    if (ok) {
      setDirty(false);
      toast.success('Capacities Saved', { description: 'Truck max capacities updated.' });
    } else {
      toast.error('Save Failed', { description: 'Could not save truck capacities.' });
    }
  };

  const loading = trucksLoading || capacityLoading;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Truck Max Capacity Per Product</h2>
          <p className="text-[11px] text-zinc-500">
            Enter the maximum number of units that fit on each truck for each product.
            {isDirty && <span className="text-amber-600 font-bold"> · Unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTemplateOpen(true)} title="Edit the KPI product template"
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
            <ClipboardList className="w-3.5 h-3.5" />
            Edit Template
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !isDirty}
            title={isDirty ? 'Save truck capacities' : 'No changes to save'}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
            Save
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
        </div>
      ) : templateProducts.length === 0 ? (
        <EmptyState onSetup={() => setTemplateOpen(true)} />
      ) : activeTrucks.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4">
            <TruckIcon className="w-6 h-6 text-zinc-300" />
          </div>
          <p className="text-sm font-black text-zinc-400 uppercase tracking-wide">No Active Trucks</p>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
            Add trucks (with status Active) on the Trucks screen — each active truck becomes a column here.
          </p>
        </div>
      ) : isMobile ? (
        <MobileCapacityCards
          products={templateProducts}
          trucks={activeTrucks}
          grid={grid}
          setCell={setCell}
          totals={totals}
        />
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 480 + activeTrucks.length * 110 }}>
              <thead className="bg-brand-primary text-white">
                <tr>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">Product Code</th>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-wider">Product Name</th>
                  {activeTrucks.map(t => (
                    <th key={t.id} className="px-2 py-3 text-[9px] font-black uppercase tracking-wider whitespace-nowrap text-center">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {templateProducts.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2 font-mono text-[10px] font-black text-zinc-600 whitespace-nowrap">{p.stockCode}</td>
                    <td className="px-4 py-2 font-semibold text-zinc-800">{p.description}</td>
                    {activeTrucks.map(t => (
                      <td key={t.id} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={grid[p.id]?.[t.id] ?? ''}
                          onChange={(e) => setCell(p.id, t.id, e.target.value)}
                          title={`Max units of ${p.stockCode} on ${t.name}`}
                          placeholder="—"
                          className="w-20 px-1.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-amber-50/60 tabular-nums"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-100 border-t-2 border-zinc-200">
                  <td colSpan={2} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-zinc-600">
                    Total Capacity (all products)
                  </td>
                  {activeTrucks.map(t => (
                    <td key={t.id} className="px-2 py-3 text-center font-black text-brand-primary tabular-nums">
                      {totals[t.id] ?? 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <KpiTemplateDialog
        isOpen={isTemplateOpen}
        onClose={() => setTemplateOpen(false)}
        kind="truck"
        products={products}
        selectedIds={templateProductIds}
        onSave={onSaveTemplate}
      />
    </div>
  );
}

function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4">
        <ClipboardList className="w-6 h-6 text-zinc-300" />
      </div>
      <p className="text-sm font-black text-zinc-400 uppercase tracking-wide">No KPI Products Selected</p>
      <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
        Choose which products to include in the capacity report — sync all products or pick them manually.
      </p>
      <button type="button" onClick={onSetup} title="Set up the KPI product template"
        className="mt-5 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer">
        Set Up Template
      </button>
    </div>
  );
}

interface MobileProps {
  products: Product[];
  trucks: { id: string; name: string }[];
  grid: GridState;
  setCell: (productId: string, truckId: string, value: string) => void;
  totals: Record<string, number>;
}

function MobileCapacityCards({ products, trucks, grid, setCell, totals }: MobileProps) {
  return (
    <div className="space-y-3">
      {products.map(p => (
        <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
          <p className="font-mono text-[10px] font-black text-zinc-500">{p.stockCode}</p>
          <p className="text-xs font-semibold text-zinc-800 mb-3">{p.description}</p>
          <div className={cn('grid gap-2', trucks.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
            {trucks.map(t => (
              <div key={t.id}>
                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-400 block mb-0.5 truncate">{t.name}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={grid[p.id]?.[t.id] ?? ''}
                  onChange={(e) => setCell(p.id, t.id, e.target.value)}
                  title={`Max units of ${p.stockCode} on ${t.name}`}
                  placeholder="—"
                  className="w-full px-2 py-2 border border-zinc-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-amber-50/60 tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="bg-zinc-100 rounded-2xl border border-zinc-200 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-2">Total Capacity (all products)</p>
        <div className={cn('grid gap-2', trucks.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
          {trucks.map(t => (
            <div key={t.id} className="bg-white rounded-lg border border-zinc-200 px-2 py-1.5 text-center">
              <p className="text-[8px] font-black uppercase text-zinc-400 truncate">{t.name}</p>
              <p className="text-sm font-black text-brand-primary tabular-nums">{totals[t.id] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
