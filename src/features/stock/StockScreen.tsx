import { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle, 
  Boxes, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X,
  Shuffle, 
  PackageCheck, 
  Wrench,
  HelpCircle,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { useStock, KnockdownItem } from './hooks/useStock';
import { KnockdownSetupDialog } from './components/KnockdownSetupDialog';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export interface InvoiceRecord {
  id: string;
  invoice_number?: string;
  invoice_date?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  taxInvoice?: string;
  status?: string;
  schoolName?: string;
  customerName?: string;
  clientName?: string;
  client?: string;
  date?: string;
  issueDate?: string;
  number?: string;
  ship_to_details?: { name?: string; school_name?: string; schoolName?: string };
  shipToDetails?: { name?: string; schoolName?: string };
  bill_to_details?: { name?: string };
  billToDetails?: { name?: string };
  lineItems?: Array<{
    stockCode?: string;
    stock_code?: string;
    description?: string;
    qty?: number;
    quantity?: number;
  }>;
  line_items?: Array<{
    stock_code?: string;
    stockCode?: string;
    description?: string;
    quantity?: number;
    qty?: number;
  }>;
}

// Multi-item stock take representing grouped submission (saved in 'stock_takes' collection)
export interface JointStockTake {
  id: string;
  code: string;
  submittedBy: string;
  submittedByUserId: string;
  userId: string;
  submittedAt: string;
  status: string;
  items: {
    stockCode: string;
    description: string;
    isPart: boolean;
    parentItem?: string | null;
    countedQty: number;
    expectedQty: number;
    status: 'pending' | 'approved' | 'rejected';
  }[];
}

export interface InventoryItem {
  id: string;
  stockCode: string;
  description: string;
  displayName: string;
  qty: number;
  isPart?: boolean;
  parentItem?: string | null;
  createdAt?: string;
}

interface GroupableItem {
  stockCode: string;
  isPart?: boolean;
  parentItem?: string | null;
}

export function groupAndSortItems<T extends GroupableItem>(
  items: T[],
  knockdownList?: { stockCode: string; parts?: { partCode?: string; description?: string }[] }[]
): { groupCode: string; items: T[] }[] {
  const groupsMap: { [key: string]: T[] } = {};
  
  items.forEach(item => {
    let parentCode = (item.isPart && item.parentItem) ? item.parentItem.trim() : null;
    
    if (!parentCode && knockdownList) {
      const match = knockdownList.find(k => 
        k.parts?.some(p => (p.partCode || '').toLowerCase().trim() === item.stockCode.toLowerCase().trim())
      );
      if (match) {
        parentCode = match.stockCode.trim();
        item.isPart = true;
        item.parentItem = parentCode;
      }
    }
    
    const groupKey = parentCode || item.stockCode.trim() || 'NO_STOCK_CODE';
    
    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = [];
    }
    groupsMap[groupKey].push(item);
  });

  Object.keys(groupsMap).forEach(key => {
    groupsMap[key].sort((a, b) => {
      const aIsPart = !!a.isPart;
      const bIsPart = !!b.isPart;
      if (aIsPart === bIsPart) {
        return a.stockCode.localeCompare(b.stockCode);
      }
      return aIsPart ? 1 : -1;
    });
  });

  const grouped = Object.keys(groupsMap).map(groupCode => ({
    groupCode,
    items: groupsMap[groupCode]
  }));

  grouped.sort((a, b) => a.groupCode.localeCompare(b.groupCode));

  return grouped;
}

