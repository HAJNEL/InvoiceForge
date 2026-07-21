import { useState, useMemo } from 'react';
import { ClipboardList, Gauge, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../products/hooks/useProducts';
import { KpiTemplateKind } from '../hooks/useKpiTemplates';
import {
  useKpiReadings, KpiReading, TEAM_SIZES, dailyOutput, monthlyOutput
} from '../hooks/useKpiReadings';
import { KpiTemplateDialog } from './KpiTemplateDialog';
import { TakeReadingDialog } from './TakeReadingDialog';
import { ReadingsHistoryDialog } from './ReadingsHistoryDialog';

interface Props {
  products: Product[]; // all products
  templateProductIds: string[];
  onSaveTemplate: (kind: KpiTemplateKind, productIds: string[]) => Promise<boolean>;
  isMobile?: boolean;
}

export function EmployeesTab({ products, templateProductIds, onSaveTemplate, isMobile }: Props) {
  const { readings, loading, addReading, updateReading, deleteReading } = useKpiReadings();
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [isReadingOpen, setReadingOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [editReading, setEditReading] = useState<KpiReading | null>(null);
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);

  const templateProducts = useMemo(
    () => products.filter(p => templateProductIds.includes(p.id)),
    [products, templateProductIds]
  );

  const selectedReading = useMemo(
    () => readings.find(r => r.id === selectedReadingId) ?? readings[0] ?? null,
    [readings, selectedReadingId]
  );

  const handleSaveReading = async (
    data: Omit<KpiReading, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    if (editId) return updateReading(editId, data);
    const id = await addReading(data);
    if (id) setSelectedReadingId(id);
    return id !== null;
  };

  const handleDelete = async (reading: KpiReading) => {
    if (!window.confirm(`Delete the KPI reading from ${reading.date.slice(0, 10)}? This cannot be undone.`)) return;
    const ok = await deleteReading(reading.id);
    if (ok) toast.success('Reading Deleted');
    else toast.error('Delete Failed');
  };

  const openEdit = (reading: KpiReading) => {
    setEditReading(reading);
    setReadingOpen(true);
  };

  const openNew = () => {
    setEditReading(null);
    setReadingOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Production KPI — Units Per Hour by Team Size</h2>
          <p className="text-[11px] text-zinc-500">
            {templateProducts.length} template product{templateProducts.length !== 1 ? 's' : ''}
            {selectedReading && <> · viewing reading from <span className="font-bold">{selectedReading.date.slice(0, 10)}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setHistoryOpen(true)} title="View the readings history"
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
            <History className="w-3.5 h-3.5" />
            History
            {readings.length > 0 && (
              <span className="min-w-4 h-4 px-1 bg-brand-accent text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {readings.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setTemplateOpen(true)} title="Edit the KPI product template"
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
            <ClipboardList className="w-3.5 h-3.5" />
            Edit Template
          </button>
          <button type="button" onClick={openNew} disabled={templateProducts.length === 0}
            title={templateProducts.length === 0 ? 'Set up the template first' : 'Take a new KPI reading'}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50">
            <Gauge className="w-3.5 h-3.5" />
            Take Reading
          </button>
        </div>
      </div>

      {templateProducts.length === 0 ? (
        <EmptyState onSetup={() => setTemplateOpen(true)} />
      ) : (
        // Reading table (latest or selected reading)
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
              </div>
            ) : isMobile ? (
              <MobileReadingCards products={templateProducts} reading={selectedReading} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[760px]">
                  <thead className="bg-brand-primary text-white">
                    <tr>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-wider">Product Code</th>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-wider">Product Name</th>
                      {TEAM_SIZES.map(size => (
                        <th key={size} className="px-2 py-3 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                          {size} {size === 1 ? 'Person' : 'People'}<br />
                          <span className="font-bold opacity-70 normal-case">(units/hour)</span>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-wider whitespace-nowrap bg-emerald-700">Daily @ Best</th>
                      <th className="px-3 py-3 text-[9px] font-black uppercase tracking-wider whitespace-nowrap bg-emerald-700">Monthly @ Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {templateProducts.map(p => {
                      const entry = selectedReading?.entries[p.id];
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-2.5 font-mono text-[10px] font-black text-zinc-600 whitespace-nowrap">{p.stockCode}</td>
                          <td className="px-4 py-2.5 font-semibold text-zinc-800">{p.description}</td>
                          {TEAM_SIZES.map((size, idx) => {
                            const v = entry?.rates?.[idx];
                            return (
                              <td key={size} className="px-2 py-2.5 text-center tabular-nums text-zinc-700 font-bold">
                                {typeof v === 'number' ? v : <span className="text-zinc-300">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-center font-black text-emerald-700 bg-emerald-50/60 tabular-nums">
                            {selectedReading ? dailyOutput(entry, selectedReading.shiftHours) : 0}
                          </td>
                          <td className="px-3 py-2.5 text-center font-black text-emerald-700 bg-emerald-50/60 tabular-nums">
                            {selectedReading ? monthlyOutput(entry, selectedReading.shiftHours, selectedReading.workingDaysPerMonth) : 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selectedReading && (
              <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50 text-[10px] text-zinc-500 font-medium flex flex-wrap gap-x-4">
                <span>Shift length: <strong>{selectedReading.shiftHours}h</strong></span>
                <span>Working days/month: <strong>{selectedReading.workingDaysPerMonth}</strong></span>
              </div>
            )}
        </div>
      )}

      <KpiTemplateDialog
        isOpen={isTemplateOpen}
        onClose={() => setTemplateOpen(false)}
        kind="employee"
        products={products}
        selectedIds={templateProductIds}
        onSave={onSaveTemplate}
      />

      <TakeReadingDialog
        isOpen={isReadingOpen}
        onClose={() => setReadingOpen(false)}
        products={templateProducts}
        editReading={editReading}
        onSave={handleSaveReading}
      />

      <ReadingsHistoryDialog
        isOpen={isHistoryOpen}
        onClose={() => setHistoryOpen(false)}
        readings={readings}
        selectedReadingId={selectedReading?.id ?? null}
        onView={(r) => { setSelectedReadingId(r.id); setHistoryOpen(false); }}
        onEdit={(r) => { setHistoryOpen(false); openEdit(r); }}
        onDelete={handleDelete}
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
        Choose which products to track — sync all products or pick them manually.
      </p>
      <button type="button" onClick={onSetup} title="Set up the KPI product template"
        className="mt-5 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer">
        Set Up Template
      </button>
    </div>
  );
}

function MobileReadingCards({ products, reading }: { products: Product[]; reading: KpiReading | null }) {
  return (
    <div className="divide-y divide-zinc-100">
      {products.map(p => {
        const entry = reading?.entries[p.id];
        return (
          <div key={p.id} className="p-4">
            <p className="font-mono text-[10px] font-black text-zinc-500">{p.stockCode}</p>
            <p className="text-xs font-semibold text-zinc-800 mb-2">{p.description}</p>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {TEAM_SIZES.map((size, idx) => {
                const v = entry?.rates?.[idx];
                return (
                  <div key={size} className="bg-zinc-50 border border-zinc-100 rounded-lg px-1 py-1.5 text-center">
                    <p className="text-[8px] font-black uppercase text-zinc-400">{size}p</p>
                    <p className="text-[11px] font-bold tabular-nums text-zinc-700">{typeof v === 'number' ? v : '—'}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 text-[10px] font-bold text-emerald-700">
              <span className="bg-emerald-50 rounded-lg px-2 py-1">Daily: {reading ? dailyOutput(entry, reading.shiftHours) : 0}</span>
              <span className="bg-emerald-50 rounded-lg px-2 py-1">Monthly: {reading ? monthlyOutput(entry, reading.shiftHours, reading.workingDaysPerMonth) : 0}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
