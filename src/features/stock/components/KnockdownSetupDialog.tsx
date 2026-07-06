import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, HelpCircle, Check, ImagePlus, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { useInvoices } from '../../invoices/hooks/useInvoices';
import { useStock, KnockdownItem } from '../hooks/useStock';
import { cn } from '../../../lib/utils';

interface KnockdownSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  editItem?: KnockdownItem;
  defaultType?: 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take' | 'consumable';
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 300;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function KnockdownSetupDialog({ isOpen, onClose, onSaveSuccess, editItem }: KnockdownSetupDialogProps) {
  const { invoices } = useInvoices();
  const { saveStockItem } = useStock();

  const isEditing = !!editItem;

  const [mode, setMode] = useState<'invoice' | 'custom'>('invoice');
  const [stockCode, setStockCode] = useState('');
  const [description, setDescription] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate fields when opening for edit
  useEffect(() => {
    if (isOpen && editItem) {
      setStockCode(editItem.stockCode);
      setDisplayName(editItem.displayName);
      setDescription(editItem.description);
      setImageBase64(editItem.imageBase64 ?? null);
      setMode('custom');
      setErrorMsg(null);
    } else if (isOpen && !editItem) {
      setStockCode('');
      setDisplayName('');
      setDescription('');
      setImageBase64(null);
      setMode('invoice');
      setErrorMsg(null);
    }
  }, [isOpen, editItem]);

  const uniqueInvoiceItems = useMemo(() => {
    const map = new Map<string, { stockCode: string; description: string }>();
    invoices.forEach(inv => {
      inv.lineItems?.forEach(item => {
        if (item.stockCode) {
          const code = item.stockCode.trim();
          if (!map.has(code)) {
            map.set(code, { stockCode: code, description: item.description });
          }
        }
      });
    });
    return Array.from(map.values());
  }, [invoices]);

  const filteredInvoiceItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return uniqueInvoiceItems.filter(item =>
      item.stockCode.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }, [uniqueInvoiceItems, searchQuery]);

  const handleSelectInvoiceItem = (item: { stockCode: string; description: string }) => {
    setStockCode(item.stockCode);
    setDescription(item.description);
    setDisplayName(item.description || item.stockCode);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleSetMode = (m: 'invoice' | 'custom') => {
    setMode(m);
    setStockCode('');
    setDescription('');
    setDisplayName('');
    setSearchQuery('');
    setErrorMsg(null);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.');
      return;
    }
    setImageLoading(true);
    try {
      setImageBase64(await compressImage(file));
    } catch {
      setErrorMsg('Failed to process image.');
    } finally {
      setImageLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setErrorMsg(null);
    if (!stockCode.trim()) { setErrorMsg('Stock Code is required.'); return; }
    if (!displayName.trim()) { setErrorMsg('Display Name is required.'); return; }

    setIsSaving(true);
    try {
      const result = await saveStockItem({
        ...(editItem ? { id: editItem.id } : {}),
        stockCode: stockCode.trim().toUpperCase(),
        description: description.trim(),
        qty: editItem?.qty ?? 1,
        displayName: displayName.trim(),
        type: 'knockdown',
        parts: editItem?.parts ?? [],
        imageBase64: imageBase64 || undefined,
      });

      if (result) {
        onSaveSuccess();
        onClose();
      } else {
        setErrorMsg('Failed to save. Check database permissions.');
      }
    } catch (err) {
      setErrorMsg('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in text-zinc-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-lg border border-zinc-200 shadow-2xl flex flex-col font-sans overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600 border border-purple-200">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                {isEditing ? 'Edit Knockdown Item' : 'Add Knockdown Item'}
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono uppercase mt-0.5">
                {isEditing ? `Editing · ${editItem?.stockCode}` : 'Register a component part to the knockdown library'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close"
            className="p-1.5 hover:bg-zinc-100 border border-zinc-200 text-zinc-500 rounded-xl cursor-pointer transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Mode switcher — hidden when editing */}
          {!isEditing && (
            <div className="flex gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
              {(['invoice', 'custom'] as const).map((m) => (
                <button key={m} type="button" onClick={() => handleSetMode(m)}
                  className={cn(
                    'flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer',
                    mode === m ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-700'
                  )}>
                  {m === 'invoice' ? 'Load from Invoice' : 'Create Custom'}
                </button>
              ))}
            </div>
          )}

          {/* Invoice search */}
          {!isEditing && mode === 'invoice' && (
            <div className="relative">
              <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block mb-1.5">
                Search Invoice Line Items
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Stock code or description…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-zinc-50/50 transition-all"
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                    title="Clear" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {showSearchResults && searchQuery.trim() && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50 divide-y divide-zinc-100 py-1">
                    {filteredInvoiceItems.length > 0 ? filteredInvoiceItems.map((item, i) => (
                      <button key={i} type="button" onClick={() => handleSelectInvoiceItem(item)}
                        className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 transition-all flex items-start gap-3">
                        <span className="font-mono text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg shrink-0">
                          {item.stockCode}
                        </span>
                        <p className="text-xs font-medium text-zinc-800 truncate">{item.description}</p>
                      </button>
                    )) : (
                      <div className="px-4 py-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        No matching items in invoices
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">Stock Code *</label>
              <input type="text"
                className={cn(
                  'w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400',
                  isEditing ? 'bg-zinc-50 text-zinc-400 cursor-not-allowed' : 'bg-white'
                )}
                value={stockCode}
                onChange={(e) => !isEditing && setStockCode(e.target.value)}
                readOnly={isEditing}
                placeholder="e.g. 4-14-039"
              />
              {isEditing && (
                <p className="text-[9px] text-zinc-400">Stock code cannot be changed after creation.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">Display Name *</label>
              <input type="text"
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-white"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Top – 1000×400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">Description</label>
              <textarea rows={2}
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-white resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes or material details…"
              />
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">Image (optional)</label>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 cursor-pointer transition-all overflow-hidden',
                    imageBase64
                      ? 'border-purple-300 bg-transparent'
                      : 'border-zinc-300 bg-zinc-50 hover:border-purple-300 hover:bg-purple-50/30'
                  )}
                >
                  {imageLoading
                    ? <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    : imageBase64
                      ? <img src={imageBase64} alt="" className="w-full h-full object-cover" />
                      : <ImagePlus className="w-4 h-4 text-zinc-400" />
                  }
                </div>
                <div className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} title="Upload image"
                    className="px-3 py-1.5 border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 bg-white hover:bg-zinc-50 cursor-pointer flex items-center gap-1.5">
                    <ImagePlus className="w-3 h-3" />
                    {imageBase64 ? 'Replace' : 'Upload Image'}
                  </button>
                  {imageBase64 && (
                    <button type="button" onClick={() => setImageBase64(null)} title="Remove image"
                      className="px-3 py-1.5 border border-red-200 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3 shrink-0 bg-zinc-50/50">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
            {isSaving
              ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white shrink-0" />
              : <Check className="w-3.5 h-3.5 stroke-[3]" />
            }
            {isEditing ? 'Save Changes' : 'Save Item'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
