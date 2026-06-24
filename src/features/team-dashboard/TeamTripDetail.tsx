import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { onSnapshot, doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { 
  ArrowLeft, Calendar, Truck, ShieldAlert, 
  Loader2, DollarSign, FileSpreadsheet, Lock, CheckCircle2, Package, Shield, ArrowRight,
  AlertTriangle, X, ClipboardList
} from 'lucide-react';
import { useTeamDashboard } from './useTeamDashboard';
import { db, auth } from '../../lib/firebase';
import { Trip, Invoice } from '../../types';
import { cn } from '../../lib/utils';
import { subtractSingleItemFromInventory } from '../../utils/inventory';

interface InvoiceLineItem {
  stockCode?: string;
  stock_code?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  isPart?: boolean;
  parentItem?: string | null;
}

// Invoice documents loaded from Firestore can carry legacy/snake_case fields
// that aren't part of the canonical Invoice type. This loosens those accesses.
type RawInvoice = Invoice & {
  schoolName?: string;
  client?: string;
  taxInvoice?: string;
  invoice_number?: string;
  number?: string;
  line_items?: InvoiceLineItem[];
  ship_to_details?: { school_name?: string; name?: string };
};

interface LoaderChecklistItem {
  invoiceId: string;
  invoiceNumber: string;
  schoolName: string;
  stockCode: string;
  description: string;
  qty: number;
  isPart: boolean;
  parentItem: string | null;
  legacyIndex: number;
}

interface AssemblerItemToCount {
  stockCode: string;
  description: string;
  qty: number;
  keyUnified: string;
  keyLegacy: string;
  isPart?: boolean;
  parentItem?: string | null;
}

interface UniquePreChecklistItem {
  stockCode: string;
  description: string;
  qty: number;
}

export function TeamTripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { profile, toggleCheckItem, updateTripStatus, updatePartialItem, knockdownItems, loading: authLoading } = useTeamDashboard();

  // Local state for inline partial editing
  const [editingPartialKey, setEditingPartialKey] = useState<string | null>(null);
  const [localActualQty, setLocalActualQty] = useState<number>(0);
  const [localReason, setLocalReason] = useState<string>('');

  // Load state for this specific trip
  const [trip, setTrip] = useState<Trip | null>(null);
  const [invoices, setInvoices] = useState<RawInvoice[]>([]);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Pre-Checklist states
  const [showPreChecklist, setShowPreChecklist] = useState(false);
  const [preCheckedState, setPreCheckedState] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`pre_checklist_${tripId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sum qty per stockCode+description across all loaded invoices.
  // Used by the Delivered Checker to show the correct loaded qty, since
  // Step 1 updates the invoice line items to actualQty at loader submit time.
  const qtyFromInvoices = React.useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      const lineItems = (inv.lineItems || inv.line_items || []) as InvoiceLineItem[];
      lineItems.forEach(lineItem => {
        const sc = (lineItem.stockCode || lineItem.stock_code || 'N/A').trim();
        const desc = (lineItem.description || '').trim();
        const qty = Number(lineItem.qty || lineItem.quantity || 0);
        const key = `${sc}__${desc}`;
        map.set(key, (map.get(key) || 0) + qty);
      });
    });
    return map;
  }, [invoices]);

  // Setup Unique Pre-Checklist Items - grouping by item name / stockCode + description
  const uniquePreChecklistItems = React.useMemo<UniquePreChecklistItem[]>(() => {
    const itemMap = new Map<string, { stockCode: string; description: string; qty: number }>();
    invoices.forEach(inv => {
      const lineItems = (inv.lineItems || inv.line_items || []) as InvoiceLineItem[];
      lineItems.forEach(item => {
        const stockCode = item.stockCode || item.stock_code || 'N/A';
        const description = item.description || '';
        const qty = Number(item.qty || item.quantity || 0);

        const key = `${stockCode.trim().toUpperCase()}_${description.trim().toUpperCase()}`;
        const existing = itemMap.get(key);
        if (existing) {
          existing.qty += qty;
        } else {
          itemMap.set(key, {
            stockCode,
            description,
            qty
          });
        }
      });
    });
    return Array.from(itemMap.values()).sort((a, b) => a.stockCode.localeCompare(b.stockCode));
  }, [invoices]);

  // Compute stats for current pre-checklist
  const preChecklistStats = React.useMemo(() => {
    let checkedCount = 0;
    uniquePreChecklistItems.forEach(item => {
      const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
      if (preCheckedState[key]) {
        checkedCount++;
      }
    });
    const totalCount = uniquePreChecklistItems.length;
    const isCompleted = totalCount > 0 && checkedCount === totalCount;
    return {
      checkedCount,
      totalCount,
      isCompleted
    };
  }, [uniquePreChecklistItems, preCheckedState]);

  // Financial aggregate calculation with exhaustive fallback matching
  const totalFinancialValue = React.useMemo(() => {
    interface LooseInvoice {
      amount?: number;
      totalDue?: number;
      totalAmount?: number;
      total_amount?: number;
      total?: number;
      subTotal?: number;
      sub_total?: number;
      summary?: {
        total_due?: number;
        totalDue?: number;
        sub_total?: number;
        subTotal?: number;
        [key: string]: unknown;
      };
      lineItems?: Array<{
        value?: number;
        line_item_value?: number;
        lineItemValue?: number;
        qty?: number;
        quantity?: number;
        unitPrice?: number;
        unit_price?: number;
      }>;
      line_items?: Array<{
        value?: number;
        line_item_value?: number;
        lineItemValue?: number;
        qty?: number;
        quantity?: number;
        unitPrice?: number;
        unit_price?: number;
      }>;
    }

    return invoices.reduce((sum, rawInv) => {
      const inv = rawInv as LooseInvoice;
      if (!inv) return sum;
      
      // Try explicit mapped or stored amounts
      if (typeof inv.amount === 'number') return sum + inv.amount;
      
      const summary = inv.summary || {};
      if (typeof summary.total_due === 'number') return sum + summary.total_due;
      if (typeof summary.totalDue === 'number') return sum + summary.totalDue;
      if (typeof inv.totalDue === 'number') return sum + inv.totalDue;
      if (typeof inv.totalAmount === 'number') return sum + inv.totalAmount;
      if (typeof inv.total_amount === 'number') return sum + inv.total_amount;
      if (typeof inv.total === 'number') return sum + inv.total;
      
      // Fallback to subtotal fields
      if (typeof summary.sub_total === 'number') return sum + summary.sub_total;
      if (typeof summary.subTotal === 'number') return sum + summary.subTotal;
      if (typeof inv.subTotal === 'number') return sum + inv.subTotal;
      if (typeof inv.sub_total === 'number') return sum + inv.sub_total;
      
      // Safe fallback: sum line items
      const lineItems = inv.lineItems || inv.line_items || [];
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        const itemsSum = lineItems.reduce((accSum: number, item) => {
          const itemVal = item.value ?? item.line_item_value ?? item.lineItemValue;
          if (typeof itemVal === 'number') return accSum + itemVal;
          
          const qty = Number(item.qty ?? item.quantity ?? 0);
          const price = Number(item.unitPrice ?? item.unit_price ?? 0);
          return accSum + (qty * price);
        }, 0);
        return sum + itemsSum;
      }
      return sum;
    }, 0);
  }, [invoices]);

  const togglePreCheck = (key: string) => {
    setPreCheckedState(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`pre_checklist_${tripId}`, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleClearPreChecklist = () => {
    setPreCheckedState({});
    try {
      localStorage.removeItem(`pre_checklist_${tripId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllPreChecked = () => {
    const allChecked: Record<string, boolean> = {};
    uniquePreChecklistItems.forEach(item => {
      const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
      allChecked[key] = true;
    });
    setPreCheckedState(allChecked);
    try {
      localStorage.setItem(`pre_checklist_${tripId}`, JSON.stringify(allChecked));
    } catch (e) {
      console.error(e);
    }
  };

  // Active role
  const activeRole = searchParams.get('role') || profile?.roles?.[0] || 'Stock Counter';

  // Setup Loader Items flatlist for counting/completion
  const loaderItems = React.useMemo<LoaderChecklistItem[]>(() => {
    if (activeRole !== 'Loader') return [];
    const flatList: LoaderChecklistItem[] = [];
    invoices.forEach(inv => {
      const lineItems = (inv.lineItems || inv.line_items || []) as InvoiceLineItem[];
      lineItems.forEach((item, idx: number) => {
        const stockCode = item.stockCode || item.stock_code || 'N/A';
        const description = item.description || '';
        const qty = Number(item.qty || item.quantity || 0);

        const matchingKnockdown = knockdownItems?.find(k => 
          k.parts?.some(p => p.partCode.toLowerCase().trim() === stockCode.toLowerCase().trim())
        );

        flatList.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          schoolName: inv.schoolName || inv.clientName || inv.client || inv.ship_to_details?.school_name || inv.ship_to_details?.name || 'Unknown School/Client',
          stockCode,
          description,
          qty,
          isPart: !!matchingKnockdown,
          parentItem: matchingKnockdown ? (matchingKnockdown.stockCode || null) : null,
          legacyIndex: idx
        });
      });
    });
    return flatList;
  }, [invoices, activeRole, knockdownItems]);

  // Assembler counting state
  const [activeItemToCount, setActiveItemToCount] = useState<AssemblerItemToCount | null>(null);
  const [assemblerEnteredQty, setAssemblerEnteredQty] = useState<string>('');

  const handleSaveAssemblerCount = async (item: AssemblerItemToCount, enteredCountStr: string) => {
    if (!trip) return;
    const qtyValue = parseInt(enteredCountStr, 10);
    if (isNaN(qtyValue) || qtyValue < 0 || qtyValue > item.qty) {
      alert(`Please enter a valid count between 0 and ${item.qty}.`);
      return;
    }

    const keyUnified = item.keyUnified;
    const keyLegacy = item.keyLegacy;

    setUpdatingId(keyUnified);

    try {
      const tripRef = doc(db, 'trips', trip.id);
      const checkedItems = { ...(trip.checkedItems || {}) };
      const partialItems = { ...(trip.partialItems || {}) };
      const deductedItems = { ...(trip.deductedItems || {}) };

      // Set item checked status to true (we processed/counted it)
      checkedItems[keyUnified] = true;
      checkedItems[keyLegacy] = true;

      if (qtyValue < item.qty) {
        // Auto-flag as partially completed and do not require a reason
        const partialData = {
          isPartial: true,
          actualQty: qtyValue,
          expectedQty: item.qty,
          reason: '', // No need to provide a reason or text
          stockCode: item.stockCode || 'N/A',
          description: item.description || ''
        };
        partialItems[keyUnified] = partialData;
        partialItems[keyLegacy] = partialData;
      } else {
        // Fully complete
        delete partialItems[keyUnified];
        delete partialItems[keyLegacy];
      }

      // Deduct the counted quantity from inventory the moment the item is moved to
      // assembly — but only once per item (re-saving/editing won't deduct again).
      const alreadyDeducted = deductedItems[keyUnified] !== undefined;
      const shouldDeduct = !alreadyDeducted && qtyValue > 0;
      if (shouldDeduct) {
        deductedItems[keyUnified] = qtyValue;
        deductedItems[keyLegacy] = qtyValue;
      }

      await updateDoc(tripRef, {
        checkedItems,
        partialItems,
        deductedItems,
        updatedAt: new Date().toISOString()
      });

      if (shouldDeduct) {
        const userUid = auth.currentUser?.uid || '';
        const result = await subtractSingleItemFromInventory(item.stockCode, qtyValue, userUid);
        if (!result.success) {
          console.error('Inventory deduction at assembly failed:', result.error);
        }
      }
    } catch (err) {
      console.error("Error saving assembler count:", err);
    } finally {
      setUpdatingId(null);
      setActiveItemToCount(null);
    }
  };

  const handleClearAssemblerCount = async (item: AssemblerItemToCount) => {
    if (!trip) return;

    const keyUnified = item.keyUnified;
    const keyLegacy = item.keyLegacy;

    setUpdatingId(keyUnified);

    try {
      const tripRef = doc(db, 'trips', trip.id);
      const checkedItems = { ...(trip.checkedItems || {}) };
      const partialItems = { ...(trip.partialItems || {}) };

      // Reset checked state to false (unprocessed)
      checkedItems[keyUnified] = false;
      checkedItems[keyLegacy] = false;

      // Clear from partialItems
      delete partialItems[keyUnified];
      delete partialItems[keyLegacy];

      await updateDoc(tripRef, {
        checkedItems,
        partialItems,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error clearing assembler count:", err);
    } finally {
      setUpdatingId(null);
      setActiveItemToCount(null);
    }
  };

  // Status transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    // Listen to real-time updates for this specific trip
    const tripDocRef = doc(db, 'trips', tripId);
    const unsubscribeTrip = onSnapshot(tripDocRef, async (snap) => {
      if (snap.exists()) {
        const tripData = { id: snap.id, ...snap.data() } as Trip;
        setTrip(tripData);

        // Fetch corresponding invoice details to show aggregate totals & stop counts
        if (tripData.invoiceIds && tripData.invoiceIds.length > 0) {
          try {
            const invoiceList: Invoice[] = [];
            for (const invId of tripData.invoiceIds) {
              const docSnap = await getDoc(doc(db, 'invoices', invId));
              if (docSnap.exists()) {
                invoiceList.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
              }
            }
            setInvoices(invoiceList);
          } catch (err) {
            console.error("Error loading invoices for summary:", err);
          }
        }
      } else {
        setTrip(null);
      }
      setLoadingTrip(false);
    }, (err) => {
      console.error("Error subscribing to trip detail:", err);
      setLoadingTrip(false);
    });

    return () => unsubscribeTrip();
  }, [tripId]);

  // State permission calculations
  const canModify = profile?.role === 'editor';
  
  const getRoleStatusRequirement = () => {
    if (activeRole === 'Assembler') return { required: 'proposed', label: 'Proposed' };
    if (activeRole === 'Loader') return { required: 'assembled', label: 'Assembled' };
    if (activeRole === 'Delivered Checker') return { required: 'on-route', label: 'On Route' };
    return null;
  };

  const reqStatus = getRoleStatusRequirement();
  // Stock Counter can edit in any phase, other roles must match the required status phase
  const isStatusCorrect = activeRole === 'Stock Counter' || 
    !reqStatus || 
    trip?.status === reqStatus.required ||
    (activeRole === 'Delivered Checker' && trip?.status === 'partially-completed');
  const isWritable = canModify && isStatusCorrect;

  // Handle checking off an item
  const handleToggle = async (key: string, currentVal: boolean) => {
    if (!trip || !isWritable) return;
    
    setUpdatingId(key);
    await toggleCheckItem(trip.id, key, currentVal);
    
    // Clear updating spinner with subtle delay for rich micro-feedback response
    setTimeout(() => {
      setUpdatingId(null);
    }, 400);
  };

  // Perform pipeline status transition
  const handleStatusTransition = async () => {
    if (!trip) return;
    setIsTransitioning(true);
    setTransitionError(null);

    let nextStatus = '';
    if (activeRole === 'Assembler') {
      nextStatus = 'assembled';
    } else if (activeRole === 'Loader') {
      nextStatus = 'on-route';
    } else if (activeRole === 'Delivered Checker') {
      nextStatus = 'delivered';
    }

    if (!nextStatus) {
      setIsTransitioning(false);
      return;
    }

    // When Loader submits: always advance all trip invoices to on_route.
    // If any items had missing stock (partialItems on the trip), first create
    // a PARTIAL- child invoice for each affected original invoice, then promote
    // all original trip invoices to on_route regardless.
    if (activeRole === 'Loader' && profile) {
      // ── Step 1: Create partial child invoices for any missing stock ──────────
      if (trip.partialItems) {
        try {
          const byInvoiceId: Record<string, {
            invoiceNumber: string;
            schoolName: string;
            items: { stockCode: string; description: string; missingQty: number; actualQty: number }[];
          }> = {};

          const processedKeys = new Set<string>();
          for (const loaderItem of loaderItems) {
            const keyUnified = `${loaderItem.invoiceId}_${loaderItem.stockCode || 'NO_STOCK'}_${loaderItem.description}`;
            const keyLegacy = `${loaderItem.invoiceId}_${loaderItem.stockCode}-${loaderItem.legacyIndex}`;
            if (processedKeys.has(keyUnified)) continue;
            processedKeys.add(keyUnified);

            const partial = trip.partialItems?.[keyUnified] || trip.partialItems?.[keyLegacy];
            if (!partial?.isPartial) continue;

            const missingQty = partial.expectedQty - partial.actualQty;
            if (missingQty <= 0) continue;

            if (!byInvoiceId[loaderItem.invoiceId]) {
              const origInv = invoices.find(inv => inv.id === loaderItem.invoiceId);
              const invoiceNum = String(origInv?.taxInvoice || origInv?.invoice_number || origInv?.number || origInv?.invoiceNumber || loaderItem.invoiceNumber || 'UNK');
              byInvoiceId[loaderItem.invoiceId] = {
                invoiceNumber: invoiceNum,
                schoolName: loaderItem.schoolName,
                items: []
              };
            }
            byInvoiceId[loaderItem.invoiceId].items.push({
              stockCode: loaderItem.stockCode,
              description: loaderItem.description,
              missingQty,
              actualQty: partial.actualQty
            });
          }

          const now = new Date().toISOString();
          const today = now.split('T')[0];
          const ts = Date.now();

          for (const [originalInvoiceId, group] of Object.entries(byInvoiceId)) {
            if (group.items.length === 0) continue;

            const lineItems = group.items.map(item => ({
              stockCode: item.stockCode,
              stock_code: item.stockCode,
              description: item.description,
              qty: item.missingQty,
              quantity: item.missingQty,
              unitPrice: 0,
              unit_price: 0,
              value: 0,
              line_item_value: 0
            }));

            await addDoc(collection(db, 'invoices'), {
              userId: profile.ownerId,
              status: 'partially_complete',
              invoiceNumber: `PARTIAL-${group.invoiceNumber}-${ts}`,
              taxInvoice: `PARTIAL-${group.invoiceNumber}-${ts}`,
              clientName: group.schoolName,
              schoolName: group.schoolName,
              invoiceDate: today,
              issueDate: today,
              dueDate: today,
              lineItems,
              line_items: lineItems,
              subtotal: 0,
              subTotal: 0,
              sub_total: 0,
              totalAmount: 0,
              totalDue: 0,
              parentInvoiceId: originalInvoiceId,
              isPartialInvoice: true,
              createdAt: now,
              updatedAt: now
            });

            // Update original invoice line items to reflect the actually-loaded qty.
            // Fetch raw Firestore data so we get the actual stockCode/qty fields
            // (the typed Invoice.lineItems uses a canonical LineItem shape without stockCode).
            const origInvSnap = await getDoc(doc(db, 'invoices', originalInvoiceId));
            console.log('[Step1] origInvSnap exists:', origInvSnap.exists(), 'invoiceId:', originalInvoiceId);
            if (origInvSnap.exists()) {
              const rawData = origInvSnap.data();
              console.log('[Step1] rawData keys:', Object.keys(rawData));
              console.log('[Step1] rawData.lineItems:', rawData.lineItems);
              console.log('[Step1] rawData.line_items:', rawData.line_items);
              const rawLineItems = (rawData.lineItems || rawData.line_items || []) as InvoiceLineItem[];
              console.log('[Step1] rawLineItems:', rawLineItems);
              console.log('[Step1] group.items to match against:', group.items);
              if (rawLineItems.length > 0) {
                const updatedLineItems = rawLineItems.map((lineItem: InvoiceLineItem) => {
                  const sc = (lineItem.stockCode || lineItem.stock_code || '').trim();
                  const desc = (lineItem.description || '').trim();
                  const match = group.items.find(
                    gi => gi.stockCode.trim() === sc && gi.description.trim() === desc
                  );
                  console.log(`[Step1] lineItem sc="${sc}" desc="${desc}" → match:`, match);
                  if (!match) return lineItem;
                  return { ...lineItem, qty: match.actualQty, quantity: match.actualQty };
                });
                console.log('[Step1] updatedLineItems:', updatedLineItems);
                await updateDoc(doc(db, 'invoices', originalInvoiceId), {
                  lineItems: updatedLineItems,
                  line_items: updatedLineItems,
                  updatedAt: now
                });
                console.log('[Step1] updateDoc complete for invoice:', originalInvoiceId);
              }
            }
          }
        } catch (partialErr) {
          console.error('Error creating partial invoices on loader submission:', partialErr);
          // Don't block the status transition
        }
      }

      // ── Step 2: Promote ALL original trip invoices to on_route ───────────────
      // This runs whether or not there were any partial items — the loader has
      // confirmed what's on the vehicle and the trip is now departing.
      try {
        const invoiceIds = trip.invoiceIds || [];
        if (invoiceIds.length > 0) {
          const batch = writeBatch(db);
          const now = new Date().toISOString();
          for (const invId of invoiceIds) {
            const invSnap = await getDoc(doc(db, 'invoices', invId));
            if (invSnap.exists()) {
              batch.update(doc(db, 'invoices', invId), {
                status: 'on_route',
                isPartial: false,
                updatedAt: now
              });
            }
          }
          await batch.commit();
        }
      } catch (invoiceUpdateErr) {
        console.error('Error updating trip invoices to on_route:', invoiceUpdateErr);
        // Don't block the status transition
      }

      // ── Step 3: Recompute manifestItems from the now-updated invoice line items ─
      // Step 1 already updated each original invoice's line item qty to the actual
      // loaded amount, so we just need to re-read all trip invoices and sum them up.
      // This is safer than subtracting missing qty from the old manifest value,
      // which can compound errors on re-runs or when keys don't match exactly.
      try {
        const currentManifest = trip.manifestItems || [];
        const tripInvoiceIds = trip.invoiceIds || [];
        if (currentManifest.length > 0 && tripInvoiceIds.length > 0) {
          // Re-read all trip invoices fresh from Firestore
          const manifestMap = new Map<string, number>();
          for (const invId of tripInvoiceIds) {
            const invSnap = await getDoc(doc(db, 'invoices', invId));
            if (!invSnap.exists()) continue;
            const data = invSnap.data();
            const lineItems = (data.lineItems || data.line_items || []) as InvoiceLineItem[];
            for (const lineItem of lineItems) {
              const sc = (lineItem.stockCode || lineItem.stock_code || 'N/A').trim();
              const desc = (lineItem.description || '').trim();
              const qty = Number(lineItem.qty || lineItem.quantity || 0);
              const key = `${sc}__${desc}`;
              manifestMap.set(key, (manifestMap.get(key) || 0) + qty);
            }
          }
          console.log('[Step3] recomputed manifestMap:', Object.fromEntries(manifestMap));
          const updatedManifest = currentManifest.map(manifestItem => {
            const key = `${manifestItem.stockCode.trim()}__${manifestItem.description.trim()}`;
            const recomputedQty = manifestMap.get(key);
            console.log(`[Step3] manifestItem "${manifestItem.stockCode}" old=${manifestItem.qty} recomputed=${recomputedQty}`);
            if (recomputedQty === undefined) return manifestItem;
            return { ...manifestItem, qty: recomputedQty };
          });
          await updateDoc(doc(db, 'trips', trip.id), {
            manifestItems: updatedManifest,
            updatedAt: new Date().toISOString()
          });
          console.log('[Step3] manifestItems updated:', updatedManifest);
        }
      } catch (manifestUpdateErr) {
        console.error('Error recomputing manifestItems on loader submit:', manifestUpdateErr);
        // Don't block the status transition
      }
    }

    const success = await updateTripStatus(trip.id, nextStatus);
    setIsTransitioning(false);
    if (success) {
      // Return to team dashboard preserving the role context
      navigate(`/team-dashboard?role=${encodeURIComponent(activeRole)}`);
    } else {
      setTransitionError("Credentials error updating dispatch stage. Verify write permissions are enabled.");
    }
  };

  // Calculate stats safely (unconditionally)
  const items = React.useMemo(() => trip?.manifestItems || [], [trip?.manifestItems]);
  const checkedState = React.useMemo(() => trip?.checkedItems || {}, [trip?.checkedItems]);

  const processedItems = React.useMemo(() => {
    return items.map((item, idx) => {
      const matchingKnockdown = knockdownItems?.find(k => 
        k.parts?.some(p => p.partCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim())
      );
      return {
        ...item,
        isPart: !!matchingKnockdown,
        parentItem: matchingKnockdown ? matchingKnockdown.stockCode : null,
        legacyIndex: idx
      };
    });
  }, [items, knockdownItems]);

  const groupedItems = React.useMemo(() => {
    const groupsMap: { [key: string]: typeof processedItems } = {};
    
    processedItems.forEach(item => {
      const parentCode = (item.isPart && item.parentItem) ? item.parentItem.trim() : item.stockCode.trim();
      const groupKey = parentCode || 'NO_STOCK_CODE';
      
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
  }, [processedItems]);

  if (authLoading || loadingTrip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
        <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">SYMBOLS RECOVERING...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-lg max-w-sm w-full space-y-4">
          <div className="w-12 h-12 bg-red-105 rounded-full flex items-center justify-center text-red-650 mx-auto">
            <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Trip Not Found</h3>
            <p className="text-xs text-zinc-500 mt-1">This trip may have been deleted, archived, or you do not have permission to view it.</p>
          </div>
          <Link
            to={`/team-dashboard?role=${encodeURIComponent(activeRole)}`}
            className="w-full inline-block bg-brand-primary hover:bg-zinc-800 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }



  const totalItemsCount = activeRole === 'Loader' ? loaderItems.length : items.length;

  let checkedCount = 0;
  if (activeRole === 'Loader') {
    loaderItems.forEach((item) => {
      const keyUnified = `${item.invoiceId}_${item.stockCode || 'NO_STOCK'}_${item.description}`;
      const keyLegacy = `${item.invoiceId}_${item.stockCode}-${item.legacyIndex}`;
      if (checkedState[keyUnified] || checkedState[keyLegacy]) {
        checkedCount++;
      }
    });
  } else {
    items.forEach((item, idx) => {
      const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
      const keyLegacy = `${item.stockCode}-${idx}`;
      if (checkedState[keyUnified] || checkedState[keyLegacy]) {
        checkedCount++;
      }
    });
  }

  const progressPct = totalItemsCount === 0 ? 0 : Math.round((checkedCount / totalItemsCount) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-start pb-8">
      
      {/* Short Top Bar Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-16 px-4 flex items-center shrink-0">
        <button
          onClick={() => navigate(`/team-dashboard?role=${encodeURIComponent(activeRole)}`)}
          className="p-2 text-zinc-400 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition-all mr-3 flex items-center justify-center"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-750 stroke-[3]" />
        </button>
        
        <div className="flex-1 text-center pr-10">
          <span className="text-xs font-black uppercase text-zinc-950 tracking-wider">Interactive checklist</span>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Back Link Breadcrumb */}
        <Link 
          to={`/team-dashboard?role=${encodeURIComponent(activeRole)}`} 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-accent hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          Back to Dispatch List
        </Link>

        {/* Dynamic Role-Based Screen Header Banner */}
        <div className={cn(
          "rounded-3xl p-5 border shadow-sm relative overflow-hidden flex flex-col xs:flex-row xs:items-center justify-between gap-4 text-left",
          (activeRole === 'Loader' && preChecklistStats.isCompleted) ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800' :
          activeRole === 'Stock Counter' ? 'bg-emerald-50/40 border-emerald-200 text-emerald-850' :
          activeRole === 'Assembler' ? 'bg-blue-50/40 border-blue-200 text-blue-800' :
          activeRole === 'Loader' ? 'bg-amber-50/40 border-amber-200 text-amber-800' :
          activeRole === 'Delivered Checker' ? 'bg-purple-50/40 border-purple-200 text-purple-800' :
          'bg-zinc-50 border-zinc-200'
        )}>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs transition-colors duration-350",
              (activeRole === 'Loader' && preChecklistStats.isCompleted) ? 'bg-emerald-100 border-emerald-200/50 text-emerald-600' :
              activeRole === 'Stock Counter' ? 'bg-emerald-100 border-emerald-200/50 text-emerald-600' :
              activeRole === 'Assembler' ? 'bg-blue-100 border-blue-200/50 text-blue-600' :
              activeRole === 'Loader' ? 'bg-amber-100 border-amber-200/50 text-amber-600' :
              activeRole === 'Delivered Checker' ? 'bg-purple-100 border-purple-200/50 text-purple-600' :
              'bg-zinc-100 text-zinc-650'
            )}>
              {activeRole === 'Stock Counter' && <Shield className="w-5 h-5 stroke-[2.5]" />}
              {activeRole === 'Assembler' && <Package className="w-5 h-5 stroke-[2.5]" />}
              {activeRole === 'Loader' && (
                preChecklistStats.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-emerald-600 animate-bounce" />
                ) : (
                  <Truck className="w-5 h-5 stroke-[2.5]" />
                )
              )}
              {activeRole === 'Delivered Checker' && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest leading-none block text-zinc-400 mb-0.5">Role Station View</span>
              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-zinc-900 leading-tight">
                {activeRole === 'Stock Counter' ? 'Stock Counter Station' :
                 activeRole === 'Assembler' ? 'Assembly & Prep Dock' :
                 activeRole === 'Loader' ? (preChecklistStats.isCompleted ? 'Staged & Loader Pier' : 'Loading & Staging Pier') :
                 activeRole === 'Delivered Checker' ? 'Delivery Check-Off Proof' :
                 activeRole}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                {activeRole === 'Stock Counter' ? 'Assessing general inventory lines & physical count tallies.' :
                 activeRole === 'Assembler' ? 'Packaging, bundle prepping, and staging items for cargo launch.' :
                 activeRole === 'Loader' ? (preChecklistStats.isCompleted ? 'All items fully checked off and staging is complete on the pier!' : 'Securing load balances and locking freight inside vehicles.') :
                 activeRole === 'Delivered Checker' ? 'Recapping goods offloaded at drop-off client spots.' :
                 'Viewing shared trip records.'}
              </p>
            </div>
          </div>

          {activeRole === 'Loader' && (
            <button
              type="button"
              id="preload-checklist-trigger"
              onClick={() => setShowPreChecklist(true)}
              className={cn(
                "xs:self-center shrink-0 font-sans font-black tracking-wider text-[10px] uppercase px-4 py-2.5 rounded-2xl flex items-center justify-center shadow-sm transition-all active:scale-95 cursor-pointer border",
                preChecklistStats.isCompleted
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 hover:shadow-emerald-100"
                  : "bg-amber-600 hover:bg-amber-700 text-white border-amber-700 hover:shadow-amber-100"
              )}
            >
              <span>Pre-Checklist ({preChecklistStats.checkedCount}/{preChecklistStats.totalCount})</span>
            </button>
          )}
        </div>

        {/* Trip Core Info Header */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex justify-between items-start gap-4 pb-4 border-b border-zinc-100">
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {trip.date}
              </p>
              <h2 className="text-lg font-black text-zinc-950 capitalize mt-1 leading-tight">{trip.name}</h2>
            </div>
            
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border shrink-0 ${
              trip.status === 'on-route' 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : trip.status === 'completed' || trip.status === 'invoiced'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
            }`}>
              {trip.status}
            </span>
          </div>

          {/* Aggregate Overview statistics metrics */}
          <div className="grid grid-cols-3 gap-3">
            
            {/* Truck Details */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <Truck className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Vehicle</p>
              <p className="text-xs font-black text-zinc-800 uppercase truncate">
                {trip.truckName || trip.truckId}
              </p>
            </div>

            {/* Total Invoices */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Invoices</p>
              <p className="text-xs font-black text-zinc-800">
                {trip.invoiceIds?.length || 0}
              </p>
            </div>

            {/* Total value */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <DollarSign className="w-4 h-4 text-emerald-500 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Trip Value</p>
              <p className="text-xs font-black text-zinc-800 truncate">
                R{totalFinancialValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

          </div>
        </div>

        {/* Loading / Checklist ratio indicator cards */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-black uppercase text-zinc-400 tracking-wider">
            <span className="flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="w-4 h-4 text-brand-accent stroke-[2.5]" />
              {activeRole === 'Stock Counter' ? 'Verification Fraction' :
               activeRole === 'Assembler' ? 'Assembled Fraction' :
               activeRole === 'Loader' ? 'Loaded Fraction' :
               'Delivered Fraction'}
            </span>
            <span className="font-mono text-zinc-900">{checkedCount} of {totalItemsCount} completed</span>
          </div>

          {/* Mini dynamic slider */}
          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
            <div 
              className={`h-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-brand-accent'} transition-all duration-300`}
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>

          {/* Pipeline Expansion Action Trigger Button */}
          {progressPct === 100 && totalItemsCount > 0 && isWritable && activeRole !== 'Stock Counter' && (
            <div className="pt-4 border-t border-zinc-150 space-y-2 animate-fade-in">
              <p className="text-[11px] text-zinc-550 text-left leading-relaxed">
                🎉 Excellent work! All <strong>{totalItemsCount} items</strong> are checked off. Switch the dispatch stage to advance:
              </p>
              <button
                type="button"
                onClick={handleStatusTransition}
                disabled={isTransitioning}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary hover:bg-zinc-850 disabled:bg-zinc-450 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-md active:scale-[0.99]"
              >
                {isTransitioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {activeRole === 'Assembler' && 'Complete Assembly & Stage Cargo 📦'}
                    {activeRole === 'Loader' && 'Mark Staged Cargo Loaded & Depart Vehicle 🚚'}
                    {activeRole === 'Delivered Checker' && 'Complete Delivery Logs & Register Closure ✅'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {transitionError && (
                <p className="text-[10px] text-red-600 font-extrabold text-left">{transitionError}</p>
              )}
            </div>
          )}
        </div>

        {/* Verification Locked Badge */}
        {!isStatusCorrect && reqStatus && (
          <div className="bg-amber-50/75 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Verification Locked</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                This dispatch is currently in <span className="font-extrabold capitalize text-amber-900">“{trip.status}”</span> state. 
                Only dispatches in <span className="font-extrabold capitalize text-amber-900">“{reqStatus.required}”</span> status are writable inside the <span className="font-black text-amber-950">{activeRole}</span> role view.
              </p>
            </div>
          </div>
        )}

        {/* Permission Limit Notification banners */}
        {profile?.role === 'viewer' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Read-Only Permission Active</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                You are logged in with Viewer limits. Checkbox controls are locked to read-only state.
              </p>
            </div>
          </div>
        )}

        {/* Core Checklist Item loop lists */}
        <div className="space-y-3">
          {activeRole === 'Loader' ? (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono px-1 text-left">Manifest Items Grouped by Invoice ({invoices.length})</h3>
          ) : (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono px-1 text-left">Manifest Items List ({items.length})</h3>
          )}

          {activeRole === 'Loader' && invoices.length === 0 ? (
            <div className="bg-white rounded-3xl py-12 border border-zinc-200 text-center text-zinc-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
              Loading invoices for grouped loader view...
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-3xl py-12 border border-zinc-200 text-center text-zinc-400 text-xs">
              No manifest items listed on this dispatch's invoices.
            </div>
          ) : activeRole === 'Loader' ? (
            <div className="space-y-6">
              {[...invoices].reverse().map((inv, index, arr) => {
                const schoolName = inv.schoolName || inv.clientName || inv.client || inv.ship_to_details?.school_name || inv.ship_to_details?.name || 'Unknown School';
                const currentInvoiceNumber = inv.invoiceNumber || inv.taxInvoice || inv.invoice_number || inv.number || 'N/A';
                const lineItems = inv.lineItems || inv.line_items || [];
                const deliveryStopNumber = arr.length - index;

                return (
                  <div key={inv.id || currentInvoiceNumber} className="border border-zinc-200 rounded-3xl p-5 bg-white shadow-xs space-y-4 text-left animate-fade-in">
                    {/* Invoice Header Block with Loading Order Priority */}
                    <div className="pb-3 border-b border-zinc-150 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <h4 className="text-sm font-black text-zinc-950 uppercase">
                            #{currentInvoiceNumber}
                          </h4>
                          {index === 0 ? (
                            <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full">
                              LOAD FIRST (Deep Front)
                            </span>
                          ) : index === arr.length - 1 ? (
                            <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-700 border border-blue-250/50 px-2 py-0.5 rounded-full">
                              LOAD LAST (Near Door)
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                              LOAD STEP #{index + 1}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-zinc-500">
                          {schoolName}
                        </p>
                      </div>
                      
                      {/* Step Indicator Badge */}
                      <div className="sm:text-right shrink-0">
                        <span className="text-[9px] font-mono font-semibold text-zinc-400 block uppercase tracking-wider">
                          Delivery Sequence
                        </span>
                        <span className="text-xs font-mono font-black text-zinc-900 block mt-0.5">
                          Stop #{deliveryStopNumber} of {arr.length}
                        </span>
                      </div>
                    </div>

                    {/* Invoice Products */}
                    <div className="space-y-3">
                      {lineItems.map((lineItem: InvoiceLineItem, idx: number) => {
                        const stockCode = lineItem.stockCode || lineItem.stock_code || 'N/A';
                        const description = lineItem.description || '';
                        const qty = Number(lineItem.qty || lineItem.quantity || 0);

                        const matchingKnockdown = knockdownItems?.find(k => 
                          k.parts?.some(p => p.partCode.toLowerCase().trim() === stockCode.toLowerCase().trim())
                        );
                        const isPart = !!matchingKnockdown;
                        const parentItem = matchingKnockdown ? matchingKnockdown.stockCode : null;

                        const keyUnified = `${inv.id}_${stockCode || 'NO_STOCK'}_${description}`;
                        const keyLegacy = `${inv.id}_${stockCode}-${idx}`;
                        const isChecked = !!(checkedState[keyUnified] || checkedState[keyLegacy]);
                        const isUpdating = updatingId === keyUnified || updatingId === keyLegacy;
                        const canCheck = isWritable;

                        return (
                          <div
                            key={`${inv.id}-${stockCode}-${idx}`}
                            onClick={() => {
                              if (!canCheck || isUpdating) return;
                              setActiveItemToCount({ 
                                stockCode, 
                                description, 
                                qty, 
                                keyUnified, 
                                keyLegacy,
                                isPart,
                                parentItem
                              });
                              setAssemblerEnteredQty('');
                            }}
                            className={cn(
                              "bg-white rounded-2xl p-4 border transition-all flex flex-col gap-3 select-none",
                              canCheck ? "cursor-pointer active:scale-[0.995]" : "cursor-default opacity-75",
                              isChecked 
                                ? "border-emerald-250 bg-emerald-50/10" 
                                : "border-zinc-200 hover:border-zinc-300 bg-white"
                            )}
                          >
                            <div className="flex items-start gap-4 w-full">
                              {/* Visual Check Indicator */}
                              <div className="mt-0.5 shrink-0">
                                {isUpdating ? (
                                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                                ) : isChecked ? (
                                  <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white border border-emerald-600 shadow-sm animate-scale-up">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "w-5 h-5 border-2 rounded-lg bg-zinc-50 transition-all",
                                    canCheck ? "border-zinc-300 hover:border-zinc-400" : "border-zinc-200"
                                  )}></div>
                                )}
                              </div>

                              {/* Item Details */}
                              <div className="flex-grow space-y-1 text-left min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 border border-zinc-150 px-2 py-0.5 rounded truncate flex items-center gap-1.5 leading-none">
                                    <span>{stockCode}</span>
                                    {isPart && (
                                      <span className="text-[8px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded shrink-0">
                                        Part of {parentItem}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs font-black text-zinc-950 font-mono shrink-0">
                                    Qty: {qty}
                                  </span>
                                </div>
                                
                                <h4 className={cn(
                                  "text-xs font-bold leading-relaxed transition-all truncate",
                                  isChecked ? "text-zinc-400 line-through" : "text-zinc-800"
                                )}>
                                  {description}
                                </h4>
                              </div>
                            </div>

                            {/* Rendering dynamic partially complete flags */}
                            {(() => {
                              const partialInfo = trip?.partialItems?.[keyUnified] || trip?.partialItems?.[keyLegacy];
                              return (
                                <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                                  {partialInfo?.isPartial && (
                                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 mb-2">
                                      <div className="flex items-center justify-between text-[11px] font-mono text-amber-850">
                                        <span className="flex items-center gap-1 font-bold">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          PARTIALLY LOADED
                                        </span>
                                        <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                          {partialInfo.actualQty} / {partialInfo.expectedQty} units
                                        </span>
                                      </div>
                                      
                                      {/* Comparative Visual Bar */}
                                      <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden flex">
                                        <div 
                                          className="bg-emerald-500 h-full" 
                                          style={{ width: `${(partialInfo.actualQty / partialInfo.expectedQty) * 100}%` }}
                                        ></div>
                                        <div className="bg-amber-500 h-full flex-1"></div>
                                      </div>
                                      <div className="flex justify-between text-[9px] font-mono font-bold text-amber-700">
                                        <span>Loaded: {partialInfo.actualQty} units</span>
                                        <span>Missing: {partialInfo.expectedQty - partialInfo.actualQty} units</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedItems.map((group) => (
                <div key={group.groupCode} className="border border-zinc-200 rounded-3xl p-4 bg-zinc-50/20 space-y-2.5 text-left animate-fade-in">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150">
                    <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group Code</span>
                    <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-md shadow-xs">
                      {group.groupCode}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => {
                      const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                      const keyLegacy = `${item.stockCode}-${item.legacyIndex}`;
                      const isChecked = !!(checkedState[keyUnified] || checkedState[keyLegacy]);
                      const isUpdating = updatingId === keyUnified || updatingId === keyLegacy;
                      const canCheck = isWritable;
                      // Delivered Checker's own partial flag (non-invoice-prefixed key)
                      const ownPartialInfo = trip?.partialItems?.[keyUnified]
                        ?? trip?.partialItems?.[keyLegacy];

                      // Aggregate loader partials across all invoices for this manifest item
                      const allPartialValues = Object.values(trip?.partialItems || {});
                      const matchingLoaderPartials = allPartialValues.filter(
                        p => p?.isPartial &&
                             p.stockCode === item.stockCode &&
                             p.description === item.description
                      );
                      const totalMissing = matchingLoaderPartials.reduce(
                        (sum, p) => sum + (p.expectedQty - p.actualQty), 0
                      );
                      const totalExpected = matchingLoaderPartials.reduce((sum, p) => sum + p.expectedQty, 0);
                      const totalActual = totalExpected;
                      console.log(`[Display] sc="${item.stockCode}" desc="${item.description}" item.qty=${item.qty}`, { ownPartialInfo, matchingLoaderPartials, totalMissing, totalExpected, totalActual });

                      // Synthetic partialInfo for the amber banner
                      const partialInfo = ownPartialInfo?.isPartial
                        ? ownPartialInfo
                        : matchingLoaderPartials.length > 0 && totalMissing > 0
                        ? {
                            isPartial: true,
                            actualQty: totalActual,
                            expectedQty: totalExpected,
                            reason: '',
                            stockCode: item.stockCode,
                            description: item.description
                          }
                        : undefined;

                      // Use the live invoice sum rather than manifestItems.qty,
                      // since invoice line items are updated to actualQty by Step 1
                      // at loader submit time and are always the source of truth.
                      const invoiceKey = `${item.stockCode.trim()}__${item.description.trim()}`;
                      const invoiceTotalQty = qtyFromInvoices.get(invoiceKey) ?? item.qty;
                      console.log(`[Display] sc="${item.stockCode}" invoiceKey="${invoiceKey}" invoiceTotalQty=${invoiceTotalQty} item.qty=${item.qty}`);
                      const displayQty = ownPartialInfo?.isPartial
                        ? ownPartialInfo.actualQty
                        : invoiceTotalQty;

                      return (
                        <div
                          key={`${item.stockCode}-${item.legacyIndex}`}
                          onClick={() => {
                            if (!canCheck || isUpdating) return;
                            if (activeRole === 'Assembler' || activeRole === 'Loader') {
                              const partialInfo = trip?.partialItems?.[keyUnified] || trip?.partialItems?.[keyLegacy];
                              const currentCount = partialInfo?.isPartial 
                                ? partialInfo.actualQty 
                                : (isChecked ? item.qty : item.qty);
                              setActiveItemToCount({ ...item, keyUnified, keyLegacy });
                              setAssemblerEnteredQty(activeRole === 'Loader' ? '' : currentCount.toString());
                            } else {
                              handleToggle(keyUnified, isChecked);
                            }
                          }}
                          className={cn(
                            "bg-white rounded-2xl p-4 border transition-all flex flex-col gap-3 select-none",
                            canCheck ? "cursor-pointer active:scale-[0.995]" : "cursor-default opacity-75",
                            isChecked 
                              ? "border-emerald-250 bg-emerald-50/10" 
                              : "border-zinc-200 hover:border-zinc-300 bg-white"
                          )}
                        >
                          <div className="flex items-start gap-4 w-full">
                            {/* Visual Check / Uncheck Box */}
                            <div className="mt-0.5 shrink-0">
                              {isUpdating ? (
                                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                              ) : isChecked ? (
                                <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white border border-emerald-600 shadow-sm animate-scale-up">
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className={cn(
                                  "w-5 h-5 border-2 rounded-lg bg-zinc-50 transition-all",
                                  canCheck ? "border-zinc-300 hover:border-zinc-400" : "border-zinc-200"
                                )}></div>
                              )}
                            </div>

                            {/* Content Detail */}
                            <div className="flex-grow space-y-1 text-left min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 border border-zinc-150 px-2 py-0.5 rounded truncate flex items-center gap-1.5 leading-none">
                                  <span>{item.stockCode}</span>
                                  {item.isPart && (
                                    <span className="text-[8px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded shrink-0">
                                      Part of {item.parentItem}
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs font-black text-zinc-950 font-mono shrink-0">
                                  Qty: {displayQty}
                                </span>
                              </div>
                              
                              <h4 className={cn(
                                "text-xs font-bold leading-relaxed transition-all truncate",
                                isChecked ? "text-zinc-400 line-through" : "text-zinc-800"
                              )}>
                                {item.description}
                              </h4>
                            </div>
                          </div>

                          {/* Rendering dynamic partially complete flags */}
                          {(() => {
                            return (
                              <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                                {partialInfo?.isPartial && (
                                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 mb-2">
                                    <div className="flex items-center justify-between text-[11px] font-mono text-amber-850">
                                      <span className="flex items-center gap-1 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        PARTIALLY COMPLETE
                                      </span>
                                      <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                        {partialInfo.actualQty} / {partialInfo.expectedQty} units
                                      </span>
                                    </div>
                                    {partialInfo.reason && (
                                      <p className="text-[10px] text-amber-800 font-medium font-sans">
                                        <strong>Reason:</strong> {partialInfo.reason}
                                      </p>
                                    )}
                                    {/* Comparative Visual Bar */}
                                    <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden flex">
                                      <div 
                                        className="bg-emerald-500 h-full" 
                                        style={{ width: `${(partialInfo.actualQty / partialInfo.expectedQty) * 100}%` }}
                                      ></div>
                                      <div className="bg-amber-500 h-full flex-1"></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono font-bold text-amber-700">
                                      <span>Present: {partialInfo.actualQty} units</span>
                                      <span>Missing: {partialInfo.expectedQty - partialInfo.actualQty} units</span>
                                    </div>
                                    {isWritable && activeRole !== 'Assembler' && activeRole !== 'Loader' && ownPartialInfo?.isPartial && (
                                      <div className="flex gap-2 justify-end pt-1">
                                        <button
                                          onClick={() => {
                                            updatePartialItem(trip.id, keyUnified, null);
                                          }}
                                          className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded"
                                        >
                                          Clear Flag
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingPartialKey(keyUnified);
                                            setLocalActualQty(partialInfo.actualQty);
                                            setLocalReason(partialInfo.reason);
                                          }}
                                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded"
                                        >
                                          Edit Flag
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isWritable && editingPartialKey === keyUnified && (
                                  <div className="p-3 bg-zinc-50 border border-zinc-250 rounded-xl space-y-3 antialiased">
                                    <div className="flex justify-between items-center border-b border-zinc-150 pb-1.5">
                                      <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider font-mono">Flag Partial Deliverable</span>
                                      <button title='setEditingPartialKey' onClick={() => setEditingPartialKey(null)} className="text-zinc-400 hover:text-zinc-650">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">Actual Qty there:</label>
                                      <input aria-label="Actual Qty there"
                                        type="number"
                                        min={0}
                                        max={item.qty - 1}
                                        value={localActualQty}
                                        onChange={(e) => setLocalActualQty(Math.max(0, Math.min(item.qty - 1, Number(e.target.value))))}
                                        className="block w-24 bg-white border border-zinc-300 rounded-lg p-1.5 text-xs font-black text-center"
                                      />
                                      <div className="text-[9px] text-amber-700 font-mono flex justify-between pt-1">
                                        <span>Units there: {localActualQty}</span>
                                        <span>Missing amount: {item.qty - localActualQty}</span>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">Reason for discrepancy:</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Broken packaging, product shortage"
                                        value={localReason}
                                        onChange={(e) => setLocalReason(e.target.value)}
                                        className="block w-full bg-white border border-zinc-300 rounded-lg p-2 text-xs text-zinc-800"
                                      />
                                    </div>
                                    <div className="flex gap-2 justify-end pt-1">
                                      <button
                                        onClick={() => setEditingPartialKey(null)}
                                        className="px-2.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded-lg"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!localReason.trim()) {
                                            alert("Please enter a reason for flagging this item as partially complete.");
                                            return;
                                          }
                                          await updatePartialItem(trip.id, keyUnified, {
                                            isPartial: true,
                                            actualQty: localActualQty,
                                            expectedQty: item.qty,
                                            reason: localReason,
                                            stockCode: item.stockCode || 'N/A',
                                            description: item.description || ''
                                          });
                                          setEditingPartialKey(null);
                                        }}
                                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded-lg"
                                      >
                                        Save Flag
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>



      </main>

      {/* Assembler counting Modal dialog */}
      {activeItemToCount && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left" onClick={() => setActiveItemToCount(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-zinc-200 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200 select-all">
                  {activeItemToCount.stockCode || 'N/A'}
                </span>
                <h3 className="font-sans font-black text-sm text-zinc-900 mt-1 uppercase leading-tight">
                  {activeRole === 'Assembler' ? 'Define Assembled Count' : activeRole === 'Loader' ? 'Define Loaded Count' : 'Define Physical Count'}
                </h3>
              </div>
              <button
              title='setActiveItemToCount'
                type="button"
                onClick={() => setActiveItemToCount(null)}
                className="p-1 hover:bg-zinc-100 text-zinc-400 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] font-medium text-zinc-500 leading-normal">
              Enter the exact physical quantity {activeRole === 'Assembler' ? 'assembled' : activeRole === 'Loader' ? 'loaded' : 'counted'} for <strong className="text-zinc-850">{activeItemToCount.description}</strong>:
            </p>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {activeRole === 'Assembler' ? 'Assembled Quantity' : activeRole === 'Loader' ? 'Loaded Quantity' : 'Physical Quantity'}
                </label>
                <span className="text-[10px] font-mono text-zinc-400">Expected: {activeItemToCount.qty}</span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                placeholder={`e.g. ${activeItemToCount.qty}`}
                value={assemblerEnteredQty}
                onChange={(e) => setAssemblerEnteredQty(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans text-sm font-black text-zinc-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveAssemblerCount(activeItemToCount, assemblerEnteredQty)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Set Count
              </button>
              <button
                type="button"
                onClick={() => handleClearAssemblerCount(activeItemToCount)}
                className="px-3 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loader Pre-Checklist Modal */}
      {showPreChecklist && trip && (
        <div 
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left"
          onClick={() => setShowPreChecklist(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-zinc-200 shadow-2xl animate-scale-up flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between shrink-0 font-sans">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 border border-amber-200">
                  <ClipboardList className="w-5 h-5 stroke-[2] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-tight">
                    Staging Pre-Checklist
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400 block mt-0.5 uppercase tracking-wide">
                    Trip: {trip.name}
                  </span>
                </div>
              </div>
              <button
                title='setShowPreChecklist'
                type="button"
                onClick={() => setShowPreChecklist(false)}
                className="p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>



            {/* List Group Host Area */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {uniquePreChecklistItems.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-mono">
                  No items available for this dispatch.
                </div>
              ) : (
                uniquePreChecklistItems.map((item, idx) => {
                  const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
                  const isChecked = !!preCheckedState[key];

                  return (
                    <div
                      key={`pre-item-${item.stockCode}-${idx}`}
                      onClick={() => togglePreCheck(key)}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 select-none cursor-pointer active:scale-[0.99]",
                        isChecked
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      )}
                    >
                      {/* Custom Checked box design */}
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <div className="w-4 h-4 bg-amber-600 rounded flex items-center justify-center text-white border border-amber-700 shadow-sm">
                            <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 border border-zinc-300 rounded bg-zinc-50/50 hover:border-zinc-400"></div>
                        )}
                      </div>

                      <div className="flex-grow min-w-0 text-left">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-[10px] font-mono font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded truncate">
                            {item.stockCode}
                          </span>
                          <span className="text-xs font-mono font-black text-zinc-900 shrink-0 bg-zinc-100/80 px-2 py-0.5 rounded-full border border-zinc-200">
                            Qty: {item.qty}
                          </span>
                        </div>
                        <p className={cn(
                          "text-[11px] font-semibold text-zinc-700 leading-snug mt-1.5",
                          isChecked && "text-zinc-400 line-through"
                        )}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Progress bar */}
            {uniquePreChecklistItems.length > 0 && (
              <div className="border-t border-zinc-150 pt-4 space-y-3 bg-white shrink-0">
                {/* Stats row & percentage */}
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="font-black text-zinc-500 uppercase text-[9px] tracking-wide">Staging Progress</span>
                  <span className="font-bold text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                    {(() => {
                      let checkedCount = 0;
                      uniquePreChecklistItems.forEach(item => {
                        const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
                        if (preCheckedState[key]) {
                          checkedCount++;
                        }
                      });
                      const totalCount = uniquePreChecklistItems.length;
                      const pct = totalCount === 0 ? 0 : Math.round((checkedCount / totalCount) * 100);
                      return `${checkedCount} / ${totalCount} items (${pct}%)`;
                    })()}
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{
                      width: `${(() => {
                        let checkedCount = 0;
                        uniquePreChecklistItems.forEach(item => {
                          const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
                          if (preCheckedState[key]) {
                            checkedCount++;
                          }
                        });
                        const totalCount = uniquePreChecklistItems.length;
                        return totalCount === 0 ? 0 : (checkedCount / totalCount) * 100;
                      })()}%`
                    }}
                  ></div>
                </div>

                {/* Actions Row */}
                <div className="flex gap-2.5 pt-2 flex-wrap items-center">
                  <button
                    type="button"
                    onClick={handleClearPreChecklist}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Reset List
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAllPreChecked}
                    className="px-3.5 py-2 bg-amber-100 hover:bg-amber-205 text-amber-800 border border-amber-250 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Check All
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreChecklist(false)}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-805 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer text-center"
                  >
                    Done & Staged
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
