import { useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  AlertCircle,
  Boxes,
  Check,
  X,
  Shuffle,
  PackageCheck,
  HelpCircle,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Edit3,
} from 'lucide-react';
import { KnockdownItem } from './hooks/useStock';
import { KnockdownSetupDialogMobile } from './components/KnockdownSetupDialogMobile';
import { InvoiceRecord, JointStockTake, InventoryItem, groupAndSortItems } from './StockScreen';
import { cn } from '../../lib/utils';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { MobileNavStack, useNavStack, NavStackFrame } from '../../components/mobile/MobileNavStack';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';

type ActiveTab = 'inventory' | 'assembled' | 'pre-assembled' | 'stock-take';
type InventorySubTab = 'current-stock' | 'invoice-builder' | 'missing-items' | 'extras';

interface InvoiceStockRequirement {
  stockCode: string;
  description: string;
  qtyNeeded: number;
  isPart: boolean;
  qtyInStock: number;
  met: boolean;
  deficit: number;
}

interface InvoiceStockAnalysis {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  requirements: InvoiceStockRequirement[];
  canComplete: boolean;
}

interface ExtraInventoryItem extends InventoryItem {
  demand: number;
  surplus: number;
  isExtra: boolean;
}

interface StockScreenMobileProps {
  loading: boolean;
  error: string | null;
  updateTypeAndQty: (id: string, updates: Partial<Pick<KnockdownItem, 'type' | 'qty' | 'displayName' | 'parts'>>) => Promise<boolean>;

  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  inventorySubTab: InventorySubTab;
  setInventorySubTab: (tab: InventorySubTab) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  isSetupOpen: boolean;
  setIsSetupOpen: (open: boolean) => void;

  loadingTakes: boolean;
  loadingInv: boolean;
  stockTakes: JointStockTake[];
  invoices: InvoiceRecord[];
  inventoryItems: InventoryItem[];

  selectedStatuses: string[];
  setSelectedStatuses: (updater: (prev: string[]) => string[]) => void;
  invoiceCountsByStatus: Record<string, number>;

  builderFilter: 'completed' | 'incomplete';
  setBuilderFilter: (v: 'completed' | 'incomplete') => void;

  filteredStockItems: KnockdownItem[];
  knockdownList: KnockdownItem[];
  invoiceStockAnalyses: InvoiceStockAnalysis[];
  totalOutstandingDemands: Record<string, number>;
  extrasList: ExtraInventoryItem[];
  counts: Record<ActiveTab, number>;

  handleApproveItemInTake: (take: JointStockTake, itemIndex: number) => Promise<void>;
  handleRejectItemInTake: (take: JointStockTake, itemIndex: number) => Promise<void>;
  handleDeleteInventoryItem: (invId: string) => Promise<void>;
  handleDeleteStockTake: (takeId: string) => Promise<void>;
  handleUpdateInventoryQty: (invId: string, newQty: number) => Promise<void>;
  handleMoveCategory: (itemId: string, newType: KnockdownItem['type']) => Promise<void>;
}

