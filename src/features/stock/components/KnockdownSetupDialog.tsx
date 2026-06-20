import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Trash2, Layers, HelpCircle, Check, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useInvoices } from '../../invoices/hooks/useInvoices';
import { useStock, StockPart } from '../hooks/useStock';
import { cn } from '../../../lib/utils';

interface KnockdownSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  defaultType?: 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take';
}

export function KnockdownSetupDialog({ isOpen, onClose, onSaveSuccess, defaultType }: KnockdownSetupDialogProps) {
  const { invoices } = useInvoices();
  const { saveStockItem } = useStock();

  // Mode Selection: 'invoice' | 'custom'
  const [mode, setMode] = useState<'invoice' | 'custom'>('invoice');

  // Input states for Main Stock Item
  const [stockCode, setStockCode] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take'>(defaultType || 'knockdown');

  // Linked Parts State
  const [parts, setParts] = useState<StockPart[]>([]);

  // Sub-form state for adding a linked part
  const [partCode, setPartCode] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [partQty, setPartQty] = useState<number>(1);

  // Search through invoice items
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Get a unique list of existing stock items from all invoices
  const uniqueInvoiceItems = useMemo(() => {
    const map = new Map<string, { stockCode: string; description: string; qty: number }>();
    invoices.forEach(inv => {
      inv.lineItems?.forEach(item => {
        if (item.stockCode) {
          const code = item.stockCode.trim();
          if (!map.has(code)) {
            map.set(code, {
              stockCode: code,
              description: item.description,
              qty: item.qty || 1
            });
          }
        }
      });
    });
    return Array.from(map.values());
  }, [invoices]);

  // Filter existing invoice items based on search query
  const filteredInvoiceItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return uniqueInvoiceItems.filter(item => 
      item.stockCode.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q)
    );
  }, [uniqueInvoiceItems, searchQuery]);

  // Populate from chosen invoice stock item
  const handleSelectInvoiceItem = (item: { stockCode: string; description: string; qty: number }) => {
    setStockCode(item.stockCode);
    setDescription(item.description);
    setQty(item.qty);
    setDisplayName(item.description || item.stockCode); // Default display name to description
    setShowSearchResults(false);
    setSearchQuery('');
  };

  // Switch modes cleanly
  const handleSetMode = (selectedMode: 'invoice' | 'custom') => {
    setMode(selectedMode);
    setStockCode('');
    setDescription('');
    setQty(1);
    setDisplayName('');
    setParts([]);
    setSearchQuery('');
    setErrorMsg(null);
  };

  // Add parts to list
  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partCode.trim() || !partDesc.trim()) {
      return;
    }

    const newPart: StockPart = {
      partCode: partCode.trim().toUpperCase(),
      description: partDesc.trim(),
      qty: Number(partQty) || 1
    };

    setParts(prev => [...prev, newPart]);

    // Reset sub-form
    setPartCode('');
    setPartDesc('');
    setPartQty(1);
  };

  // Remove elements from parts list
  const handleRemovePart = (index: number) => {
    setParts(prev => prev.filter((_, i) => i !== index));
  };

  // Save knockdown item
  const handleSave = async () => {
    setErrorMsg(null);
    if (!stockCode.trim()) {
      setErrorMsg("Stock Code is required.");
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg("Display Name is required.");
      return;
    }
    if (qty <= 0) {
      setErrorMsg("Quantity must be greater than zero.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveStockItem({
        stockCode: stockCode.trim().toUpperCase(),
        description: description.trim(),
        qty: Number(qty) || 1,
        displayName: displayName.trim(),
        type: type, // Matches standard knockdown | assembled | pre-assembled 
        parts: parts
      });

      if (result) {
        // Clear all fields
        setStockCode('');
        setDescription('');
        setQty(1);
        setDisplayName('');
        setParts([]);
        setType('knockdown');
        onSaveSuccess();
        onClose();
      } else {
        setErrorMsg("Failed to save. Confirmed credentials and database permissions are required.");
      }
    } catch (err: unknown) {
      setErrorMsg("An unexpected error occurred: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in text-zinc-900 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-200 shadow-2xl flex flex-col font-sans"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-150 flex items-center justify-between shrink-0 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/15">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-brand-primary">Knockdown Item Setup</h2>
              <p className="text-[11px] text-zinc-500 font-medium font-mono uppercase">Setup a knockdown stock item & define its linked parts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-zinc-150 border border-zinc-200 text-zinc-500 rounded-xl cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left leading-relaxed">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-150 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              {errorMsg}
            </div>
          )}

          {/* Setup Category Mode Switcher */}
          <div className="flex gap-2 p-1 bg-zinc-100/80 rounded-2xl border border-zinc-200 shrink-0">
            <button
              type="button"
              onClick={() => handleSetMode('invoice')}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                mode === 'invoice' 
                  ? "bg-white text-brand-primary shadow-xs" 
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              Load from Invoice Line Item
            </button>
            <button
              type="button"
              onClick={() => handleSetMode('custom')}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                mode === 'custom' 
                  ? "bg-white text-brand-primary shadow-xs" 
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              Create New Custom Item
            </button>
          </div>

          {/* Step 1: Search Existing Invoice Items (only visible under invoice load mode) */}
          {mode === 'invoice' && (
            <div className="space-y-2 relative">
              <label className="text-[11px] font-mono uppercase text-zinc-500 font-bold block">
                Search Invoice Line Items *
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Type to search stock code or description from uploaded invoices..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
                />
                
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                    aria-label="Clear search"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Results dropdown */}
              {showSearchResults && searchQuery.trim() && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-zinc-100 py-1">
                    {filteredInvoiceItems.length > 0 ? (
                      filteredInvoiceItems.map((item, index) => (
                        <button
                          key={`${item.stockCode}-${index}`}
                          type="button"
                          onClick={() => handleSelectInvoiceItem(item)}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-all flex items-start gap-3"
                        >
                          <div className="bg-brand-primary/5 p-1.5 rounded-lg border border-brand-primary/10 shrink-0 text-brand-primary font-mono text-[10px] font-bold">
                            {item.stockCode}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{item.description}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">Default Qty: {item.qty}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-center text-xs text-zinc-500 font-semibold flex items-center justify-center gap-2">
                        <HelpCircle className="w-4 h-4 text-zinc-400" />
                        No matching line items found in uploaded invoices.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Grid Layout containing Main Item Fields & Linked Parts Setup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Left side: Main Item configuration block */}
            <div className="space-y-4 p-5 rounded-2xl border border-zinc-200 bg-zinc-50/45">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary flex items-center gap-2 border-b border-zinc-200/50 pb-2 mb-2">
                <Sparkles className="w-4 h-4 text-brand-accent" />
                Main Stock Item Details
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">
                    Stock Code *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-brand-accent/15 bg-white"
                    value={stockCode}
                    onChange={(e) => setStockCode(e.target.value)}
                    placeholder="e.g. SLD-CAB-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent/15 bg-white"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Provide a recognizable human-readable name..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/15 bg-white resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter item description details here..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">
                    Configure Category tab
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-150/40 rounded-xl border border-zinc-200">
                    {(['knockdown', 'assembled', 'pre-assembled', 'stock-take'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={cn(
                          "py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center",
                          type === t 
                            ? "bg-white text-brand-primary border border-zinc-200/60 shadow-xs" 
                            : "text-zinc-500 hover:text-zinc-900"
                        )}
                      >
                        {t === 'knockdown' 
                          ? 'Knockdown' 
                          : t === 'assembled' 
                            ? 'Assembled' 
                            : t === 'pre-assembled' 
                              ? 'Pre-assembled' 
                              : 'Stock Take'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Linked Parts composition sub-form and preview */}
            <div className="space-y-4 p-5 rounded-2xl border border-zinc-200 bg-zinc-50/45 flex flex-col min-h-[300px]">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary flex items-center gap-2 border-b border-zinc-200/50 pb-2 mb-2 shrink-0">
                <Plus className="w-4 h-4 text-brand-accent" />
                Hook Custom Linked Parts *
              </h3>

              {/* Sub-form to Add a linked standard Part / build component */}
              <form onSubmit={handleAddPart} className="p-3 bg-white rounded-xl border border-zinc-150 space-y-3 shrink-0">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-brand-accent/10"
                      value={partCode}
                      onChange={(e) => setPartCode(e.target.value)}
                      placeholder="Part Code (e.g. SCRW-X8)"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/10"
                      value={partQty}
                      onChange={(e) => setPartQty(Number(e.target.value) || 1)}
                      placeholder="Qty"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/10"
                    value={partDesc}
                    onChange={(e) => setPartDesc(e.target.value)}
                    placeholder="Part Description e.g M4 Steel Screw..."
                    required
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-brand-primary hover:bg-zinc-850 text-white font-black text-[10px] uppercase rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Add
                  </button>
                </div>
              </form>

              {/* Connected parts preview items list */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-48 pr-1 mt-2">
                {parts.length > 0 ? (
                  parts.map((p, idx) => (
                    <div 
                      key={`${p.partCode}-${idx}`}
                      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-zinc-150 text-xs font-medium animate-fade-in"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-black bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-md shrink-0">
                          {p.partCode}
                        </span>
                        <div className="min-w-0">
                          <p className="text-zinc-900 truncate font-semibold leading-tight">{p.description}</p>
                          <p className="text-[9px] text-zinc-500 font-mono">Quantity: <strong className="text-zinc-800">{p.qty}</strong></p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all"
                        title="Delete part"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="h-full border border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400/80 mb-1 leading-none">No Parts Linked Yet</p>
                    <p className="text-[10px] max-w-[250px] leading-relaxed mx-auto text-zinc-400/70">
                      Use the sub-form above to register individual parts or component counts to build this item.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="px-6 py-4 border-t border-zinc-150 flex items-center justify-end gap-3 shrink-0 bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-650 font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-brand-primary hover:bg-zinc-850 active:scale-95 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            {isSaving ? (
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            )}
            Save knockdown item
          </button>
        </div>
      </motion.div>
    </div>
  );
}
