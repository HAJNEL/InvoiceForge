import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStock } from '../../stock/hooks/useStock';
import { useProducts } from '../../products/hooks/useProducts';
import { useInvoices } from '../../invoices/hooks/useInvoices';
import { useOrders } from '../../orders/hooks/useOrders';
import { useTrips } from '../../trips/hooks/useTrips';
import { useInventoryItems } from './useInventoryItems';
import { useAllocations } from './useAllocations';
import { useAssemblyLogs } from './useAssemblyLogs';
import {
  buildOrderRows,
  buildStockRows,
  computeKpis,
  computeShortStockOrders,
  computeOrderNumbersOnTrip,
  normalize
} from '../utils/phaseCalculations';
import type { OrderRow } from '../utils/phaseCalculations';

/**
 * Composes every existing data source Stock Control needs (knockdown/product
 * catalog, invoices-as-orders, the standalone Orders collection as orders too,
 * physical inventory) with the two new ledgers (allocations, assembly logs) into
 * the derived rows the Product Phases board renders. Nothing here is stored —
 * everything is recomputed from live onSnapshot data, memoized per the underlying
 * arrays (spec §29/§32).
 */
export function useStockControl() {
  const { stockItems, loading: stockLoading } = useStock();
  const { products, inventoryMap, loading: productsLoading, syncExistingInvoicesToProducts } = useProducts();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { orders: schoolOrders, loading: schoolOrdersLoading, updateOrder: updateSchoolOrder } = useOrders();
  const { trips } = useTrips();
  const { items: inventoryItems, loading: inventoryLoading } = useInventoryItems();
  const { allocations, loading: allocationsLoading, allocateStock, releaseAllocation } = useAllocations();
  const { logs: assemblyLogs, loading: assemblyLoading, recordAssemblyChange } = useAssemblyLogs();

  // Every invoice id already sitting on some trip — the single source of truth
  // for "this order has moved on to delivery," independent of any stored status
  // flag. See buildOrderRows and the reconciliation effect below.
  const invoiceIdsOnTrips = useMemo(
    () => new Set(trips.flatMap(t => t.invoiceIds || [])),
    [trips]
  );

  const productsByCode = useMemo(() => {
    const map = new Map<string, typeof products[number]>();
    products.forEach(p => map.set(normalize(p.stockCode), p));
    return map;
  }, [products]);

  const knockdownByCode = useMemo(() => {
    const map = new Map<string, typeof stockItems[number]>();
    stockItems.forEach(k => map.set(normalize(k.stockCode), k));
    return map;
  }, [stockItems]);

  const orderRows = useMemo(
    () => buildOrderRows(invoices, schoolOrders, allocations, assemblyLogs, invoiceIdsOnTrips),
    [invoices, schoolOrders, allocations, assemblyLogs, invoiceIdsOnTrips]
  );

  const stockRows = useMemo(
    () => buildStockRows(inventoryItems, productsByCode, knockdownByCode, inventoryMap),
    [inventoryItems, productsByCode, knockdownByCode, inventoryMap]
  );

  const kpis = useMemo(() => computeKpis(orderRows, stockRows), [orderRows, stockRows]);
  const shortStockOrders = useMemo(() => computeShortStockOrders(orderRows), [orderRows]);

  const loading = stockLoading || productsLoading || invoicesLoading || inventoryLoading || allocationsLoading || assemblyLoading || schoolOrdersLoading;

  /**
   * Fully reverts an order out of Booked/Assembly/Ready back to Available Stock:
   * releases every active allocation for it (which un-reserves the units on the
   * matching `inventory` doc, transactionally) and resets every line's assembled
   * quantity back to 0. Once both are zero the order naturally drops out of all
   * three phase columns — nothing needs to be explicitly "moved".
   */
  const revertOrderToStock = useCallback(async (order: OrderRow): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeAllocations = allocations.filter(a => a.invoiceId === order.invoiceId && !a.releasedAt);
      const releaseResults = await Promise.all(activeAllocations.map(a => releaseAllocation(a.id)));
      const releaseFailure = releaseResults.find(r => !r.success);
      if (releaseFailure) return releaseFailure;

      const linesToReset = order.lines.filter(l => l.assembled > 0);
      const resetResults = await Promise.all(linesToReset.map(l => recordAssemblyChange({
        invoiceId: order.invoiceId,
        orderNumber: order.orderNumber,
        schoolName: order.schoolName,
        stockCode: l.stockCode,
        previousQty: l.assembled,
        newQty: 0
      })));
      const resetFailure = resetResults.find(r => !r.success);
      if (resetFailure) return resetFailure;

      return { success: true };
    } catch (err) {
      console.error('revertOrderToStock error:', err);
      return { success: false, error: 'Unable to revert this order. Please try again.' };
    }
  }, [allocations, releaseAllocation, recordAssemblyChange]);

  // Self-healing safety net: whichever screen actually put an invoice onto a
  // trip (LinkInvoiceModal, the Trips planner, wherever), any still-Active
  // Orders-collection order sharing that invoice's Customer P/O gets marked
  // Complete here. Board *visibility* never waits on this — buildOrderRows
  // already hides the row purely from trip membership — this only keeps the
  // Orders screen's own status field in sync. Idempotent (setting Complete
  // again is a no-op) and self-terminating: once a match's write lands, it's
  // no longer 'Active' and drops out of `toComplete` on the next pass.
  const completingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const orderNumbersOnTrip = computeOrderNumbersOnTrip(invoices, invoiceIdsOnTrips);
    const toComplete = schoolOrders.filter(so =>
      so.status === 'Active' &&
      so.orderNumber &&
      orderNumbersOnTrip.has(normalize(so.orderNumber)) &&
      !completingRef.current.has(so.id)
    );
    if (toComplete.length === 0) return;

    toComplete.forEach(so => completingRef.current.add(so.id));
    Promise.all(toComplete.map(so => updateSchoolOrder(so.id, { status: 'Complete' })))
      .finally(() => {
        toComplete.forEach(so => completingRef.current.delete(so.id));
      });
  }, [schoolOrders, invoices, invoiceIdsOnTrips, updateSchoolOrder]);

  return {
    loading,
    orderRows,
    schoolOrders,
    updateSchoolOrder,
    stockRows,
    kpis,
    shortStockOrders,
    productsByCode,
    knockdownByCode,
    inventoryItems,
    allocations,
    assemblyLogs,
    allocateStock,
    releaseAllocation,
    recordAssemblyChange,
    revertOrderToStock,
    syncExistingInvoicesToProducts
  };
}
