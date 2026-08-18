import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useStockControl } from './hooks/useStockControl';
import { PhaseHeader } from './components/PhaseHeader';
import { PhaseKpiBar } from './components/PhaseKpiBar';
import { PhaseFilters, EMPTY_FILTERS, type StockControlFilterState } from './components/PhaseFilters';
import { AvailableStockColumn } from './components/AvailableStockColumn';
import { BookedColumn } from './components/BookedColumn';
import { AssemblyColumn } from './components/AssemblyColumn';
import { ReadyColumn } from './components/ReadyColumn';
import { AllocateStockModal } from './components/AllocateStockModal';
import { AutoBookModal } from './components/AutoBookModal';
import { AssemblyModal } from './components/AssemblyModal';
import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { ProductDetailDrawer } from './components/ProductDetailDrawer';
import { LinkInvoiceModal } from './components/LinkInvoiceModal';
import { ManualBookingModal } from './components/ManualBookingModal';
import { ActivityHistoryDrawer } from './components/ActivityHistoryDrawer';
import { RevertOrderModal } from './components/RevertOrderModal';
import type { OrderRow, StockRow } from './utils/phaseCalculations';
import StockControlPageMobile from './StockControlPageMobile';

export function StockControlPage() {
  const stockControl = useStockControl();
  const [filters, setFilters] = useState<StockControlFilterState>(EMPTY_FILTERS);
  const [syncingOrders, setSyncingOrders] = useState(false);

  const [allocateRow, setAllocateRow] = useState<StockRow | null>(null);
  const [autoBookOpen, setAutoBookOpen] = useState(false);
  // Every "open X for this order" dialog below tracks only the order's id, not a
  // snapshot of the OrderRow itself — the row is re-derived from live orderRows
  // on every render (see orderById), so numbers on screen (assembled qty, progress,
  // etc.) stay current while the dialog is open instead of freezing at whatever
  // they were when it was opened. Fixes AssemblyModal's +/-/Build All appearing to
  // do nothing until the dialog was closed and reopened.
  const [assemblyOrderId, setAssemblyOrderId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailProductCode, setDetailProductCode] = useState<string | null>(null);
  const [linkInvoiceOrderId, setLinkInvoiceOrderId] = useState<string | null>(null);
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [revertTargetId, setRevertTargetId] = useState<string | null>(null);

  const orderById = useMemo(() => new Map(stockControl.orderRows.map(o => [o.invoiceId, o])), [stockControl.orderRows]);
  const assemblyOrder = assemblyOrderId ? orderById.get(assemblyOrderId) ?? null : null;
  const detailOrder = detailOrderId ? orderById.get(detailOrderId) ?? null : null;
  const linkInvoiceOrder = linkInvoiceOrderId ? orderById.get(linkInvoiceOrderId) ?? null : null;
  const historyOrder = historyOrderId ? orderById.get(historyOrderId) ?? null : null;
  const revertTarget = revertTargetId ? orderById.get(revertTargetId) ?? null : null;

  // Revert closes whichever other modal/drawer might already be open for the
  // same order, so only the confirmation dialog is visible.
  const handleRequestRevert = (order: OrderRow) => {
    setAssemblyOrderId(null);
    setDetailOrderId(null);
    setRevertTargetId(order.invoiceId);
  };

  // "Add to Trip" always opens the invoice lookup/confirm step first — never
  // straight to trip assignment — so the user sees which invoice was found (or
  // that none was) before anything gets scheduled. LinkInvoiceModal itself uses
  // order.source to decide how to find that invoice: an invoice-backed row
  // already has one (order.invoiceId is a real invoice id), a standalone
  // Orders-collection row needs it looked up by Customer P/O.
  const handleAddToTrip = (order: OrderRow) => {
    setLinkInvoiceOrderId(order.invoiceId);
  };

  const isMobile = useIsMobile();

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    stockControl.stockRows.forEach(r => { if (r.category !== 'unknown') set.add(r.category); });
    return Array.from(set).sort();
  }, [stockControl.stockRows]);

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    stockControl.orderRows.forEach(o => { if (o.area) set.add(o.area); });
    return Array.from(set).sort();
  }, [stockControl.orderRows]);

  const schoolTypeOptions = useMemo(() => {
    const set = new Set<string>();
    stockControl.orderRows.forEach(o => { if (o.schoolType) set.add(o.schoolType); });
    return Array.from(set).sort();
  }, [stockControl.orderRows]);

  const orderStatusOptions = useMemo(() => {
    const set = new Set<string>();
    stockControl.orderRows.forEach(o => { if (o.status) set.add(o.status); });
    return Array.from(set).sort();
  }, [stockControl.orderRows]);

  const filteredStockRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return stockControl.stockRows.filter(row => {
      if (filters.category && row.category !== filters.category) return false;
      if (q && !(row.stockCode.toLowerCase().includes(q) || row.description.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [stockControl.stockRows, filters.category, filters.search]);

  const filteredOrderRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return stockControl.orderRows.filter(order => {
      if (filters.area && order.area !== filters.area) return false;
      if (filters.schoolType && order.schoolType !== filters.schoolType) return false;
      if (filters.orderStatus && order.status !== filters.orderStatus) return false;

      if (filters.assemblyStatus === 'not-started' && order.totalAssembled > 0) return false;
      if (filters.assemblyStatus === 'in-progress' && (order.totalAssembled === 0 || order.isReady)) return false;
      if (filters.assemblyStatus === 'ready' && !order.isReady) return false;

      if (filters.dateFrom && (!order.dueDate || order.dueDate < filters.dateFrom)) return false;
      if (filters.dateTo && (!order.dueDate || order.dueDate > filters.dateTo)) return false;

      if (q) {
        const haystack = [
          order.schoolName, order.orderNumber, order.clientNumber, order.area,
          ...order.lines.flatMap(l => [l.stockCode, l.description])
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [stockControl.orderRows, filters]);

  const bookedOrders = useMemo(() => filteredOrderRows.filter(o => o.totalReserved > 0), [filteredOrderRows]);
  const assemblyOrders = useMemo(() => filteredOrderRows.filter(o => o.totalAssembled > 0 && !o.isReady), [filteredOrderRows]);
  const readyOrders = useMemo(() => filteredOrderRows.filter(o => o.isReady), [filteredOrderRows]);

  const bookedUnits = useMemo(() => bookedOrders.reduce((s, o) => s + o.totalReserved, 0), [bookedOrders]);
  const assemblyUnits = useMemo(() => assemblyOrders.reduce((s, o) => s + o.totalAssembled, 0), [assemblyOrders]);
  const readyUnits = useMemo(() => readyOrders.reduce((s, o) => s + o.totalOrdered, 0), [readyOrders]);
  const knockdownAvailableFiltered = useMemo(() => filteredStockRows.reduce((s, r) => s + r.available, 0), [filteredStockRows]);

  const handleSyncFromStock = () => {
    toast.success('Stock levels recalculated from live inventory.');
  };

  const handleSyncFromOrders = async () => {
    setSyncingOrders(true);
    try {
      await stockControl.syncExistingInvoicesToProducts();
      toast.success('Order line items synchronized into the product catalog.');
    } catch {
      toast.error('Orders could not be synchronized.');
    } finally {
      setSyncingOrders(false);
    }
  };

  return (
    <div className="space-y-6 text-zinc-900 font-sans tracking-tight">
      {isMobile ? (
        <StockControlPageMobile
          stockControl={stockControl}
          filters={filters}
          setFilters={setFilters}
          bookedOrders={bookedOrders}
          assemblyOrders={assemblyOrders}
          readyOrders={readyOrders}
          filteredStockRows={filteredStockRows}
          onSyncFromStock={handleSyncFromStock}
          onSyncFromOrders={handleSyncFromOrders}
          syncingOrders={syncingOrders}
          onAddManualBooking={() => setManualBookingOpen(true)}
          onAllocate={setAllocateRow}
          onOpenAssembly={(order) => setAssemblyOrderId(order.invoiceId)}
          onOpenOrder={(order) => setDetailOrderId(order.invoiceId)}
          onViewProduct={setDetailProductCode}
          onAddToTrip={handleAddToTrip}
          onRevert={handleRequestRevert}
          onAutoBook={() => setAutoBookOpen(true)}
        />
      ) : (
        <>
          <PhaseHeader
            onSyncFromStock={handleSyncFromStock}
            onSyncFromOrders={handleSyncFromOrders}
            onAddManualBooking={() => setManualBookingOpen(true)}
            syncingOrders={syncingOrders}
          />

          <PhaseKpiBar kpis={stockControl.kpis} />

          <PhaseFilters
            filters={filters}
            onChange={setFilters}
            categoryOptions={categoryOptions}
            areaOptions={areaOptions}
            schoolTypeOptions={schoolTypeOptions}
            orderStatusOptions={orderStatusOptions}
          />

          {stockControl.shortStockOrders.length > 0 && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2">
              {stockControl.shortStockOrders.reduce((s, o) => s + o.shortUnits, 0)} units required by active orders but currently unavailable across {stockControl.shortStockOrders.length} order{stockControl.shortStockOrders.length === 1 ? '' : 's'}.
            </div>
          )}

          {stockControl.loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary shrink-0" />
              <p className="text-xs text-zinc-500 font-mono uppercase font-semibold">Loading production workflow…</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              <AvailableStockColumn
                stockRows={filteredStockRows}
                totalAvailable={knockdownAvailableFiltered}
                onAllocate={setAllocateRow}
                onViewProduct={setDetailProductCode}
                onAutoBook={() => setAutoBookOpen(true)}
              />
              <BookedColumn
                orders={bookedOrders}
                totalUnits={bookedUnits}
                onOpenOrder={(order) => setDetailOrderId(order.invoiceId)}
                onOpenAssembly={(order) => setAssemblyOrderId(order.invoiceId)}
                onRevert={handleRequestRevert}
              />
              <AssemblyColumn
                orders={assemblyOrders}
                totalUnits={assemblyUnits}
                onOpenAssembly={(order) => setAssemblyOrderId(order.invoiceId)}
              />
              <ReadyColumn
                orders={readyOrders}
                totalUnits={readyUnits}
                onOpenOrder={(order) => setDetailOrderId(order.invoiceId)}
                onAddToTrip={handleAddToTrip}
                onRevert={handleRequestRevert}
              />
            </div>
          )}
        </>
      )}

      <AllocateStockModal
        row={allocateRow}
        orders={stockControl.schoolOrders}
        allocations={stockControl.allocations}
        onClose={() => setAllocateRow(null)}
        onAllocate={stockControl.allocateStock}
      />

      <AutoBookModal
        isOpen={autoBookOpen}
        onClose={() => setAutoBookOpen(false)}
        orderRows={stockControl.orderRows}
        stockRows={stockControl.stockRows}
        allocateStock={stockControl.allocateStock}
      />

      <AssemblyModal
        order={assemblyOrder}
        onClose={() => setAssemblyOrderId(null)}
        onRecordChange={stockControl.recordAssemblyChange}
        onRevert={(order) => { setAssemblyOrderId(null); handleRequestRevert(order); }}
      />

      <OrderDetailDrawer
        order={detailOrder}
        onClose={() => setDetailOrderId(null)}
        onViewHistory={(order) => { setHistoryOrderId(order.invoiceId); }}
        onOpenAssembly={(order) => { setDetailOrderId(null); setAssemblyOrderId(order.invoiceId); }}
        onRevert={(order) => { setDetailOrderId(null); handleRequestRevert(order); }}
      />

      <ProductDetailDrawer
        stockCode={detailProductCode}
        stockRows={stockControl.stockRows}
        productsByCode={stockControl.productsByCode}
        knockdownByCode={stockControl.knockdownByCode}
        orderRows={stockControl.orderRows}
        onClose={() => setDetailProductCode(null)}
      />

      <LinkInvoiceModal
        order={linkInvoiceOrder}
        schoolOrders={stockControl.schoolOrders}
        onClose={() => setLinkInvoiceOrderId(null)}
        updateSchoolOrder={stockControl.updateSchoolOrder}
      />

      <ManualBookingModal
        isOpen={manualBookingOpen}
        onClose={() => setManualBookingOpen(false)}
      />

      <ActivityHistoryDrawer
        order={historyOrder}
        allocations={stockControl.allocations}
        assemblyLogs={stockControl.assemblyLogs}
        onClose={() => setHistoryOrderId(null)}
      />

      <RevertOrderModal
        order={revertTarget}
        onClose={() => setRevertTargetId(null)}
        onRevert={stockControl.revertOrderToStock}
      />
    </div>
  );
}
