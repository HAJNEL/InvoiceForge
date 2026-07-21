import { useState, FormEvent } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShoppingBag,
  ArrowUpRight,
  Upload,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { Product } from '../hooks/useProducts';
import { KnockdownItem } from '../../stock/hooks/useStock';
import { cn } from '../../../lib/utils';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

type ActiveTab = 'products' | 'knockdown' | 'consumables';

const TABS: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
  { key: 'products', label: 'Products', icon: Package },
  { key: 'knockdown', label: 'Knockdown', icon: Layers },
  { key: 'consumables', label: 'Consumables', icon: ShoppingBag },
];

interface ProductListMobileProps {
  inventoryMap: Record<string, number>;
  loading: boolean;
  error: string | null;
  deleteProduct: (id: string) => Promise<boolean>;

  knockdownLoading: boolean;
  deleteStockItem: (id: string) => Promise<boolean>;

  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  currentPage: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
  totalPages: number;

  catalogCount: number;
  consumableCount: number;
  knockdownCount: number;

  paginatedProducts: Product[];
  paginatedKnockdown: KnockdownItem[];
  itemCount: number;

  unitsOrderedMap: Record<string, number>;

  isSyncing: boolean;
  syncMessage: string | null;
  onSyncInvoices: () => void;

  onOpenImport: () => void;
  onOpenKnockdownSetup: (item?: KnockdownItem) => void;
  onOpenLinkComponents: (product: Product) => void;

  saveProduct: (data: { stockCode: string; description: string; unitPrice: number; category: 'product' | 'consumable' }) => Promise<unknown>;
  updateProduct: (id: string, updates: Partial<Pick<Product, 'description' | 'unitPrice' | 'category' | 'components'>>) => Promise<boolean>;
}

/** One parameterized card used for all three tabs — column set matches desktop exactly. */
function ProductCardRow({
  stockCode,
  description,
  subtitle,
  unitPrice,
  onFloor,
  ordered,
  compCount,
  showComponents,
  actions,
}: {
  stockCode: string;
  description: string;
  subtitle?: string;
  unitPrice?: number;
  onFloor: number;
  ordered: number;
  compCount?: number;
  showComponents?: boolean;
  actions: { label: string; icon: LucideIcon; onClick: () => void; destructive?: boolean }[];
}) {
  return (
    <MobileCard>
      <MobileCard.Primary>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-zinc-100 rounded-md border border-zinc-200 text-zinc-800">
              {stockCode}
            </span>
            {showComponents && (
              compCount && compCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-brand-accent bg-brand-accent/8 border border-brand-accent/20 px-2 py-0.5 rounded-full">
                  <Link2 className="w-3 h-3" />
                  {compCount}
                </span>
              ) : null
            )}
          </div>
          <p className="text-sm font-semibold text-zinc-850 mt-1">{description}</p>
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <MobileCard.Actions>
          <MobileCardActionsMenu actions={actions} />
        </MobileCard.Actions>
      </MobileCard.Primary>

      <MobileCard.Secondary className="justify-between mt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {typeof unitPrice === 'number' && (
            <span className="font-mono font-black text-xs text-zinc-800 tabular-nums">
              R {unitPrice.toFixed(2)}
            </span>
          )}
          <span
            className={cn(
              'inline-block font-black text-[11px] tabular-nums px-2 py-0.5 rounded-lg',
              onFloor > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
            )}
            title="Units on Floor"
          >
            {onFloor} on hand
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 font-black text-[11px] tabular-nums px-2 py-0.5 rounded-lg shrink-0',
            ordered > 0
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
          )}
          title="Units Ordered"
        >
          {ordered > 0 && <ArrowUpRight className="w-3 h-3" />}
          {ordered} ordered
        </span>
      </MobileCard.Secondary>
    </MobileCard>
  );
}