export function StockScreen() {
  const { stockItems, loading, error, deleteStockItem, updateTypeAndQty } = useStock();

  // Selected major tab: 'inventory' | 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take'
  const [activeTab, setActiveTab] = useState<'inventory' | 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take'>('inventory');
  
  // Selected subtab under Inventory tab
  const [inventorySubTab, setInventorySubTab] = useState<'current-stock' | 'invoice-builder' | 'missing-items' | 'extras'>('current-stock');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track expanded item ids for parts details list
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});

  // Setup knockdown dialog state
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Quick edit state (quantity)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState<number>(0);

  // Deletion state to avoid window.confirm blocking in iframe
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Quick edit state for approved inventory items (quantity)
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [editInvQtyValue, setEditInvQtyValue] = useState<number>(0);
  const [deletingInvId, setDeletingInvId] = useState<string | null>(null);

  // Stock take deletion state
  const [deletingTakeId, setDeletingTakeId] = useState<string | null>(null);

  // Custom states
  const { user } = useAuth();
  const [stockTakes, setStockTakes] = useState<JointStockTake[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingTakes, setLoadingTakes] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);

  // Expand states for stock takes in listing
  const [expandedTakeIds, setExpandedTakeIds] = useState<Record<string, boolean>>({});

  // Choose the status of invoices to find inventory for. Default to non-delivered/non-invoiced active ones.
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['draft', 'proposed']);

  // Segmented toggle under Invoice Builder: completed (stock met 100%) vs incomplete (some stock missing)
  const [builderFilter, setBuilderFilter] = useState<'completed' | 'incomplete'>('completed');

  // 1. Subscribe to submitted stock takes ('stock_takes' collection)
  useEffect(() => {
    if (!user) {
      setStockTakes([]);
      setLoadingTakes(false);
      return;
    }
    const q = query(
      collection(db, 'stock_takes'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JointStockTake[];
      
      // Sort in descending order of stock take code
      items.sort((a, b) => b.code.localeCompare(a.code));
      setStockTakes(items);
      setLoadingTakes(false);
    }, (err) => {
      console.error("Error subscribing to stock takes:", err);
      setLoadingTakes(false);
      handleFirestoreError(err, OperationType.LIST, 'stock_takes');
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Subscribe to approved inventory ('inventory' collection)
  useEffect(() => {
    if (!user) {
      setInventoryItems([]);
      setLoadingInv(false);
      return;
    }
    const q = query(
      collection(db, 'inventory'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setInventoryItems(items);
      setLoadingInv(false);
    }, (err) => {
      console.error("Error subscribing to inventory:", err);
      setLoadingInv(false);
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Subscribe to invoices to perform builder/missing calculations
  useEffect(() => {
    if (!user) {
      setInvoices([]);
      return;
    }
    const q = query(
      collection(db, 'invoices'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InvoiceRecord[];
      setInvoices(items);
    }, (err) => {
      console.error("Error subscribing to invoices:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Approve a single counted item within a stock take document
  const handleApproveItemInTake = async (take: JointStockTake, itemIndex: number) => {
    if (!user) return;
    try {
      const targetItem = take.items[itemIndex];
      
      // Find matching item in inventory
      const existingRef = query(
        collection(db, 'inventory'),
        where('userId', '==', user.uid),
        where('stockCode', '==', targetItem.stockCode),
        where('isPart', '==', !!targetItem.isPart)
      );
      const snap = await getDocs(existingRef);
      
      if (!snap.empty) {
        const docId = snap.docs[0].id;
        await updateDoc(doc(db, 'inventory', docId), {
          qty: targetItem.countedQty,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newId = doc(collection(db, 'inventory')).id;
        await setDoc(doc(db, 'inventory', newId), {
          stockCode: targetItem.stockCode,
          description: targetItem.description || '',
          isPart: !!targetItem.isPart,
          parentItem: targetItem.parentItem || null,
          displayName: targetItem.stockCode + ' - ' + (targetItem.description || ''),
          qty: targetItem.countedQty,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      }

      // Update the status of this item inside the stock take list
      const updatedItems = [...take.items];
      updatedItems[itemIndex] = { ...targetItem, status: 'approved' };
      
      const allDone = updatedItems.every(i => i.status !== 'pending');
      const nextStatus = allDone ? 'completed' : 'partially_completed';

      await updateDoc(doc(db, 'stock_takes', take.id), {
        items: updatedItems,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to approve item count:", err);
    }
  };

  // Reject a single counted item within a stock take document
  const handleRejectItemInTake = async (take: JointStockTake, itemIndex: number) => {
    if (!user) return;
    try {
      const targetItem = take.items[itemIndex];
      if (confirm(`Are you sure you want to reject the count for ${targetItem.stockCode}?`)) {
        const updatedItems = [...take.items];
        updatedItems[itemIndex] = { ...targetItem, status: 'rejected' };

        const allDone = updatedItems.every(i => i.status !== 'pending');
        const nextStatus = allDone ? 'completed' : 'partially_completed';

        await updateDoc(doc(db, 'stock_takes', take.id), {
          items: updatedItems,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Failed to reject item count:", err);
    }
  };

  const handleDeleteInventoryItem = async (invId: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', invId));
    } catch (err) {
      console.error("Failed to delete inventory item:", err);
    }
  };

  const handleDeleteStockTake = async (takeId: string) => {
    try {
      await deleteDoc(doc(db, 'stock_takes', takeId));
    } catch (err) {
      console.error("Failed to delete stock take:", err);
    }
  };

  const handleUpdateInventoryQty = async (invId: string, newQty: number) => {
    try {
      if (newQty < 0) return;
      await updateDoc(doc(db, 'inventory', invId), {
        qty: newQty,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update inventory qty:", err);
    }
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const toggleTakeExpanded = (takeId: string) => {
    setExpandedTakeIds(prev => ({
      ...prev,
      [takeId]: !prev[takeId]
    }));
  };

  // Filter items according to active tab and search query
  const filteredStockItems = useMemo(() => {
    let items = stockItems.filter(item => item.type === activeTab);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.stockCode.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    
    return items;
  }, [stockItems, activeTab, searchQuery]);

  // Extract knockdown list with explicit parts breakdown configuration
  const knockdownList = useMemo(() => {
    return stockItems.filter(i => i.type === 'knockdown');
  }, [stockItems]);

  // Find active outstanding invoices matching selected statuses
  const outstandingInvoices = useMemo(() => {
    return invoices.filter(inv => {
      let status = (inv.status || 'draft').toLowerCase().trim().replace(/\s+/g, '_');
      if (status === 'assembly') status = 'assembled';
      if (status === 'partially_completed') status = 'partially_complete';
      if (status === 'invoiced' || status === 'completed') status = 'complete';
      if (status === 'on-route' || status === 'on_route_') status = 'on_route';
      return selectedStatuses.includes(status);
    });
  }, [invoices, selectedStatuses]);

  // Count invoices per status group
  const invoiceCountsByStatus = useMemo(() => {
    const counts: { [key: string]: number } = {};
    invoices.forEach(inv => {
      let status = (inv.status || 'draft').toLowerCase().trim().replace(/\s+/g, '_');
      if (status === 'assembly') status = 'assembled';
      if (status === 'partially_completed') status = 'partially_complete';
      if (status === 'invoiced' || status === 'completed') status = 'complete';
      if (status === 'on-route' || status === 'on_route_') status = 'on_route';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [invoices]);

  // Map each outstanding invoice and calculate requirements against approved inventory stock
  const invoiceStockAnalyses = useMemo(() => {
    return outstandingInvoices.map(inv => {
      const reqs: { stockCode: string; description: string; qtyNeeded: number; isPart: boolean }[] = [];
      const items = inv.line_items || inv.lineItems || [];
      
      items.forEach((item: { stockCode?: string; stock_code?: string; description?: string; qty?: number; quantity?: number }) => {
        const code = (item.stockCode || item.stock_code || '').trim();
        const desc = (item.description || '').trim();
        const qty = item.qty || item.quantity || 0;
        
        // Find if this code constitutes a knockdown parent configured in knockdownList
        const matchingKD = knockdownList.find(
          k => k.stockCode.toLowerCase().trim() === code.toLowerCase().trim()
        );
        
        if (matchingKD && matchingKD.parts && matchingKD.parts.length > 0) {
          matchingKD.parts.forEach(part => {
            const partCode = (part.partCode || '').trim();
            const partDesc = (part.description || '').trim();
            const partQty = part.qty || 1;
            const totalNeededForThisItem = qty * partQty;
            
            const existing = reqs.find(r => r.stockCode.toLowerCase() === partCode.toLowerCase() && r.isPart);
            if (existing) {
              existing.qtyNeeded += totalNeededForThisItem;
            } else {
              reqs.push({
                stockCode: partCode,
                description: partDesc,
                qtyNeeded: totalNeededForThisItem,
                isPart: true
              });
            }
          });
        } else {
          // Standard product item
          const existing = reqs.find(r => r.stockCode.toLowerCase() === code.toLowerCase() && !r.isPart);
          if (existing) {
            existing.qtyNeeded += qty;
          } else {
            reqs.push({
              stockCode: code,
              description: desc,
              qtyNeeded: qty,
              isPart: false
            });
          }
        }
      });
      
      let allMet = true;
      const details = reqs.map(req => {
        const invItem = inventoryItems.find(
          ii => ii.stockCode.toLowerCase() === req.stockCode.toLowerCase() && !!ii.isPart === !!req.isPart
        );
        const inStock = invItem ? (invItem.qty || 0) : 0;
        const met = inStock >= req.qtyNeeded;
        if (!met) allMet = false;
        
        return {
          ...req,
          qtyInStock: inStock,
          met,
          deficit: Math.max(0, req.qtyNeeded - inStock)
        };
      });
      
      return {
        id: inv.id,
        invoiceNumber: inv.taxInvoice || inv.invoiceNumber || inv.invoice_number || inv.number || 'N/A',
        invoiceDate: inv.invoice_date || inv.invoiceDate || inv.date || inv.issueDate || 'N/A',
        clientName: inv.schoolName || inv.customerName || inv.clientName || inv.client || inv.ship_to_details?.school_name || inv.ship_to_details?.name || inv.shipToDetails?.schoolName || inv.shipToDetails?.school_name || inv.bill_to_details?.name || inv.billToDetails?.name || 'Unknown Client',
        requirements: details,
        canComplete: allMet && details.length > 0
      };
    });
  }, [outstandingInvoices, knockdownList, inventoryItems]);

  // Aggregate total active demands for each unique product key
  const totalOutstandingDemands = useMemo(() => {
    const demMap: { [key: string]: number } = {};
    invoiceStockAnalyses.forEach(analysis => {
      analysis.requirements.forEach(req => {
        const key = `${req.stockCode.toLowerCase()}_${req.isPart}`;
        demMap[key] = (demMap[key] || 0) + req.qtyNeeded;
      });
    });
    return demMap;
  }, [invoiceStockAnalyses]);

  // Compute surplus inventory items (Extras subtab)
  const extrasList = useMemo(() => {
    return inventoryItems.map(item => {
      const key = `${item.stockCode.toLowerCase()}_${!!item.isPart}`;
      const demand = totalOutstandingDemands[key] || 0;
      const surplus = item.qty - demand;
      
      return {
        ...item,
        demand,
        surplus,
        isExtra: surplus > 0 || demand === 0
      };
    }).filter(i => i.isExtra);
  }, [inventoryItems, totalOutstandingDemands]);

  // Counts for each major tab type
  const counts = useMemo(() => {
    return {
      inventory: inventoryItems.length,
      knockdown: stockItems.filter(i => i.type === 'knockdown').length,
      assembled: stockItems.filter(i => i.type === 'assembled').length,
      'pre-assembled': stockItems.filter(i => i.type === 'pre-assembled').length,
      'stock-take': stockTakes.length,
    };
  }, [stockItems, inventoryItems, stockTakes]);

  const handleDeleteItem = async (itemId: string) => {
    await deleteStockItem(itemId);
  };

  const handleMoveCategory = async (itemId: string, newType: KnockdownItem['type']) => {
    await updateTypeAndQty(itemId, { type: newType });
  };

  const startEditQty = (item: KnockdownItem) => {
    setEditingItemId(item.id);
    setEditQtyValue(item.qty);
  };

  const saveEditQty = async (itemId: string) => {
    if (editQtyValue <= 0) return;
    await updateTypeAndQty(itemId, { qty: editQtyValue });
    setEditingItemId(null);
  };

  return (
    <div className="space-y-6 text-zinc-900 font-sans tracking-tight">
      {/* Top Banner & Setup Trigger Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1 text-left">
          <h1 className="text-xl font-black uppercase tracking-wider text-brand-primary flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-accent stroke-[2.5]" />
            Stock Inventory
          </h1>
          <p className="text-xs text-zinc-500 font-mono uppercase">Setup and manage your parts, components and structural stock list</p>
        </div>
        
        <button
          type="button"
          onClick={() => setIsSetupOpen(true)}
          className="px-5 py-3 bg-brand-primary hover:bg-zinc-850 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Knockdown Item Setup
        </button>
      </div>

      {/* Tabs list with counts & Search Row */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm shrink-0">
        
        {/* Tab List */}
        <div className="flex flex-wrap gap-2 p-1 bg-zinc-100 rounded-xl border border-zinc-200 shrink-0 self-start">
          {(['inventory', 'knockdown', 'assembled', 'pre-assembled', 'stock-take'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const tabLabel = tab === 'inventory' ? 'Inventory' : tab === 'knockdown' ? 'Knockdown' : tab === 'assembled' ? 'Assembled' : tab === 'pre-assembled' ? 'Pre-assembled' : 'Stock Take';
            const count = counts[tab];
            
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setEditingItemId(null);
                }}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer",
                  isActive
                    ? "bg-white text-brand-primary border border-zinc-250 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {tabLabel}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[9px] font-mono leading-none border font-black",
                  isActive 
                    ? "bg-brand-primary/15 text-brand-primary border-brand-primary/20" 
                    : "bg-zinc-200 text-zinc-600 border-zinc-300"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Separator line */}
        <div className="border-t border-zinc-100 w-full" />

        {/* Search Input Filter - Stacked clearly below the tabs */}
        <div className="relative w-full max-w-md shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search stock code or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-left font-medium"
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stock list container */}
      {loading || (activeTab === 'stock-take' && loadingTakes) || (activeTab === 'inventory' && loadingInv) ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary shrink-0" />
          <p className="text-xs text-zinc-500 font-mono uppercase font-semibold">Synchronizing stock directory...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-250 rounded-2xl text-red-700 text-xs font-medium flex items-center gap-2 leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>Failed to synchronize: {error}</span>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="space-y-6">
          {/* Secondary tabs for Inventory with top-right status filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'current-stock', label: 'Current Stock', icon: Boxes },
                { id: 'invoice-builder', label: 'Invoice Builder', icon: CheckCircle2 },
                { id: 'missing-items', label: 'Missing Items', icon: AlertTriangle },
                { id: 'extras', label: 'Extras', icon: TrendingUp }
              ].map(sub => {
                const SubIcon = sub.icon;
                const isSubActive = inventorySubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setInventorySubTab(sub.id as 'current-stock' | 'invoice-builder' | 'missing-items' | 'extras')}
                    className={cn(
                      "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 border cursor-pointer",
                      isSubActive
                        ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                        : "bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-zinc-200"
                    )}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {/* Repositioned Invoice status filters (Shown at top-right, Draft & Proposed only) */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 p-1 rounded-2xl shrink-0 self-start md:self-auto shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-2 select-none">
                Invoices:
              </span>
              {[
                { key: 'draft', label: 'Draft', color: 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200' },
                { key: 'proposed', label: 'Proposed', color: 'bg-amber-100/60 border-amber-200 text-amber-800 hover:bg-amber-100' }
              ].map((s) => {
                const isSelected = selectedStatuses.includes(s.key);
                const count = invoiceCountsByStatus[s.key] || 0;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatuses(prev => {
                        if (prev.includes(s.key)) {
                          return prev.filter(x => x !== s.key);
                        } else {
                          return [...prev, s.key];
                        }
                      });
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border text-[10px] font-sans transition-all flex items-center gap-1.5 cursor-pointer font-bold",
                      isSelected 
                        ? s.color + " ring-1 ring-brand-primary/15 border-transparent shadow-2xs" 
                        : "bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    )}
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      isSelected ? "bg-current scale-100" : "bg-zinc-300 scale-75"
                    )} />
                    <span>{s.label}</span>
                    <span className={cn(
                      "px-1 py-0.2 rounded-md font-mono text-[9px] font-black border transition-all",
                      isSelected ? "bg-white/85 border-transparent text-current" : "bg-zinc-50 border-zinc-200 text-zinc-500"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Stock Subtab */}
          {inventorySubTab === 'current-stock' && (
            inventoryItems.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const filtered = inventoryItems.filter(item => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return item.stockCode.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
                  });
                  const grouped = groupAndSortItems<InventoryItem>(filtered, knockdownList);

                  if (grouped.length === 0) {
                    return (
                      <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400">
                        No matching inventory items found.
                      </div>
                    );
                  }

                  return grouped.map((group) => (
                    <div key={group.groupCode} className="border border-zinc-200 rounded-3xl p-5 bg-zinc-50/20 space-y-3">
                      <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-150">
                        <span className="text-[10px] font-mono font-black uppercase text-zinc-400 tracking-wider">Stock Group:</span>
                        <span className="font-mono text-xs font-black uppercase bg-zinc-900 text-white px-2.5 py-0.5 rounded-lg">
                          {group.groupCode}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((item) => (
                          <div key={item.id} className="bg-white rounded-3xl border border-zinc-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left shadow-sm">
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-2 pb-1 flex-wrap">
                                <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-150 text-emerald-750 px-2.5 py-0.5 rounded-lg">
                                  {item.stockCode}
                                </span>
                                {item.isPart ? (
                                  <span className="text-[9px] text-purple-700 bg-purple-50 border border-purple-200 font-sans tracking-wide uppercase px-2 py-0.5 rounded font-black">
                                    Knockdown Part
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-zinc-500 bg-zinc-50 border border-zinc-200 font-sans tracking-wide uppercase px-2 py-0.5 rounded font-black">
                                    Standard Item
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-black text-brand-primary leading-tight uppercase mt-1">
                                {item.description || item.stockCode}
                              </h3>

                              {/* Stock progress bar showing how many stock available vs how many expected/needed based on selected invoices */}
                              {(() => {
                                const itemKey = `${item.stockCode.toLowerCase()}_${!!item.isPart}`;
                                const demand = totalOutstandingDemands[itemKey] || 0;
                                
                                // Determine stock compliance status
                                let stockStatus: 'under' | 'perfect' | 'over';
                                if (demand > 0) {
                                  if (item.qty < demand) {
                                    stockStatus = 'under';
                                  } else if (item.qty === demand) {
                                    stockStatus = 'perfect';
                                  } else {
                                    stockStatus = 'over';
                                  }
                                } else {
                                  stockStatus = 'perfect';
                                }

                                // Calculate the clip-path progression
                                // Live progress reaches 100% when demand matches the stock
                                let progressWidth: number;
                                if (demand > 0) {
                                  if (stockStatus === 'under') {
                                    progressWidth = Math.max(7, Math.min(99, Math.round((item.qty / demand) * 100)));
                                  } else {
                                    progressWidth = 100;
                                  }
                                } else {
                                  progressWidth = item.qty > 0 ? 100 : 0;
                                }
                                
                                const textColor = stockStatus === 'under'
                                  ? "text-red-600 font-bold"
                                  : stockStatus === 'perfect'
                                    ? "text-emerald-600 font-bold"
                                    : "text-orange-600 font-bold";

                                const statusLabel = stockStatus === 'under'
                                  ? "Not Enough Stock"
                                  : stockStatus === 'perfect'
                                    ? "Right Amount"
                                    : "Overstock";

                                const gradient = stockStatus === 'over'
                                  ? 'linear-gradient(to right, #f23d18 0%, #f47b20 25%, #fdb813 50%, #46bd45 75%, #ea580c 100%)'
                                  : 'linear-gradient(to right, #f23d18 0%, #f47b20 30%, #fdb813 65%, #46bd45 100%)';

                                return (
                                  <div className="mt-3.5 max-w-md bg-zinc-50 border border-zinc-150 rounded-2xl p-3 text-left">
                                    <div className="flex justify-between items-center mb-1.5 text-[11px] font-sans">
                                      <span className="font-black text-zinc-400 uppercase tracking-wider text-[10px]">
                                        Invoice Demand Progress:
                                      </span>
                                      <span className={textColor}>
                                        {statusLabel} ({demand > 0 ? `${item.qty} of ${demand}` : `${item.qty} available`})
                                      </span>
                                    </div>
                                    <div className="w-full bg-zinc-100 h-3.5 rounded-full overflow-hidden relative shadow-inner border border-zinc-200/50">
                                      <div 
                                        className="h-full rounded-full transition-all duration-500 absolute inset-0 w-full" 
                                        style={{ 
                                          clipPath: `inset(0 ${100 - progressWidth}% 0 0)`,
                                          WebkitClipPath: `inset(0 ${100 - progressWidth}% 0 0)`,
                                          background: gradient
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex items-center flex-wrap gap-4 justify-end sm:shrink-0">
                              {/* Inline Quantity editing block */}
                              <div>
                                {editingInvId === item.id ? (
                                  <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-205">
                                    <input
                                      type="number"
                                      min="0"
                                      value={editInvQtyValue}
                                      onChange={(e) => setEditInvQtyValue(Number(e.target.value) || 0)}
                                      className="w-14 px-2 py-1 text-xs font-bold font-sans text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                                    />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await handleUpdateInventoryQty(item.id, editInvQtyValue);
                                        setEditingInvId(null);
                                      }}
                                      className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg border border-transparent hover:border-emerald-150 transition-all cursor-pointer"
                                      title="Save quantity"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInvId(null)}
                                      className="p-1 hover:bg-zinc-150 text-zinc-405 rounded-lg transition-all cursor-pointer"
                                      title="Cancel edits"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div 
                                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-100 text-emerald-800 font-sans text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                                    onClick={() => {
                                      setEditingInvId(item.id);
                                      setEditInvQtyValue(item.qty);
                                    }}
                                    title="Click to change quantity available"
                                  >
                                    <span className="text-emerald-600/90 font-mono font-bold uppercase tracking-wide">Available:</span>
                                    <strong className="font-sans font-black text-sm">{item.qty}</strong>
                                  </div>
                                )}
                              </div>

                              {/* Actions panel with inline confirmation */}
                              <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                                {deletingInvId === item.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 py-1 px-2 rounded-xl border border-red-205 animate-fade-in shrink-0">
                                    <span className="text-[9px] text-red-700 font-black uppercase font-mono mr-1">Delete?</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await handleDeleteInventoryItem(item.id);
                                        setDeletingInvId(null);
                                      }}
                                      className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer shadow-xs"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingInvId(null)}
                                      className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingInvId(item.id)}
                                    className="p-1.5 hover:bg-red-50 hover:text-red-650 border border-transparent hover:border-red-150 text-zinc-405 rounded-xl transition-all cursor-pointer"
                                    title="Delete approved stock item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-8 space-y-4 shadow-sm animate-fade-in">
                <Boxes className="w-12 h-12 text-zinc-300 stroke-[1.5]" />
                <h3 className="text-sm font-black text-zinc-700 uppercase tracking-wider leading-none">Inventory Is Empty</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  No approved stock items have been logged yet. Complete a stock take on key categories, submit counts, and approve them to populate the master catalog here.
                </p>
              </div>
            )
          )}

          {/* Invoice Builder Subtab */}
          {inventorySubTab === 'invoice-builder' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-2xl text-left">
                <p className="text-[11px] font-sans text-emerald-800 font-bold uppercase tracking-wider">💡 Feasibility Assessment Engine</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed font-sans">
                  Identify exactly which invoices can be constructed or are missing stock from the active inventory catalog. Select to toggle between completeable and incomplete invoices below.
                </p>
              </div>

              {/* Segmented control for toggling completed vs incomplete */}
              <div className="flex bg-zinc-100 p-1 rounded-2xl max-w-sm">
                <button
                  type="button"
                  onClick={() => setBuilderFilter('completed')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold",
                    builderFilter === 'completed'
                      ? "bg-white text-emerald-800 border border-zinc-200/55 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  Completed ({invoiceStockAnalyses.filter(a => a.canComplete).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderFilter('incomplete')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer font-bold",
                    builderFilter === 'incomplete'
                      ? "bg-white text-amber-800 border border-zinc-200/55 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  Incomplete ({invoiceStockAnalyses.filter(a => !a.canComplete).length})
                </button>
              </div>

              {builderFilter === 'completed' ? (
                /* Completed Invoices List */
                invoiceStockAnalyses.filter(a => a.canComplete).length > 0 ? (
                  <div className="space-y-3">
                    {invoiceStockAnalyses.filter(a => a.canComplete).map(analysis => (
                      <div key={analysis.id} className="bg-white border border-zinc-200 rounded-3xl p-5 text-left shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 text-left flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black bg-zinc-900 text-white px-2.5 py-0.5 rounded font-black">
                              {analysis.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono font-semibold">
                              Date: {analysis.invoiceDate}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-zinc-805 uppercase mt-1">
                            {analysis.clientName}
                          </h3>
                          <div className="pt-2 flex flex-wrap gap-1.5">
                            {analysis.requirements.map((req, rIdx) => (
                              <span key={rIdx} className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1">
                                {req.stockCode} ({req.qtyNeeded} needed / {req.qtyInStock} in stock)
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="bg-emerald-500 text-white font-black text-[10px] uppercase font-sans tracking-wide px-3.5 py-1.5 rounded-2xl flex items-center gap-1">
                            <Check className="w-4 h-4 stroke-[3]" /> Ready to Assemble
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-8 space-y-3 shadow-xs">
                    <CheckCircle2 className="w-12 h-12 text-zinc-300 stroke-[1.5]" />
                    <p className="text-xs font-black text-zinc-650 uppercase tracking-wider">No completeable invoices</p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      We could not find any invoices of selected statuses where 100% of required stock is currently approved in your inventory.
                    </p>
                  </div>
                )
              ) : (
                /* Incomplete Invoices List */
                invoiceStockAnalyses.filter(a => !a.canComplete).length > 0 ? (
                  <div className="space-y-3">
                    {invoiceStockAnalyses.filter(a => !a.canComplete).map(analysis => (
                      <div key={analysis.id} className="bg-white border border-zinc-200 rounded-3xl p-5 text-left shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 text-left flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black bg-zinc-900 text-white px-2.5 py-0.5 rounded font-black">
                              {analysis.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono font-semibold">
                              Date: {analysis.invoiceDate}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-zinc-805 uppercase mt-1">
                            {analysis.clientName}
                          </h3>
                          <div className="pt-2 flex flex-wrap gap-1.5">
                            {analysis.requirements.map((req, rIdx) => {
                              const isMet = req.qtyInStock >= req.qtyNeeded;
                              return (
                                <span
                                  key={rIdx}
                                  className={cn(
                                    "text-[10px] font-mono border rounded-lg px-2.5 py-1",
                                    isMet 
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-250" 
                                      : "bg-red-50 text-red-800 border-red-200 font-medium"
                                  )}
                                >
                                  {req.stockCode} ({req.qtyInStock} / {req.qtyNeeded} {isMet ? 'met' : `missing ${req.deficit}`})
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="bg-amber-500 text-white font-black text-[10px] uppercase font-sans tracking-wide px-3.5 py-1.5 rounded-2xl flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 stroke-[2.5]" /> Deficit Exists
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-8 space-y-3 shadow-xs">
                    <CheckCircle2 className="w-12 h-12 text-zinc-300 stroke-[1.5]" />
                    <p className="text-xs font-black text-zinc-650 uppercase tracking-wide">All invoices can be completed!</p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Amazing! All of your analyzed invoices are fully feasible to construct with current warehouse stock levels.
                    </p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Missing Items Subtab */}
          {inventorySubTab === 'missing-items' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-250 rounded-2xl text-left">
                <p className="text-[11px] font-sans text-amber-800 font-bold uppercase tracking-wider">🚨 Material Shortfall tracker</p>
                <p className="text-xs text-amber-700 mt-1 font-sans">
                  The following active invoices are **short on physical inventory**. Review the specific line item deficits and progress meters below:
                </p>
              </div>

              {invoiceStockAnalyses.filter(a => !a.canComplete).length > 0 ? (
                <div className="space-y-4">
                  {invoiceStockAnalyses.filter(a => !a.canComplete).map(analysis => (
                    <div key={analysis.id} className="bg-white border border-zinc-200 rounded-3xl p-5 text-left shadow-xs space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black bg-zinc-900 text-white px-2.5 py-0.5 rounded">
                              {analysis.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono font-semibold uppercase">
                              Date: {analysis.invoiceDate}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-brand-primary uppercase mt-1">
                            {analysis.clientName}
                          </h3>
                        </div>
                        <div className="shrink-0">
                          <span className="bg-rose-50 border border-rose-200 text-rose-700 font-sans font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-full">
                            Shortfall - Stock Deficit Exists
                          </span>
                        </div>
                      </div>

                      {/* Requirements Progress bars */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysis.requirements
                          .filter(req => req.deficit > 0)
                          .map((req, rIdx) => {
                            const pct = req.qtyNeeded > 0 ? Math.min(100, (req.qtyInStock / req.qtyNeeded) * 100) : 100;
                            return (
                              <div key={rIdx} className="bg-zinc-50 border border-zinc-150 rounded-2xl p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2 text-xs">
                                  <div className="min-w-0 text-left">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-black uppercase text-zinc-700 bg-zinc-200 px-1.5 py-0.5 rounded border border-zinc-250">
                                        {req.stockCode}
                                      </span>
                                      <span className="text-[9px] font-bold text-amber-700 font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase">
                                        Invoice #{analysis.invoiceNumber}
                                      </span>
                                    </div>
                                    <p className="text-[11px] font-medium text-zinc-700 truncate mt-1">
                                      {req.description}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-sans font-black text-amber-600">{req.qtyInStock}</span>
                                    <span className="text-zinc-450 font-bold"> / {req.qtyNeeded}</span>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-300 bg-rose-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>

                                {/* Deficit Badge */}
                                <div className="flex justify-between items-center pt-1 text-[9px] font-mono leading-none">
                                  <span className="text-zinc-500 font-semibold uppercase">
                                    {req.isPart ? "Component Part" : "Standard Item"}
                                  </span>
                                  <span className="text-red-700 font-black uppercase bg-red-50 border border-red-150 px-1.5 py-0.5 rounded">
                                    Missing: {req.deficit} units
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400 font-mono">
                  No active outstanding invoices found. All items accounted for.
                </div>
              )}
            </div>
          )}

          {/* Extras Subtab */}
          {inventorySubTab === 'extras' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-250 rounded-2xl text-left">
                <p className="text-[11px] font-sans text-purple-800 font-bold uppercase tracking-wider">☘️ Surplus & Extra inventory ledger</p>
                <p className="text-xs text-purple-700 mt-1">
                  The following approved inventory stock items **exceed the total volume demanded** on all active outstanding invoices, or don't form part of any active invoice:
                </p>
              </div>

              {extrasList.length > 0 ? (
                <div className="space-y-3">
                  {extrasList.map((item) => (
                    <div key={item.id} className="bg-white rounded-3xl border border-zinc-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 pb-1 flex-wrap">
                          <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-purple-50 border border-purple-150 text-purple-700 px-2.5 py-0.5 rounded-lg">
                            {item.stockCode}
                          </span>
                          <span className="text-[9px] text-zinc-500 bg-zinc-50 border border-zinc-200 font-sans tracking-wide uppercase px-2 py-0.5 rounded font-black">
                            Total Demand: {item.demand} units
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-brand-primary leading-tight uppercase mt-1">
                          {item.description || item.stockCode}
                        </h3>
                      </div>
                      <div className="flex items-center flex-wrap gap-4 justify-end sm:shrink-0">
                        {/* Inline Quantity editing block */}
                        <div>
                          {editingInvId === item.id ? (
                            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-205">
                              <input
                                type="number"
                                min="0"
                                value={editInvQtyValue}
                                onChange={(e) => setEditInvQtyValue(Number(e.target.value) || 0)}
                                className="w-14 px-2 py-1 text-xs font-bold font-sans text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleUpdateInventoryQty(item.id, editInvQtyValue);
                                  setEditingInvId(null);
                                }}
                                className="p-1 hover:bg-purple-50 text-purple-600 rounded-lg border border-transparent hover:border-purple-150 transition-all cursor-pointer"
                                title="Save quantity"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInvId(null)}
                                className="p-1 hover:bg-zinc-150 text-zinc-405 rounded-lg transition-all cursor-pointer"
                                title="Cancel edits"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 rounded-2xl border border-purple-100 text-purple-800 font-sans text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                              onClick={() => {
                                setEditingInvId(item.id);
                                setEditInvQtyValue(item.qty);
                              }}
                              title="Click to change quantity available"
                            >
                              <span className="text-purple-650 font-mono font-bold uppercase tracking-wide">Surplus Stock:</span>
                              <strong className="font-sans font-black text-sm">+{item.surplus}</strong>
                            </div>
                          )}
                        </div>

                        {/* Actions panel with inline confirmation */}
                        <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                          {deletingInvId === item.id ? (
                            <div className="flex items-center gap-1 bg-red-50 py-1 px-2 rounded-xl border border-red-205 animate-fade-in shrink-0">
                              <span className="text-[9px] text-red-700 font-black uppercase font-mono mr-1">Delete?</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleDeleteInventoryItem(item.id);
                                  setDeletingInvId(null);
                                }}
                                className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer shadow-xs"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingInvId(null)}
                                className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingInvId(item.id)}
                              className="p-1.5 hover:bg-red-50 hover:text-red-650 border border-transparent hover:border-red-150 text-zinc-405 rounded-xl transition-all cursor-pointer"
                              title="Delete approved surplus item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-8 space-y-3 shadow-xs font-sans">
                  <Boxes className="w-12 h-12 text-purple-300 stroke-[1.5]" />
                  <p className="text-xs font-black text-zinc-650 uppercase tracking-wider">No surplus extra inventory</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Physical inventory levels represent an exact match with outstanding invoice order demands. No extra surplus components are logged!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'stock-take' ? (
        stockTakes.length > 0 ? (
          <div className="space-y-4">
            {stockTakes
              .filter(take => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return take.code.includes(q) || take.submittedBy.toLowerCase().includes(q) || take.items?.some(i => i.stockCode.toLowerCase().includes(q));
              })
              .map((take) => {
                const isExpanded = expandedTakeIds[take.id] || false;
                const pendingCount = (take.items || []).filter(i => i.status === 'pending').length;
                
                return (
                  <div key={take.id} className="bg-white rounded-3xl border border-zinc-200 hover:border-zinc-250 shadow-sm transition-all overflow-hidden text-left">
                    {/* Header Row */}
                    <div 
                      onClick={() => toggleTakeExpanded(take.id)}
                      className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left cursor-pointer select-none hover:bg-zinc-50/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 pb-1.5 flex-wrap">
                          <span className="font-mono text-xs font-black uppercase bg-zinc-900 text-white px-2.5 py-0.5 rounded-lg">
                            Stock Take #{take.code}
                          </span>
                          <span className={cn(
                            "text-[9px] font-sans font-black uppercase tracking-wider px-2 py-0.5 rounded",
                            take.status === 'completed'
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : pendingCount > 0 
                                ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" 
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                          )}>
                            {take.status === 'completed' ? 'Completed Ledger' : pendingCount > 0 ? `${pendingCount} Items Awaiting Approval` : 'Partially Completed'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono uppercase font-semibold mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-zinc-400" /> Counted By: <strong className="text-zinc-700">{take.submittedBy || 'Team Member'}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" /> {take.submittedAt ? new Date(take.submittedAt).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto border-l sm:border-l border-zinc-100 pl-4 sm:pl-4">
                        <div className="font-mono text-xs text-right">
                          <span className="text-zinc-400 font-bold uppercase block text-[9px] tracking-wider">Total Lines:</span>
                          <strong className="text-[15px] font-black text-zinc-805 font-sans">{(take.items || []).length} Items</strong>
                        </div>

                        {/* Delete button inline confirmation */}
                        <div className="flex items-center gap-2 border-l border-zinc-100 pl-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {deletingTakeId === take.id ? (
                            <div className="flex items-center gap-1 bg-red-50 py-1 px-2 rounded-xl border border-red-200 animate-fade-in shrink-0">
                              <span className="text-[9px] text-red-700 font-black uppercase font-mono mr-1">Delete?</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleDeleteStockTake(take.id);
                                  setDeletingTakeId(null);
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer shadow-sm"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTakeId(null)}
                                className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingTakeId(take.id)}
                              className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-650 border border-transparent hover:border-red-150 rounded-xl transition-all cursor-pointer shrink-0"
                              title="Delete Stock Take"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                      </div>
                    </div>

                    {/* Expandable Counted items layout grid */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-zinc-150 bg-zinc-50/50 p-5 text-left"
                        >
                          <div className="space-y-3">
                            <p className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-widest leading-none pb-1">Items Included in this Stock Take:</p>
                            {(take.items || []).map((tItem, itemIdx) => (
                              <div key={itemIdx} className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap pb-0.5">
                                    <span className="font-mono text-[10px] font-black uppercase text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                                      {tItem.stockCode}
                                    </span>
                                    {tItem.isPart && (
                                      <span className="text-[8px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded shadow-3xs tracking-wider">
                                        Knockdown Part {tItem.parentItem ? `of ${tItem.parentItem}` : ''}
                                      </span>
                                    )}
                                    <span className={cn(
                                      "text-[8px] font-sans font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                      tItem.status === 'approved' 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                                        : tItem.status === 'rejected' 
                                          ? "bg-red-50 text-red-700 border border-red-150" 
                                          : "bg-amber-50 text-amber-700 border border-amber-150"
                                    )}>
                                      {tItem.status === 'approved' ? 'Approved & Logged' : tItem.status === 'rejected' ? 'Rejected' : 'Awaiting Approval'}
                                    </span>
                                  </div>
                                  <p className="text-xs font-black text-zinc-800 uppercase leading-snug">
                                    {tItem.description}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                                  <div className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl font-mono text-xs">
                                    Counted: <strong className="font-sans font-black text-sm">{tItem.countedQty}</strong>
                                  </div>

                                  {tItem.status === 'pending' && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveItemInTake(take, itemIdx)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-[10px] uppercase tracking-wider rounded-lg cursor-pointer shadow-3xs flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform animate-fade-in"
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectItemInTake(take, itemIdx)}
                                        className="px-2.5 py-1.5 border border-red-200 hover:border-red-350 text-red-600 hover:bg-red-50/50 font-sans font-black text-[10px] uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-0.5 hover:scale-105 active:scale-95 transition-transform animate-fade-in"
                                      >
                                        <X className="w-3.5 h-3.5" /> Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            {stockTakes.filter(take => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return take.code.includes(q) || take.submittedBy.toLowerCase().includes(q) || take.items?.some(i => i.stockCode.toLowerCase().includes(q));
            }).length === 0 && (
              <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400">
                No matching stock takes found.
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center flex flex-col items-center justify-center p-8 space-y-4 shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-zinc-50 border border-zinc-150 rounded-2xl text-zinc-400 flex items-center justify-center shrink-0">
              <Boxes className="w-8 h-8 stroke-1" />
            </div>
            <h3 className="text-sm font-black text-zinc-700 uppercase tracking-wider leading-none">All Caught Up</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              No stock takes are currently in the queue awaiting approval. Submitted counts from warehouse staff on the Team Dashboard will load here.
            </p>
          </div>
        )
      ) : (
        (() => {
          const grouped = groupAndSortItems<KnockdownItem>(filteredStockItems, knockdownList);
          
          if (grouped.length === 0) {
            return (
              <div className="py-20 bg-white border border-zinc-200 rounded-3xl text-center text-zinc-400">
                No matching items found.
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.groupCode} className="border border-zinc-200 rounded-3xl p-5 bg-zinc-50/20 space-y-3">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-150">
                    <span className="text-[10px] font-mono font-black uppercase text-zinc-400 tracking-wider">Stock Group:</span>
                    <span className="font-mono text-xs font-black uppercase bg-zinc-900 text-white px-2.5 py-0.5 rounded-lg">
                      {group.groupCode}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {group.items.map((item) => {
                      const isExpanded = expandedItemIds[item.id] || false;
                      const isEditing = editingItemId === item.id;
                      
                      return (
                        <div 
                          key={item.id}
                          className="bg-white rounded-3xl border border-zinc-200 hover:border-zinc-350 shadow-sm hover:shadow-md transition-all duration-250 hover:scale-[1.002]"
                        >
                          {/* Visual Header row */}
                          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
                            <div 
                              className="flex-grow min-w-0 cursor-pointer"
                              onClick={() => toggleItemExpanded(item.id)}
                            >
                              <div className="flex flex-wrap items-center gap-2 pb-1 bg-transparent border-0 hover:bg-transparent p-0">
                                <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-brand-primary/10 border border-brand-primary/15 text-brand-primary px-2 py-0.5 rounded-lg">
                                  {item.stockCode}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono uppercase">
                                  Registered {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              
                              <h3 className="text-sm font-black text-brand-primary leading-tight uppercase hover:text-brand-accent transition-colors flex items-center gap-1.5 mt-1">
                                {item.displayName}
                              </h3>
                              
                              {item.description && (
                                <p className="text-xs text-zinc-500 mt-1 max-w-xl font-medium truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {/* Quantity and Action columns */}
                            <div className="flex items-center flex-wrap gap-4 justify-end sm:shrink-0">
                              
                              {/* Inline Quantity editing block - hidden for knockdown type items */}
                              {item.type !== 'knockdown' && (
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-205">
                                      <input
                                        type="number"
                                        min="1"
                                        value={editQtyValue}
                                        onChange={(e) => setEditQtyValue(Number(e.target.value) || 1)}
                                        className="w-14 px-2 py-1 text-xs font-bold font-sans text-center bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent text-zinc-800"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => saveEditQty(item.id)}
                                        className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg border border-transparent hover:border-emerald-150 transition-all cursor-pointer"
                                        title="Save quantity"
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingItemId(null)}
                                        className="p-1 hover:bg-zinc-150 text-zinc-404 rounded-lg transition-all cursor-pointer"
                                        title="Cancel edits"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div 
                                      className="px-3.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-2xl border border-zinc-150 font-sans text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                                      onClick={() => startEditQty(item)}
                                      title="Click to edit quantity"
                                    >
                                      <span className="text-zinc-400/90 font-mono font-bold uppercase tracking-wide">Stock Qty:</span>
                                      <strong className="text-zinc-800 font-black">{item.qty}</strong>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Move categories button dropdown/cluster */}
                              <div className="flex items-center gap-1 bg-zinc-100/60 border border-zinc-150 rounded-xl p-0.5" title="Relocate to category">
                                <Shuffle className="w-3.5 h-3.5 text-zinc-400 mx-1.5 shrink-0" />
                                {(['knockdown', 'assembled', 'pre-assembled'] as const).map((t) => {
                                  if (t === item.type) return null;
                                  const label = t === 'knockdown' ? 'Knockdown' : t === 'assembled' ? 'Assembled' : 'Pre-assembled';
                                  const icon = t === 'knockdown' ? <Wrench className="w-3 h-3" /> : t === 'assembled' ? <PackageCheck className="w-3 h-3" /> : <Boxes className="w-3 h-3" />;
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => handleMoveCategory(item.id, t)}
                                      className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-250 text-zinc-650 hover:text-zinc-950 font-sans font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      {icon}
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Actions panel with custom inline confirmation state to avoid window.confirm block in iframes */}
                              <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                                <button
                                  type="button"
                                  onClick={() => toggleItemExpanded(item.id)}
                                  className="p-1.5 hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-250 text-zinc-600 rounded-xl transition-all cursor-pointer"
                                  title={isExpanded ? "Hide parts list" : "Show parts breakdown details"}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                {deletingItemId === item.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 py-1 px-2 rounded-xl border border-red-205 animate-fade-in shrink-0">
                                    <span className="text-[9px] text-red-700 font-black uppercase font-mono mr-1">Delete?</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await handleDeleteItem(item.id);
                                        setDeletingItemId(null);
                                      }}
                                      className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer shadow-xs"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingItemId(null)}
                                      className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-mono font-black uppercase rounded-lg cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingItemId(item.id)}
                                    className="p-1.5 hover:bg-red-50 hover:text-red-650 border border-transparent hover:border-red-150 text-zinc-405 rounded-xl transition-all cursor-pointer"
                                    title="Delete knockdown catalog item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Parts List view breakdown if type is knockdown */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-zinc-150 bg-zinc-50/50 p-5 text-left"
                              >
                                {item.parts && item.parts.length > 0 ? (
                                  <div className="space-y-2">
                                    <h4 className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Parts & Components Breakdown:</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {item.parts.map((p, pIdx) => (
                                        <div key={pIdx} className="bg-white border border-zinc-200 p-3.5 rounded-2xl shadow-3xs flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="font-mono text-[10px] font-black text-zinc-750 uppercase tracking-tight bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 inline-block">
                                              {p.partCode}
                                            </p>
                                            <p className="text-[11px] font-medium text-zinc-500 truncate mt-1">
                                              {p.description}
                                            </p>
                                          </div>
                                          <div className="px-2.5 py-1 bg-zinc-100 text-zinc-700 font-mono text-xs rounded-lg font-bold">
                                            Qty: {p.qty}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-zinc-400 font-mono text-xs flex items-center gap-1.5">
                                    <HelpCircle className="w-4 h-4 text-zinc-300" />
                                    No explicit child components configured for this entry.
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Knockdown Setup Dialogue Modal popup component */}
      <KnockdownSetupDialog 
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onSaveSuccess={() => setIsSetupOpen(false)}
      />
    </div>
  );
}
