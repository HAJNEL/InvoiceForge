import { useState, useMemo, useEffect, FormEvent } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShoppingBag,
  ArrowUpRight,
  Upload,
  Link2
} from 'lucide-react';
import { useProducts, Product, ProductComponent } from '../hooks/useProducts';
import { useInvoices } from '../../invoices/hooks/useInvoices';
import { useStock } from '../../stock/hooks/useStock';
import { KnockdownSetupDialog } from '../../stock/components/KnockdownSetupDialog';
import { KnockdownSetupDialogMobile } from '../../stock/components/KnockdownSetupDialogMobile';
import { ProductImportDialog } from './ProductImportDialog';
import { ProductComponentsDialog } from './ProductComponentsDialog';
import { ProductListMobile } from './ProductListMobile';
import { ProductImportDialogMobile } from './ProductImportDialogMobile';
import { ProductComponentsDialogMobile } from './ProductComponentsDialogMobile';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '../../../hooks/useIsMobile';

type ActiveTab = 'products' | 'knockdown' | 'consumables';

const TABS: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
  { key: 'products', label: 'Products', icon: Package },
  { key: 'knockdown', label: 'Knockdown', icon: Layers },
  { key: 'consumables', label: 'Consumables', icon: ShoppingBag },
];

export function ProductList() {
  const {
    products,
    inventoryMap,
    loading,
    error,
    saveProduct,
    updateProduct,
    deleteProduct,
    syncExistingInvoicesToProducts
  } = useProducts();

  const { invoices } = useInvoices();
  const { stockItems, deleteStockItem, saveStockItem, loading: knockdownLoading } = useStock();
  const knockdownItems = useMemo(() => stockItems.filter(i => i.type === 'knockdown'), [stockItems]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isKnockdownSetupOpen, setIsKnockdownSetupOpen] = useState(false);
  const [editingKnockdownItem, setEditingKnockdownItem] = useState<import('../../stock/hooks/useStock').KnockdownItem | null>(null);
  const [deletingKnockdownId, setDeletingKnockdownId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [linkingProduct, setLinkingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    stockCode: '',
    description: '',
    unitPrice: '',
    category: 'product' as 'product' | 'consumable'
  });

  // Units ordered = sum of qty across active (non-delivered/invoiced) invoices per stockCode
  const unitsOrderedMap = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      const s = (inv.status || '').toLowerCase();
      if (s === 'invoiced' || s === 'delivered' || s === 'completed' || s === 'complete') return;
      (inv.lineItems || []).forEach(item => {
        const code = (item.stockCode || '').toLowerCase().trim();
        if (!code) return;
        map[code] = (map[code] || 0) + (Number(item.qty) || 0);
      });
    });
    return map;
  }, [invoices]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        stockCode: product.stockCode,
        description: product.description,
        unitPrice: product.unitPrice.toString(),
        category: product.category || 'product'
      });
    } else {
      setEditingProduct(null);
      setFormData({
        stockCode: '',
        description: '',
        unitPrice: '',
        category: activeTab === 'consumables' ? 'consumable' : 'product'
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
        category: formData.category
      });
    } else {
      await saveProduct({
        stockCode: formData.stockCode.trim(),
        description: formData.description.trim(),
        unitPrice: price,
        category: formData.category
      });
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleSyncInvoices = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await syncExistingInvoicesToProducts();
      setSyncMessage('Finished syncing products from all existing invoices!');
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setSyncMessage('Failed to sync. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const catalogProducts = useMemo(() =>
    products.filter(p => (p.category || 'product') === 'product'),
    [products]
  );

  const consumableProducts = useMemo(() =>
    products.filter(p => p.category === 'consumable'),
    [products]
  );

  const consumableStockItems = useMemo(() =>
    stockItems.filter(i => i.type === 'consumable'),
    [stockItems]
  );

  const allConsumables = useMemo(() =>
    [...consumableProducts, ...consumableStockItems],
    [consumableProducts, consumableStockItems]
  );

  const handleSaveComponents = async (productId: string, components: ProductComponent[]): Promise<boolean> => {
    return await updateProduct(productId, { components }) ?? false;
  };

  const activeList = activeTab === 'consumables' ? consumableProducts : catalogProducts;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeList.filter(p =>
      p.stockCode.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }, [activeList, searchQuery]);

  const filteredKnockdown = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return knockdownItems.filter(k =>
      k.stockCode.toLowerCase().includes(q) ||
      k.description.toLowerCase().includes(q) ||
      (k.displayName || '').toLowerCase().includes(q)
    );
  }, [knockdownItems, searchQuery]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeTab]);

  const totalPages = Math.ceil(
    (activeTab === 'knockdown' ? filteredKnockdown.length : filteredProducts.length) / itemsPerPage
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const paginatedKnockdown = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredKnockdown.slice(start, start + itemsPerPage);
  }, [filteredKnockdown, currentPage]);

  const showAddButton = activeTab !== 'knockdown';
  const itemCount = activeTab === 'knockdown' ? filteredKnockdown.length : filteredProducts.length;

  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        <ProductListMobile
          inventoryMap={inventoryMap}
          loading={loading}
          error={error}
          deleteProduct={deleteProduct}
          knockdownLoading={knockdownLoading}
          deleteStockItem={deleteStockItem}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          catalogCount={catalogProducts.length}
          consumableCount={consumableProducts.length}
          knockdownCount={knockdownItems.length}
          paginatedProducts={paginatedProducts}
          paginatedKnockdown={paginatedKnockdown}
          itemCount={itemCount}
          unitsOrderedMap={unitsOrderedMap}
          isSyncing={isSyncing}
          syncMessage={syncMessage}
          onSyncInvoices={handleSyncInvoices}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenKnockdownSetup={(item) => { setEditingKnockdownItem(item ?? null); setIsKnockdownSetupOpen(true); }}
          onOpenLinkComponents={(p) => setLinkingProduct(p)}
          saveProduct={saveProduct}
          updateProduct={updateProduct}
        />

        {/* Knockdown Product Setup Dialog (shared with stock/ — mobile variant) */}
        <KnockdownSetupDialogMobile
          isOpen={isKnockdownSetupOpen}
          onClose={() => { setIsKnockdownSetupOpen(false); setEditingKnockdownItem(null); }}
          onSaveSuccess={() => { setIsKnockdownSetupOpen(false); setEditingKnockdownItem(null); }}
          editItem={editingKnockdownItem ?? undefined}
        />

        <ProductImportDialogMobile
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          tab={activeTab}
          saveProduct={saveProduct}
          saveStockItem={saveStockItem}
        />

        {linkingProduct && (
          <ProductComponentsDialogMobile
            isOpen={!!linkingProduct}
            onClose={() => setLinkingProduct(null)}
            product={linkingProduct}
            knockdownItems={knockdownItems}
            consumableItems={allConsumables}
            onSave={handleSaveComponents}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-brand-accent shrink-0" />
            Catalog Products
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your standard items, knockdown assemblies, and consumable stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab !== 'knockdown' && (
            <button
              onClick={handleSyncInvoices}
              disabled={isSyncing}
              title="Sync products from invoices"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 font-semibold text-sm transition-all shadow-2xs cursor-pointer",
                isSyncing && "opacity-75 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4 text-zinc-500", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync From Invoices"}
            </button>
          )}

          <button
            onClick={() => setIsImportOpen(true)}
            title={`Import ${activeTab} from Excel`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 font-semibold text-sm transition-all shadow-2xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-zinc-500" />
            Import Excel
          </button>

          {showAddButton && (
            <button
              onClick={() => handleOpenModal()}
              title={activeTab === 'consumables' ? 'Add Consumable' : 'Add Product'}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'consumables' ? 'Add Consumable' : 'Add Product'}
            </button>
          )}

          {activeTab === 'knockdown' && (
            <button
              onClick={() => setIsKnockdownSetupOpen(true)}
              title="Add Knockdown Product"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Sync Banner */}
      {syncMessage && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl text-sm flex items-center gap-2 border",
            syncMessage.includes('Failed')
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}
        >
          {syncMessage.includes('Failed') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{syncMessage}</span>
        </motion.div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">

        {/* Tab Bar */}
        <div className="px-6 pt-5 pb-0 border-b border-zinc-200 bg-zinc-50/40">
          <div className="flex gap-0">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                title={label}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                  activeTab === key
                    ? "border-brand-accent text-brand-accent bg-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/60"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-black",
                  activeTab === key
                    ? "bg-brand-accent/10 text-brand-accent"
                    : "bg-zinc-200 text-zinc-500"
                )}>
                  {key === 'products' ? catalogProducts.length
                   : key === 'consumables' ? consumableProducts.length
                   : knockdownItems.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="text-xs font-medium text-zinc-500 flex items-center gap-2 shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            {itemCount} {activeTab} in directory
          </div>
        </div>

        {/* ── PRODUCTS / CONSUMABLES TAB ── */}
        {activeTab !== 'knockdown' && (
          <>
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                <p className="text-zinc-500 font-medium text-sm">Loading catalog items...</p>
              </div>
            ) : error ? (
              <div className="p-16 text-center max-w-lg mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
                <p className="text-sm text-zinc-500 mt-2">{error}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
                  {activeTab === 'consumables' ? <ShoppingBag className="w-8 h-8" /> : <Package className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  No {activeTab === 'consumables' ? 'consumables' : 'products'} found
                </h3>
                <p className="text-sm text-zinc-500 mt-1.5">
                  {searchQuery
                    ? "No results match your search."
                    : activeTab === 'consumables'
                      ? "Add consumable items like stationery, cleaning supplies, or packaging materials."
                      : "Sync from existing invoices or add products manually."}
                </p>
                {!searchQuery && activeTab === 'products' && (
                  <button
                    onClick={handleSyncInvoices}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Auto-Import From Existing Invoices
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200">
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[160px]">Stock Code</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Description</th>
                      {activeTab === 'products' && (
                        <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center w-[110px]">Components</th>
                      )}
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Units on Floor</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Units Ordered</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginatedProducts.map((p) => {
                      const codeKey = p.stockCode.toLowerCase().trim();
                      const onFloor = inventoryMap[codeKey] ?? 0;
                      const ordered = unitsOrderedMap[codeKey] ?? 0;
                      const compCount = (p.components ?? []).length;
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 bg-zinc-100 rounded-md border border-zinc-200 text-zinc-800">
                              {p.stockCode}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-zinc-850 line-clamp-1">{p.description}</p>
                          </td>
                          {activeTab === 'products' && (
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              {compCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-brand-accent bg-brand-accent/8 border border-brand-accent/20 px-2 py-0.5 rounded-full">
                                  <Link2 className="w-3 h-3" />
                                  {compCount}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-300 font-bold">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className={cn(
                              "inline-block font-black text-sm tabular-nums px-2.5 py-0.5 rounded-lg",
                              onFloor > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                            )}>
                              {onFloor}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 font-black text-sm tabular-nums px-2.5 py-0.5 rounded-lg",
                              ordered > 0
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                            )}>
                              {ordered > 0 && <ArrowUpRight className="w-3 h-3" />}
                              {ordered}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {activeTab === 'products' && (
                                <button
                                  onClick={() => setLinkingProduct(p)}
                                  className="p-1.5 text-zinc-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
                                  title="Link Components"
                                >
                                  <Link2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenModal(p)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── KNOCKDOWN TAB ── */}
        {activeTab === 'knockdown' && (
          <>
            {knockdownLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                <p className="text-zinc-500 font-medium text-sm">Loading knockdown items...</p>
              </div>
            ) : filteredKnockdown.length === 0 ? (
              <div className="p-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">No knockdown items found</h3>
                <p className="text-sm text-zinc-500 mt-1.5">
                  {searchQuery
                    ? "No knockdown items match your search."
                    : "Add knockdown assemblies with their linked component parts."}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsKnockdownSetupOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Knockdown Product
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200">
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[160px]">Stock Code</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Display Name</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[120px]">Type</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Units on Floor</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Units Ordered</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginatedKnockdown.map((k) => {
                      const codeKey = k.stockCode.toLowerCase().trim();
                      const onFloor = inventoryMap[codeKey] ?? 0;
                      const ordered = unitsOrderedMap[codeKey] ?? 0;
                      return (
                        <tr key={k.id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 bg-zinc-100 rounded-md border border-zinc-200 text-zinc-800">
                              {k.stockCode}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-zinc-850 line-clamp-1">
                              {k.displayName || k.description}
                            </p>
                            {k.displayName && k.description !== k.displayName && (
                              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{k.description}</p>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                              knockdown
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className={cn(
                              "inline-block font-black text-sm tabular-nums px-2.5 py-0.5 rounded-lg",
                              onFloor > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                            )}>
                              {onFloor}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 font-black text-sm tabular-nums px-2.5 py-0.5 rounded-lg",
                              ordered > 0
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                            )}>
                              {ordered > 0 && <ArrowUpRight className="w-3 h-3" />}
                              {ordered}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {deletingKnockdownId !== k.id && (
                                <button
                                  onClick={() => { setEditingKnockdownItem(k); setIsKnockdownSetupOpen(true); }}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Knockdown Item"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {deletingKnockdownId === k.id ? (
                                <div className="flex items-center gap-1 bg-red-50 py-1 px-2 rounded-xl border border-red-200 animate-fade-in">
                                  <span className="text-[9px] text-red-700 font-black uppercase font-mono mr-1">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={async () => { await deleteStockItem(k.id); setDeletingKnockdownId(null); }}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingKnockdownId(null)}
                                    className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingKnockdownId(k.id)}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Knockdown Product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                title="Previous page"
                className="p-1.5 border border-zinc-200 rounded-lg disabled:opacity-40 disabled:hover:bg-white bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                title="Next page"
                className="p-1.5 border border-zinc-200 rounded-lg disabled:opacity-40 disabled:hover:bg-white bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Knockdown Product Setup Dialog */}
      <KnockdownSetupDialog
        isOpen={isKnockdownSetupOpen}
        onClose={() => { setIsKnockdownSetupOpen(false); setEditingKnockdownItem(null); }}
        onSaveSuccess={() => { setIsKnockdownSetupOpen(false); setEditingKnockdownItem(null); }}
        editItem={editingKnockdownItem ?? undefined}
        defaultType="knockdown"
      />

      {/* Excel Import Dialog */}
      <ProductImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        tab={activeTab}
        saveProduct={saveProduct}
        saveStockItem={saveStockItem}
      />

      {/* Link Components Dialog */}
      {linkingProduct && (
        <ProductComponentsDialog
          isOpen={!!linkingProduct}
          onClose={() => setLinkingProduct(null)}
          product={linkingProduct}
          knockdownItems={knockdownItems}
          consumableItems={allConsumables}
          onSave={handleSaveComponents}
        />
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-200 bg-zinc-50/50">
                <div>
                  <h3 className="font-bold text-zinc-900 tracking-tight">
                    {editingProduct ? "Modify Details" : formData.category === 'consumable' ? "Register Consumable" : "Register Product"}
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-widest font-bold">
                    {formData.category === 'consumable' ? 'Consumable Item' : 'Standard Product'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  title="Close"
                  className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Stock Code</label>
                  <input
                    type="text"
                    disabled={!!editingProduct}
                    placeholder="e.g. WOOD-PANEL-M"
                    required
                    value={formData.stockCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, stockCode: e.target.value }))}
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
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                      value={formData.unitPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                      className="w-full pl-8 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-zinc-50/30"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/95 text-white text-sm font-semibold rounded-xl active:scale-98 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editingProduct ? "Save Changes" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
