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
  ChevronRight
} from 'lucide-react';
import { useProducts, Product } from '../hooks/useProducts';
import { cn, formatCurrency } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ProductList() {
  const { 
    products, 
    loading, 
    error, 
    saveProduct, 
    updateProduct, 
    deleteProduct, 
    syncExistingInvoicesToProducts 
  } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Syncing status
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    stockCode: '',
    description: '',
    unitPrice: ''
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        stockCode: product.stockCode,
        description: product.description,
        unitPrice: product.unitPrice.toString()
      });
    } else {
      setEditingProduct(null);
      setFormData({
        stockCode: '',
        description: '',
        unitPrice: ''
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
        unitPrice: price
      });
    } else {
      await saveProduct({
        stockCode: formData.stockCode.trim(),
        description: formData.description.trim(),
        unitPrice: price
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

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

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
            Manage your unique standard items and stock descriptions linked to your account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSyncInvoices}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 font-semibold text-sm transition-all shadow-2xs cursor-pointer",
              isSyncing && "opacity-75 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-4 h-4 text-zinc-500", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing Invoices..." : "Sync From Invoices"}
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Sync Banner Status */}
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

      {/* Main Catalog View */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-6 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search products by code or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="text-xs font-medium text-zinc-500 flex items-center gap-2 shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Showing {filteredProducts.length} unique products in directory
          </div>
        </div>

        {/* Loading / Error States */}
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
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">No products found</h3>
            <p className="text-sm text-zinc-500 mt-1.5">
              {searchQuery ? "No results match your current search constraints." : "You have not registered any products yet. Import a PDF invoice or sync from invoices to automatically extract products!"}
            </p>
            {!searchQuery && (
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
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[180px]">Stock Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Product Description</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[150px]">Unit Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-6 py-4.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-zinc-100 rounded-md border border-zinc-200 text-zinc-800">
                        {p.stockCode}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <p className="text-sm font-semibold text-zinc-850 line-clamp-1">{p.description}</p>
                    </td>
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      <span className="font-mono text-sm font-bold text-zinc-900">
                        R {formatCurrency(p.unitPrice)}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="p-1.5 text-zinc-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
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
                ))}
              </tbody>
            </table>
          </div>
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
                className="p-1.5 border border-zinc-200 rounded-lg disabled:opacity-40 disabled:hover:bg-white bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-zinc-200 rounded-lg disabled:opacity-40 disabled:hover:bg-white bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Product Add/Edit Dialog Modal */}
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
                <h3 className="font-bold text-zinc-900 tracking-tight">
                  {editingProduct ? "Modify Product Details" : "Register New Product"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
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
                      Should be alphanumeric. Stock codes will auto-sanitize non-compliant characters on save.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Product Description</label>
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
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Standard Unit Price (ZAR)</label>
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
                    {editingProduct ? "Save Changes" : "Create Product"}
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