export function StockScreenMobile({
  loading,
  error,
  updateTypeAndQty,
  activeTab,
  setActiveTab,
  inventorySubTab,
  setInventorySubTab,
  searchQuery,
  setSearchQuery,
  isSetupOpen,
  setIsSetupOpen,
  loadingTakes,
  loadingInv,
  stockTakes,
  invoiceCountsByStatus,
  inventoryItems,
  selectedStatuses,
  setSelectedStatuses,
  builderFilter,
  setBuilderFilter,
  filteredStockItems,
  knockdownList,
  invoiceStockAnalyses,
  totalOutstandingDemands,
  extrasList,
  counts,
  handleApproveItemInTake,
  handleRejectItemInTake,
  handleDeleteInventoryItem,
  handleDeleteStockTake,
  handleUpdateInventoryQty,
  handleMoveCategory,
  handleDeleteItem,
}: StockScreenMobileProps & { handleDeleteItem: (itemId: string) => Promise<void> }) {
  // Quick edit state (quantity) — inventory items
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [editInvQtyValue, setEditInvQtyValue] = useState<number>(0);

  // Quick edit state (quantity) — knockdown catalog items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState<number>(0);

  const { stack, push, pop, reset, depth } = useNavStack();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editItem, setEditItem] = useState<KnockdownItem | undefined>(undefined);

  const tabLabel = (tab: ActiveTab) =>
    tab === 'inventory' ? 'Inventory' : tab === 'assembled' ? 'Assembled' : tab === 'pre-assembled' ? 'Pre-assembled' : 'Stock Take';

  const subTabs: { id: InventorySubTab; label: string; icon: typeof Boxes }[] = [
    { id: 'current-stock', label: 'Current Stock', icon: Boxes },
    { id: 'invoice-builder', label: 'Invoice Builder', icon: CheckCircle2 },
    { id: 'missing-items', label: 'Missing Items', icon: AlertTriangle },
    { id: 'extras', label: 'Extras', icon: TrendingUp },
  ];

  // Build parts-breakdown drill-down frame freshly (fresh data each render, per Phase 1 lesson)
  const partsFrame = (item: KnockdownItem): NavStackFrame => ({
    title: item.displayName || item.stockCode,
    subtitle: `Stock Code · ${item.stockCode}`,
    content: (
      <div className="space-y-3">
        {item.parts && item.parts.length > 0 ? (
          item.parts.map((p, pIdx) => (
            <div key={pIdx} className="bg-white border border-zinc-200 p-3.5 rounded-2xl shadow-xs flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-black text-zinc-750 uppercase tracking-tight bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 inline-block">
                  {p.partCode}
                </p>
                <p className="text-xs font-medium text-zinc-500 truncate mt-1">{p.description}</p>
              </div>
              <div className="px-2.5 py-1 bg-zinc-100 text-zinc-700 font-mono text-xs rounded-lg font-bold shrink-0">
                Qty: {p.qty}
              </div>
            </div>
          ))
        ) : (
          <div className="text-zinc-400 font-mono text-xs flex items-center gap-1.5 py-8 justify-center">
            <HelpCircle className="w-4 h-4 text-zinc-300" />
            No explicit child components configured for this entry.
          </div>
        )}
      </div>
    ),
  });

  // Build stock-take items drill-down frame freshly from live take data
  const stockTakeFrame = (take: JointStockTake): NavStackFrame => ({
    title: `Stock Take #${take.code}`,
    subtitle: `Counted by ${take.submittedBy || 'Team Member'}`,
    content: (
      <div className="space-y-3">
        {(take.items || []).map((tItem, itemIdx) => (
          <div key={itemIdx} className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] font-black uppercase text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                {tItem.stockCode}
              </span>
              {tItem.isPart && (
                <span className="text-[8px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded tracking-wider">
                  Part {tItem.parentItem ? `of ${tItem.parentItem}` : ''}
                </span>
              )}
              <span className={cn(
                'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded',
                tItem.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                  : tItem.status === 'rejected'
                    ? 'bg-red-50 text-red-700 border border-red-150'
                    : 'bg-amber-50 text-amber-700 border border-amber-150'
              )}>
                {tItem.status === 'approved' ? 'Approved' : tItem.status === 'rejected' ? 'Rejected' : 'Pending'}
              </span>
            </div>
            <p className="text-xs font-black text-zinc-800 uppercase leading-snug">{tItem.description}</p>
            <div className="flex items-center justify-between gap-2">
              <div className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl font-mono text-xs">
                Counted: <strong className="font-sans font-black text-sm">{tItem.countedQty}</strong>
              </div>
              {tItem.status === 'pending' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Approve count"
                    onClick={() => handleApproveItemInTake(take, itemIdx)}
                    className="px-3 py-1.5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 mobile-tap-target"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Approve
                  </button>
                  <button
                    type="button"
                    title="Reject count"
                    onClick={() => handleRejectItemInTake(take, itemIdx)}
                    className="px-2.5 py-1.5 border border-red-200 text-red-600 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-0.5 mobile-tap-target"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    ),
  });

  const isLoadingCurrent = loading || (activeTab === 'stock-take' && loadingTakes) || (activeTab === 'inventory' && loadingInv);

  return (
    <div className="space-y-4 pb-6 text-zinc-900">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-black uppercase tracking-wider text-brand-primary flex items-center gap-2">
          <Boxes className="w-5 h-5 text-brand-accent stroke-[2.5]" />
          Stock Inventory
        </h1>
        <p className="text-xs text-zinc-500 font-mono uppercase">Manage parts, components and structural stock</p>
      </div>

      <button
        type="button"
        title="Add new product setup"
        onClick={() => { setEditItem(undefined); setIsSetupOpen(true); }}
        className="w-full px-5 py-3 bg-brand-primary text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md mobile-tap-target"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        Product Setup
      </button>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search stock code or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          title="Search stock"
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            title="Clear search"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 mobile-tap-target"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto scroller-hide -mx-4 px-4 pb-1">
        {(['inventory', 'assembled', 'pre-assembled', 'stock-take'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              title={tabLabel(tab)}
              onClick={() => { setActiveTab(tab); setEditingItemId(null); }}
              className={cn(
                'px-3.5 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 mobile-tap-target',
                isActive ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'
              )}
            >
              {tabLabel(tab)}
              <span className={cn(
                'px-1.5 py-0.5 rounded-md text-[9px] font-mono leading-none border font-black',
                isActive ? 'bg-white/20 border-white/20 text-white' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoadingCurrent ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary shrink-0" />
          <p className="text-xs text-zinc-500 font-mono uppercase font-semibold">Synchronizing stock directory...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-medium flex items-center gap-2 leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>Failed to synchronize: {error}</span>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Sub tabs */}
          <div className="flex gap-2 overflow-x-auto scroller-hide -mx-4 px-4 pb-1">
            {subTabs.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = inventorySubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  title={sub.label}
                  onClick={() => setInventorySubTab(sub.id)}
                  className={cn(
                    'px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 border shrink-0 mobile-tap-target',
                    isSubActive ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-zinc-600 border-zinc-200'
                  )}
                >
                  <SubIcon className="w-3.5 h-3.5" />
                  {sub.label}
                </button>
              );
            })}
          </div>

          {/* Invoice status filter trigger */}
          <button
            type="button"
            title="Filter invoice statuses"
            onClick={() => setIsFilterOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-600 mobile-tap-target"
          >
            <span>Invoice Statuses: {selectedStatuses.map(s => s.replace('_', ' ')).join(', ') || 'None'}</span>
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Current Stock */}
          {inventorySubTab === 'current-stock' && (
            inventoryItems.length > 0 ? (
              (() => {
                const filtered = inventoryItems.filter(item => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return item.stockCode.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
                });
                const grouped = groupAndSortItems<InventoryItem>(filtered, knockdownList);

                if (grouped.length === 0) {
                  return (
                    <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400 text-xs">
                      No matching inventory items found.
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {grouped.map((group) => (
                      <div key={group.groupCode} className="space-y-2.5">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group:</span>
                          <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-lg">
                            {group.groupCode}
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {group.items.map((item) => {
                            const itemKey = `${item.stockCode.toLowerCase()}_${!!item.isPart}`;
                            const demand = totalOutstandingDemands[itemKey] || 0;
                            let stockStatus: 'under' | 'perfect' | 'over';
                            if (demand > 0) {
                              stockStatus = item.qty < demand ? 'under' : item.qty === demand ? 'perfect' : 'over';
                            } else {
                              stockStatus = 'perfect';
                            }
                            const textColor = stockStatus === 'under' ? 'text-red-600' : stockStatus === 'perfect' ? 'text-emerald-600' : 'text-orange-600';
                            const statusLabel = stockStatus === 'under' ? 'Not Enough Stock' : stockStatus === 'perfect' ? 'Right Amount' : 'Overstock';

                            return (
                              <MobileCard key={item.id}>
                                <MobileCard.Primary>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-150 text-emerald-750 px-2 py-0.5 rounded-lg">
                                        {item.stockCode}
                                      </span>
                                      {item.isPart ? (
                                        <span className="text-[8px] text-purple-700 bg-purple-50 border border-purple-200 uppercase tracking-wide px-1.5 py-0.5 rounded font-black">
                                          Part
                                        </span>
                                      ) : (
                                        <span className="text-[8px] text-zinc-500 bg-zinc-50 border border-zinc-200 uppercase tracking-wide px-1.5 py-0.5 rounded font-black">
                                          Standard
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="text-sm font-black text-brand-primary leading-tight uppercase mt-1 truncate">
                                      {item.description || item.stockCode}
                                    </h3>
                                  </div>
                                </MobileCard.Primary>

                                <div className="text-[10px] font-sans">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-black text-zinc-400 uppercase tracking-wider text-[9px]">Demand Progress:</span>
                                    <span className={cn('font-bold', textColor)}>
                                      {statusLabel} ({demand > 0 ? `${item.qty} of ${demand}` : `${item.qty} available`})
                                    </span>
                                  </div>
                                  <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200/50">
                                    <div
                                      className={cn('h-full rounded-full transition-all', stockStatus === 'under' ? 'bg-red-500' : stockStatus === 'perfect' ? 'bg-emerald-500' : 'bg-orange-500')}
                                      style={{ width: `${demand > 0 ? Math.max(7, Math.min(100, Math.round((item.qty / demand) * 100))) : (item.qty > 0 ? 100 : 0)}%` }}
                                    />
                                  </div>
                                </div>

                                <MobileCard.Secondary className="justify-between pt-1">
                                  <div>
                                    {editingInvId === item.id ? (
                                      <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200">
                                        <input
                                          aria-label="Quantity"
                                          title="Quantity"
                                          type="number"
                                          min="0"
                                          value={editInvQtyValue}
                                          onChange={(e) => setEditInvQtyValue(Number(e.target.value) || 0)}
                                          className="w-14 px-2 py-1 text-xs font-bold text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                                        />
                                        <button
                                          type="button"
                                          title="Save quantity"
                                          onClick={async () => { await handleUpdateInventoryQty(item.id, editInvQtyValue); setEditingInvId(null); }}
                                          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-150 mobile-tap-target"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </button>
                                        <button
                                          type="button"
                                          title="Cancel edits"
                                          onClick={() => setEditingInvId(null)}
                                          className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg mobile-tap-target"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        title="Click to change quantity available"
                                        onClick={() => { setEditingInvId(item.id); setEditInvQtyValue(item.qty); }}
                                        className="px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-xs flex items-center gap-1.5 mobile-tap-target"
                                      >
                                        <span className="text-emerald-600/90 font-mono font-bold uppercase tracking-wide">Available:</span>
                                        <strong className="font-black text-sm">{item.qty}</strong>
                                      </button>
                                    )}
                                  </div>
                                  <MobileCard.Actions>
                                    <MobileCardActionsMenu
                                      actions={[
                                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteInventoryItem(item.id) },
                                      ]}
                                    />
                                  </MobileCard.Actions>
                                </MobileCard.Secondary>
                              </MobileCard>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-6 space-y-3">
                <Boxes className="w-10 h-10 text-zinc-300 stroke-[1.5]" />
                <h3 className="text-sm font-black text-zinc-700 uppercase tracking-wider">Inventory Is Empty</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  No approved stock items have been logged yet. Complete a stock take, submit counts, and approve them here.
                </p>
              </div>
            )
          )}

          {/* Invoice Builder */}
          {inventorySubTab === 'invoice-builder' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <p className="text-[10px] font-sans text-emerald-800 font-bold uppercase tracking-wider">Feasibility Assessment</p>
                <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                  See which invoices can be built with current inventory.
                </p>
              </div>

              <div className="flex bg-zinc-100 p-1 rounded-2xl">
                <button
                  type="button"
                  title="Show completed invoices"
                  onClick={() => setBuilderFilter('completed')}
                  className={cn(
                    'flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl mobile-tap-target',
                    builderFilter === 'completed' ? 'bg-white text-emerald-800 shadow-xs' : 'text-zinc-500'
                  )}
                >
                  Completed ({invoiceStockAnalyses.filter(a => a.canComplete).length})
                </button>
                <button
                  type="button"
                  title="Show incomplete invoices"
                  onClick={() => setBuilderFilter('incomplete')}
                  className={cn(
                    'flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl mobile-tap-target',
                    builderFilter === 'incomplete' ? 'bg-white text-amber-800 shadow-xs' : 'text-zinc-500'
                  )}
                >
                  Incomplete ({invoiceStockAnalyses.filter(a => !a.canComplete).length})
                </button>
              </div>

              {(builderFilter === 'completed'
                ? invoiceStockAnalyses.filter(a => a.canComplete)
                : invoiceStockAnalyses.filter(a => !a.canComplete)
              ).length > 0 ? (
                <div className="space-y-2.5">
                  {(builderFilter === 'completed'
                    ? invoiceStockAnalyses.filter(a => a.canComplete)
                    : invoiceStockAnalyses.filter(a => !a.canComplete)
                  ).map(analysis => (
                    <MobileCard key={analysis.id}>
                      <MobileCard.Primary>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black bg-zinc-900 text-white px-2 py-0.5 rounded">
                              {analysis.invoiceNumber}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-mono font-semibold">{analysis.invoiceDate}</span>
                          </div>
                          <h3 className="text-xs font-black text-zinc-805 uppercase mt-1 truncate">{analysis.clientName}</h3>
                        </div>
                        {analysis.canComplete ? (
                          <span className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wide px-2.5 py-1 rounded-xl flex items-center gap-1 shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Ready
                          </span>
                        ) : (
                          <span className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-wide px-2.5 py-1 rounded-xl flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" /> Deficit
                          </span>
                        )}
                      </MobileCard.Primary>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.requirements.map((req, rIdx) => (
                          <span
                            key={rIdx}
                            className={cn(
                              'text-[9px] font-mono border rounded-lg px-2 py-1',
                              req.met ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200 font-medium'
                            )}
                          >
                            {req.stockCode} ({req.qtyInStock}/{req.qtyNeeded}{!req.met ? ` missing ${req.deficit}` : ''})
                          </span>
                        ))}
                      </div>
                    </MobileCard>
                  ))}
                </div>
              ) : (
                <div className="py-14 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-6 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-zinc-300 stroke-[1.5]" />
                  <p className="text-xs font-black text-zinc-650 uppercase tracking-wider">
                    {builderFilter === 'completed' ? 'No completeable invoices' : 'All invoices can be completed!'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Missing Items */}
          {inventorySubTab === 'missing-items' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[10px] font-sans text-amber-800 font-bold uppercase tracking-wider">Material Shortfall Tracker</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  Active invoices short on physical inventory.
                </p>
              </div>

              {invoiceStockAnalyses.filter(a => !a.canComplete).length > 0 ? (
                <div className="space-y-3">
                  {invoiceStockAnalyses.filter(a => !a.canComplete).map(analysis => (
                    <MobileCard key={analysis.id}>
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black bg-zinc-900 text-white px-2 py-0.5 rounded">
                              {analysis.invoiceNumber}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-mono font-semibold uppercase">{analysis.invoiceDate}</span>
                          </div>
                          <h3 className="text-xs font-black text-brand-primary uppercase mt-1 truncate">{analysis.clientName}</h3>
                        </div>
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 font-black text-[8px] uppercase tracking-wider px-2 py-1 rounded-full shrink-0">
                          Deficit
                        </span>
                      </div>
                      <div className="space-y-2.5 pt-1">
                        {analysis.requirements.filter(req => req.deficit > 0).map((req, rIdx) => {
                          const pct = req.qtyNeeded > 0 ? Math.min(100, (req.qtyInStock / req.qtyNeeded) * 100) : 100;
                          return (
                            <div key={rIdx} className="bg-zinc-50 border border-zinc-150 rounded-2xl p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2 text-xs">
                                <div className="min-w-0">
                                  <span className="font-mono text-[9px] font-black uppercase text-zinc-700 bg-zinc-200 px-1.5 py-0.5 rounded border border-zinc-250">
                                    {req.stockCode}
                                  </span>
                                  <p className="text-[10px] font-medium text-zinc-700 truncate mt-1">{req.description}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-black text-amber-600">{req.qtyInStock}</span>
                                  <span className="text-zinc-450 font-bold"> / {req.qtyNeeded}</span>
                                </div>
                              </div>
                              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex justify-between items-center text-[8px] font-mono">
                                <span className="text-zinc-500 font-semibold uppercase">{req.isPart ? 'Part' : 'Standard'}</span>
                                <span className="text-red-700 font-black uppercase bg-red-50 border border-red-150 px-1.5 py-0.5 rounded">
                                  Missing: {req.deficit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </MobileCard>
                  ))}
                </div>
              ) : (
                <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400 text-xs font-mono">
                  No active outstanding invoices found. All items accounted for.
                </div>
              )}
            </div>
          )}

          {/* Extras */}
          {inventorySubTab === 'extras' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
                <p className="text-[10px] font-sans text-purple-800 font-bold uppercase tracking-wider">Surplus & Extra Ledger</p>
                <p className="text-[11px] text-purple-700 mt-1">
                  Approved stock exceeding demand, or not tied to any active invoice.
                </p>
              </div>

              {extrasList.length > 0 ? (
                <div className="space-y-2.5">
                  {extrasList.map((item) => (
                    <MobileCard key={item.id}>
                      <MobileCard.Primary>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-purple-50 border border-purple-150 text-purple-700 px-2 py-0.5 rounded-lg">
                              {item.stockCode}
                            </span>
                            <span className="text-[8px] text-zinc-500 bg-zinc-50 border border-zinc-200 uppercase tracking-wide px-1.5 py-0.5 rounded font-black">
                              Demand: {item.demand}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-brand-primary leading-tight uppercase mt-1 truncate">
                            {item.description || item.stockCode}
                          </h3>
                        </div>
                      </MobileCard.Primary>
                      <MobileCard.Secondary className="justify-between pt-1">
                        <div>
                          {editingInvId === item.id ? (
                            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200">
                              <input
                                aria-label="Quantity"
                                title="Quantity"
                                type="number"
                                min="0"
                                value={editInvQtyValue}
                                onChange={(e) => setEditInvQtyValue(Number(e.target.value) || 0)}
                                className="w-14 px-2 py-1 text-xs font-bold text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                              />
                              <button
                                type="button"
                                title="Save quantity"
                                onClick={async () => { await handleUpdateInventoryQty(item.id, editInvQtyValue); setEditingInvId(null); }}
                                className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-150 mobile-tap-target"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                              <button
                                type="button"
                                title="Cancel edits"
                                onClick={() => setEditingInvId(null)}
                                className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg mobile-tap-target"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              title="Click to change quantity available"
                              onClick={() => { setEditingInvId(item.id); setEditInvQtyValue(item.qty); }}
                              className="px-3 py-1.5 bg-purple-50 rounded-xl border border-purple-100 text-purple-800 text-xs flex items-center gap-1.5 mobile-tap-target"
                            >
                              <span className="text-purple-650 font-mono font-bold uppercase tracking-wide">Surplus:</span>
                              <strong className="font-black text-sm">+{item.surplus}</strong>
                            </button>
                          )}
                        </div>
                        <MobileCard.Actions>
                          <MobileCardActionsMenu
                            actions={[
                              { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteInventoryItem(item.id) },
                            ]}
                          />
                        </MobileCard.Actions>
                      </MobileCard.Secondary>
                    </MobileCard>
                  ))}
                </div>
              ) : (
                <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-6 space-y-2">
                  <Boxes className="w-10 h-10 text-purple-300 stroke-[1.5]" />
                  <p className="text-xs font-black text-zinc-650 uppercase tracking-wider">No surplus extra inventory</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'stock-take' ? (
        stockTakes.length > 0 ? (
          (() => {
            const filteredTakes = stockTakes.filter(take => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return take.code.includes(q) || take.submittedBy.toLowerCase().includes(q) || take.items?.some(i => i.stockCode.toLowerCase().includes(q));
            });

            if (filteredTakes.length === 0) {
              return (
                <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400 text-xs">
                  No matching stock takes found.
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {filteredTakes.map((take) => {
                  const pendingCount = (take.items || []).filter(i => i.status === 'pending').length;
                  return (
                    <MobileCard key={take.id} onClick={() => push(stockTakeFrame(take))}>
                      <MobileCard.Primary>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-lg">
                              #{take.code}
                            </span>
                            <span className={cn(
                              'text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded',
                              take.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : pendingCount > 0
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                            )}>
                              {take.status === 'completed' ? 'Completed' : pendingCount > 0 ? `${pendingCount} Pending` : 'Partial'}
                            </span>
                          </div>
                        </div>
                        <div className="font-mono text-xs text-right shrink-0">
                          <span className="text-zinc-400 font-bold uppercase block text-[8px] tracking-wider">Lines:</span>
                          <strong className="text-sm font-black text-zinc-805">{(take.items || []).length}</strong>
                        </div>
                      </MobileCard.Primary>
                      <MobileCard.Secondary className="justify-between">
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-400" /> {take.submittedBy || 'Team Member'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" /> {take.submittedAt ? new Date(take.submittedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <MobileCard.Actions>
                          <MobileCardActionsMenu
                            actions={[
                              { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteStockTake(take.id) },
                            ]}
                          />
                        </MobileCard.Actions>
                      </MobileCard.Secondary>
                    </MobileCard>
                  );
                })}
              </div>
            );
          })()
        ) : (
          <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-6 space-y-3">
            <div className="w-14 h-14 bg-zinc-50 border border-zinc-150 rounded-2xl text-zinc-400 flex items-center justify-center shrink-0">
              <Boxes className="w-7 h-7 stroke-1" />
            </div>
            <h3 className="text-sm font-black text-zinc-700 uppercase tracking-wider">All Caught Up</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              No stock takes are currently in the queue. Submitted counts from the Team Dashboard will load here.
            </p>
          </div>
        )
      ) : (
        (() => {
          const grouped = groupAndSortItems<KnockdownItem>(filteredStockItems, knockdownList);

          if (grouped.length === 0) {
            return (
              <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400 text-xs">
                No matching items found.
              </div>
            );
          }

          return (
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.groupCode} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group:</span>
                    <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-lg">
                      {group.groupCode}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {group.items.map((item) => {
                      const isEditing = editingItemId === item.id;
                      return (
                        <MobileCard key={item.id} onClick={() => push(partsFrame(item))}>
                          <MobileCard.Primary>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-brand-primary/10 border border-brand-primary/15 text-brand-primary px-1.5 py-0.5 rounded-lg">
                                  {item.stockCode}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono uppercase">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-brand-primary leading-tight uppercase mt-1 truncate">
                                {item.displayName}
                              </h3>
                              {item.description && (
                                <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.description}</p>
                              )}
                            </div>
                          </MobileCard.Primary>

                          {item.type !== 'knockdown' && (
                            <div onClick={(e) => e.stopPropagation()}>
                              {isEditing ? (
                                <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-200 w-fit">
                                  <input
                                    aria-label="Quantity"
                                    title="Quantity"
                                    type="number"
                                    min="1"
                                    value={editQtyValue}
                                    onChange={(e) => setEditQtyValue(Number(e.target.value) || 1)}
                                    className="w-14 px-2 py-1 text-xs font-bold text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                                  />
                                  <button
                                    type="button"
                                    title="Save quantity"
                                    onClick={async () => {
                                      if (editQtyValue > 0) {
                                        await updateTypeAndQty(item.id, { qty: editQtyValue });
                                      }
                                      setEditingItemId(null);
                                    }}
                                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-150 mobile-tap-target"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Cancel edits"
                                    onClick={() => setEditingItemId(null)}
                                    className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg mobile-tap-target"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  title="Click to edit quantity"
                                  onClick={() => { setEditingItemId(item.id); setEditQtyValue(item.qty); }}
                                  className="px-3 py-1.5 bg-zinc-50 rounded-xl border border-zinc-150 text-xs flex items-center gap-1.5 mobile-tap-target w-fit"
                                >
                                  <span className="text-zinc-400/90 font-mono font-bold uppercase tracking-wide">Stock Qty:</span>
                                  <strong className="text-zinc-800 font-black">{item.qty}</strong>
                                </button>
                              )}
                            </div>
                          )}

                          <MobileCard.Secondary className="justify-between">
                            <div className="flex items-center gap-1 bg-zinc-100/60 border border-zinc-150 rounded-xl p-0.5" onClick={(e) => e.stopPropagation()}>
                              <Shuffle className="w-3 h-3 text-zinc-400 mx-1 shrink-0" />
                              {(['assembled', 'pre-assembled'] as const).map((t) => {
                                if (t === item.type) return null;
                                const label = t === 'assembled' ? 'Assembled' : 'Pre-assembled';
                                const icon = t === 'assembled' ? <PackageCheck className="w-3 h-3" /> : <Boxes className="w-3 h-3" />;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    title={`Move to ${label}`}
                                    onClick={() => handleMoveCategory(item.id, t)}
                                    className="px-1.5 py-1 bg-white border border-zinc-200 text-zinc-650 font-extrabold text-[8px] uppercase tracking-wider rounded-lg flex items-center gap-1 mobile-tap-target"
                                  >
                                    {icon}
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                            <MobileCard.Actions>
                              <MobileCardActionsMenu
                                actions={[
                                  { label: 'Edit', icon: Edit3, onClick: () => { setEditItem(item); setIsSetupOpen(true); } },
                                  { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDeleteItem(item.id) },
                                ]}
                              />
                            </MobileCard.Actions>
                          </MobileCard.Secondary>
                        </MobileCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Drill-down stack: parts breakdown / stock take items */}
      <MobileNavStack isOpen={depth > 0} onClose={reset} onPop={pop} stack={stack} root={{ title: '', content: null }} />

      {/* Invoice status filter sheet */}
      <MobileSheet isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Invoice Statuses" fullHeight={false}>
        <div className="space-y-2">
          {[
            { key: 'draft', label: 'Draft' },
            { key: 'proposed', label: 'Proposed' },
          ].map((s) => {
            const isSelected = selectedStatuses.includes(s.key);
            const count = invoiceCountsByStatus[s.key] || 0;
            return (
              <button
                key={s.key}
                type="button"
                title={`Toggle ${s.label}`}
                onClick={() => {
                  setSelectedStatuses(prev => prev.includes(s.key) ? prev.filter(x => x !== s.key) : [...prev, s.key]);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all mobile-tap-target border',
                  isSelected ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                )}
              >
                <span>{s.label} ({count})</span>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </MobileSheet>

      {/* Knockdown Setup Dialog (mobile) */}
      <KnockdownSetupDialogMobile
        isOpen={isSetupOpen}
        onClose={() => { setIsSetupOpen(false); setEditItem(undefined); }}
        onSaveSuccess={() => { setIsSetupOpen(false); setEditItem(undefined); }}
        editItem={editItem}
      />
    </div>
  );
}
