// Shared pure-function helpers for Order Builder - kept dependency-free (no React,
// no Firestore) so they're independently testable and reusable between the list,
// build, and export UIs.

import { schoolKeyFor } from '../../lib/geocoding';
import type { Order } from '../orders/hooks/useOrders';
import type { OrderBuildSchoolGroup } from './types';

// Human-readable delivery date, matching this app's existing en-ZA date-formatting
// convention (see src/features/trips/utils/printTripManifest.ts).
export function formatBuildDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Extracts the numeric portion of an order number for sorting (e.g. "OR-012138"
// -> 12138), using the FIRST numeric run if there happens to be more than one.
// Falls back to a very large number (sorts last) if no digits are found at all,
// so a malformed order number doesn't crash the sort or silently jump to the front.
export function orderNumberSortValue(orderNumber: string): number {
  const match = orderNumber.match(/(\d+)/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return parseInt(match[0], 10);
}

// Sorts the selected orders by order number (earliest first, numeric-aware - NOT
// createdAt, which represents "earliest imported" rather than "earliest order
// number" and isn't guaranteed to correlate), then groups them by school,
// preserving each group's position by where its earliest order number first
// appears in that sorted list. Within a group, line items from that school's
// multiple contributing orders are summed by stock code, preserving first-seen
// stock-code order rather than alphabetizing. Pure function - the exact same
// result the "Save Build" persistence issue writes to Firestore, so the preview
// the user sees on screen always matches what gets saved.
export function buildSchoolGroups(orders: Order[], selectedOrderIds: Set<string>): OrderBuildSchoolGroup[] {
  const selected = orders
    .filter(o => selectedOrderIds.has(o.id))
    .sort((a, b) => orderNumberSortValue(a.orderNumber) - orderNumberSortValue(b.orderNumber));

  const groups: Record<string, OrderBuildSchoolGroup> = {};
  const groupKeyOrder: string[] = [];

  for (const order of selected) {
    const key = schoolKeyFor(order.schoolName);
    let group = groups[key];
    if (!group) {
      group = {
        schoolId: order.schoolId,
        schoolName: order.schoolName,
        area: order.area,
        schoolType: order.schoolType,
        orderIds: [],
        orderNumbers: [],
        lineItems: []
      };
      groups[key] = group;
      groupKeyOrder.push(key);
    } else if (order.area !== group.area || order.schoolType !== group.schoolType) {
      // Data-quality gap: two orders sharing a school disagree on area/schoolType.
      // Keep the first-seen order's values (already set on `group`) and log rather
      // than crash or silently pick an arbitrary one without any trace.
      console.warn(
        `[order-builder] Orders for school "${order.schoolName}" disagree on area/schoolType ` +
        `(order ${order.orderNumber}: "${order.area}"/"${order.schoolType}" vs. group's "${group.area}"/"${group.schoolType}"). ` +
        `Using the first-seen values.`
      );
    }

    group.orderIds.push(order.id);
    group.orderNumbers.push(order.orderNumber);

    for (const li of order.lineItems) {
      const existingLine = group.lineItems.find(l => l.stockCode === li.stockCode);
      if (existingLine) {
        existingLine.qty += li.qty;
      } else {
        group.lineItems.push({ stockCode: li.stockCode, qty: li.qty });
      }
    }
  }

  return groupKeyOrder.map(key => groups[key]);
}