export function ProductListMobile({
  inventoryMap,
  loading,
  error,
  deleteProduct,
  knockdownLoading,
  deleteStockItem,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  totalPages,
  catalogCount,
  consumableCount,
  knockdownCount,
  paginatedProducts,
  paginatedKnockdown,
  itemCount,
  unitsOrderedMap,
  isSyncing,
  syncMessage,
  onSyncInvoices,
  onOpenImport,
  onOpenKnockdownSetup,
  onOpenLinkComponents,
  saveProduct,
  updateProduct,
}: ProductListMobileProps) {
  const [deletingKnockdownId, setDeletingKnockdownId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    stockCode: '',
    description: '',
    unitPrice: '',
    category: 'product' as 'product' | 'consumable',
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        stockCode: product.stockCode,
        description: product.description,
        unitPrice: product.unitPrice.toString(),
        category: product.category || 'product',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        stockCode: '',
        description: '',
        unitPrice: '',
        category: activeTab === 'consumables' ? 'consumable' : 'product',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.stockCode.trim() || !formData.description.trim()) return;

    setIsSubmitting(true);
    const price = parseFloat(formData.unitPrice) || 0;

    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        description: formData.description.trim(),
        unitPrice: price,
        category: formData.category,
      });
    } else {
      await saveProduct({
        stockCode: formData.stockCode.trim(),
        description: formData.description.trim(),
        unitPrice: price,
        category: formData.category,
      });
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const showAddButton = activeTab !== 'knockdown';

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-brand-accent shrink-0" />
          Catalog Products
        </h1>
        <p className="text-xs text-zinc-500">
          Manage your standard items, knockdown assemblies, and consumable stock.
        </p>
      </div>

      {/* Sync banner */}
      {syncMessage && (
        <div
          className={cn(
            'p-3 rounded-xl text-xs flex items-center gap-2 border',
            syncMessage.includes('Failed')
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          )}
        >
          {syncMessage.includes('Failed') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex items-center gap-2">
        {activeTab !== 'knockdown' && (
          <button
            onClick={onSyncInvoices}
            disabled={isSyncing}
            title="Sync products from invoices"
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target',
              isSyncing && 'opacity-75'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-zinc-500', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        )}
        <button
          onClick={onOpenImport}
          title={`Import ${activeTab} from Excel`}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-500" />
          Import
        </button>
        {showAddButton && (
          <button
            onClick={() => handleOpenModal()}
            title={activeTab === 'consumables' ? 'Add Consumable' : 'Add Product'}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
        {activeTab === 'knockdown' && (
          <button
            onClick={() => onOpenKnockdownSetup()}
            title="Add Knockdown Product"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      {/* Tab pill row */}
      <div className="flex gap-1.5 p-1 bg-zinc-100 rounded-xl overflow-x-auto scroller-hide">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            title={label}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap mobile-tap-target',
              activeTab === key ? 'bg-white text-brand-accent shadow-sm' : 'text-zinc-500'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded-full font-black',
                activeTab === key ? 'bg-brand-accent/10 text-brand-accent' : 'bg-zinc-200 text-zinc-500'
              )}
            >
              {key === 'products' ? catalogCount : key === 'consumables' ? consumableCount : knockdownCount}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder={`Search ${activeTab}…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          title={`Search ${activeTab}`}
          className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
        />
      </div>

      <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide px-0.5">
        {itemCount} {activeTab} in directory
      </p>

      {/* PRODUCTS / CONSUMABLES */}
      {activeTab !== 'knockdown' && (
        <>
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
              <p className="text-zinc-500 font-medium text-xs">Loading catalog items...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900 mt-3">Database Connection Problem</h3>
              <p className="text-xs text-zinc-500 mt-1.5">{error}</p>
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
                {activeTab === 'consumables' ? <ShoppingBag className="w-7 h-7" /> : <Package className="w-7 h-7" />}
              </div>
              <h3 className="text-base font-semibold text-zinc-900">
                No {activeTab === 'consumables' ? 'consumables' : 'products'} found
              </h3>
              <p className="text-xs text-zinc-500 mt-1.5">
                {searchQuery
                  ? 'No results match your search.'
                  : activeTab === 'consumables'
                    ? 'Add consumable items like stationery, cleaning supplies, or packaging materials.'
                    : 'Sync from existing invoices or add products manually.'}
              </p>
              {!searchQuery && activeTab === 'products' && (
                <button
                  onClick={onSyncInvoices}
                  title="Auto-Import From Existing Invoices"
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm mobile-tap-target"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Auto-Import From Invoices
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedProducts.map((p) => {
                const codeKey = p.stockCode.toLowerCase().trim();
                const onFloor = inventoryMap[codeKey] ?? 0;
                const ordered = unitsOrderedMap[codeKey] ?? 0;
                const compCount = (p.components ?? []).length;
                const actions = [
                  ...(activeTab === 'products'
                    ? [{ label: 'Link Components', icon: Link2, onClick: () => onOpenLinkComponents(p) }]
                    : []),
                  { label: 'Edit', icon: Edit2, onClick: () => handleOpenModal(p) },
                  { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDelete(p.id) },
                ];
                return (
                  <ProductCardRow
                    key={p.id}
                    stockCode={p.stockCode}
                    description={p.description}
                    unitPrice={p.unitPrice}
                    onFloor={onFloor}
                    ordered={ordered}
                    compCount={compCount}
                    showComponents={activeTab === 'products'}
                    actions={actions}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* KNOCKDOWN */}
      {activeTab === 'knockdown' && (
        <>
          {knockdownLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
              <p className="text-zinc-500 font-medium text-xs">Loading knockdown items...</p>
            </div>
          ) : paginatedKnockdown.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900">No knockdown items found</h3>
              <p className="text-xs text-zinc-500 mt-1.5">
                {searchQuery
                  ? 'No knockdown items match your search.'
                  : 'Add knockdown assemblies with their linked component parts.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => onOpenKnockdownSetup()}
                  title="Add Knockdown Product"
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold rounded-xl transition-all shadow-sm mobile-tap-target"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Knockdown Product
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedKnockdown.map((k) => {
                const codeKey = k.stockCode.toLowerCase().trim();
                const onFloor = inventoryMap[codeKey] ?? 0;
                const ordered = unitsOrderedMap[codeKey] ?? 0;

                if (deletingKnockdownId === k.id) {
                  return (
                    <div
                      key={k.id}
                      className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl animate-fade-in"
                    >
                      <span className="text-xs text-red-700 font-black uppercase font-mono flex-1">
                        Delete {k.stockCode}?
                      </span>
                      <button
                        type="button"
                        title="Confirm delete"
                        onClick={async () => {
                          await deleteStockItem(k.id);
                          setDeletingKnockdownId(null);
                        }}
                        className="px-3 py-2 bg-red-600 text-white text-[10px] font-mono font-black uppercase rounded-lg mobile-tap-target"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        title="Cancel delete"
                        onClick={() => setDeletingKnockdownId(null)}
                        className="px-3 py-2 bg-zinc-200 text-zinc-700 text-[10px] font-mono font-black uppercase rounded-lg mobile-tap-target"
                      >
                        No
                      </button>
                    </div>
                  );
                }

                const actions = [
                  { label: 'Edit', icon: Edit2, onClick: () => onOpenKnockdownSetup(k) },
                  { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeletingKnockdownId(k.id) },
                ];

                return (
                  <ProductCardRow
                    key={k.id}
                    stockCode={k.stockCode}
                    description={k.displayName || k.description}
                    subtitle={k.displayName && k.description !== k.displayName ? k.description : undefined}
                    onFloor={onFloor}
                    ordered={ordered}
                    actions={actions}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            title="Previous page"
            className="p-2 border border-zinc-200 rounded-lg disabled:opacity-40 bg-white text-zinc-600 transition-colors mobile-tap-target"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            title="Next page"
            className="p-2 border border-zinc-200 rounded-lg disabled:opacity-40 bg-white text-zinc-600 transition-colors mobile-tap-target"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add / Edit sheet */}
      <MobileSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Modify Details' : formData.category === 'consumable' ? 'Register Consumable' : 'Register Product'}
        subtitle={formData.category === 'consumable' ? 'Consumable Item' : 'Standard Product'}
        fullHeight={false}
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="Cancel"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold uppercase mobile-tap-target"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-mobile-form"
              title={editingProduct ? 'Save changes' : 'Create product'}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-brand-accent text-white rounded-xl text-xs font-bold uppercase shadow-md flex items-center justify-center gap-2 mobile-tap-target disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingProduct ? 'Save Changes' : 'Create'}
            </button>
          </div>
        }
      >
        <form id="product-mobile-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Stock Code</label>
            <input
              type="text"
              disabled={!!editingProduct}
              placeholder="e.g. WOOD-PANEL-M"
              required
              title="Stock code"
              value={formData.stockCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, stockCode: e.target.value }))}
              className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-zinc-50/30 font-mono disabled:opacity-60"
            />
            {!editingProduct && (
              <p className="text-[10px] text-zinc-400 leading-normal">
                Alphanumeric. Non-compliant characters auto-sanitize on save.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Description</label>
            <textarea
              placeholder="Detail item properties, materials or name"
              required
              title="Description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-zinc-50/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Unit Price (ZAR)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                title="Unit price"
                value={formData.unitPrice}
                onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: e.target.value }))}
                className="w-full pl-8 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-zinc-50/30"
              />
            </div>
          </div>
        </form>
      </MobileSheet>
    </div>
  );
}
