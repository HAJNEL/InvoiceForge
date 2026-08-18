import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface UIInvoice {
  id: string;
  number: string;
  client: string;
  schoolName?: string;
  amount: number;
  date: string;
  status: string;
  clientEmail: string;
  district?: string;
  // Additive fields for Stock Control (Product Phases) — optional since most
  // existing invoice docs won't carry them yet; render blank when absent.
  schoolType?: string;
  clientNumber?: string;
  priority?: 'normal' | 'high' | 'urgent';
  dueDate?: string;
  // The school's own purchase order number (e.g. "OR-012159"), distinct from
  // `number` above which is this document's own tax invoice number (e.g.
  // "118258") — Stock Control shows this one wherever it labels an "Order No.".
  orderNumber?: string;
  // Canonical pin address: the Google-resolved school address, or a manual
  // override entered on the invoice edit screens. See src/lib/geocoding.ts.
  deliveryAddress?: string;
  // True when `deliveryAddress` was entered/edited by a user, so Refresh Pins
  // preserves it instead of overwriting it with a fresh school lookup.
  deliveryAddressManual?: boolean;
  deliveryAddressLine1?: string;
  deliveryAddressLine2?: string;
  deliveredDate?: string;
  parentInvoiceId?: string | null;
  // Delivery note number captured during AI extraction (see ExtractionReview.tsx).
  deliveryNoteNo?: string;
  // Delivery distance in km, entered manually on the invoice detail page.
  // Drives the Local (<50km) vs Regional (>=50km) revenue split in Reports.
  distanceKm?: number;
  stopDetails?: {
    location?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    duration?: string;
  } | null;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}

interface InvoicesState {
  invoices: UIInvoice[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache: useInvoices() is called from ~10 independent
// screens/components (Dashboard, Invoice List, Invoice Form, Invoice Detail,
// Reports, Trip Form, Trip List, Product List, and the Knockdown Setup dialog
// rendered inside it). Each previously subscribed to the entire invoices
// collection and re-mapped every document on its own. Now the listener and
// mapped array are shared by every caller.
let state: InvoicesState = { invoices: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: InvoicesState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ invoices: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'invoices';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        number: d.taxInvoice || d.invoiceNumber || '#NO-NUM',
        client: d.schoolName || d.customerName || d.clientName || 'Unknown Client',
        schoolName: d.schoolName || d.ship_to_details?.school_name || d.shipToDetails?.schoolName || '',
        amount: d.subTotal !== undefined ? d.subTotal : (d.sub_total !== undefined ? d.sub_total : (d.summary?.sub_total !== undefined ? d.summary.sub_total : (d.summary?.subTotal !== undefined ? d.summary.subTotal : (d.totalDue || d.amountIncl || d.totalAmount || 0)))),
        date: d.invoiceDate || d.issueDate || 'N/A',
        status: d.status || 'draft',
        clientEmail: d.email || d.customerContact || 'No Email',
        district: d.district || d.deliveryRegion || 'Unassigned',
        schoolType: d.schoolType || '',
        clientNumber: d.clientNumber || '',
        priority: (d.priority === 'high' || d.priority === 'urgent') ? d.priority : 'normal',
        dueDate: d.dueDate || '',
        orderNumber: d.customerPO || d.customer_purchase_order_number || '',
        deliveryAddress: d.deliveryAddress || '',
        deliveryAddressManual: d.deliveryAddressManual === true,
        deliveryAddressLine1: d.deliveryAddressLine1 || '',
        deliveryAddressLine2: d.deliveryAddressLine2 || '',
        deliveredDate: d.deliveredDate || '',
        parentInvoiceId: d.parentInvoiceId || null,
        deliveryNoteNo: d.delivery_note_number || d.deliveryNoteNo || '',
        distanceKm: typeof d.distanceKm === 'number' ? d.distanceKm : undefined,
        stopDetails: d.stopDetails || null,
        lineItems: (d.line_items || d.lineItems || []).map((item: Record<string, unknown>) => ({
          stockCode: String(item.stock_code || item.stockCode || ''),
          description: String(item.description || ''),
          qty: Number(item.quantity ?? item.qty ?? 0) || 0,
          unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0) || 0,
          value: Number(item.line_item_value ?? item.value ?? 0) || 0,
        }))
      };
    });

    // Basic client-side sort by date descending if we don't have a reliable server order yet
    data.sort((a, b) => b.date.localeCompare(a.date));

    setState({ invoices: data, loading: false, error: null });
  }, (err) => {
    console.error("Firestore Subscribe Error:", err);
    setState({ ...state, loading: false, error: err.message });
    // Only handle error if it's a permission issue or similar that needs reporting as per guidelines
    if (err.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  });
}

function subscribe(userId: string | null) {
  return (listener: () => void) => {
    listeners.add(listener);
    ensureSubscription(userId);
    return () => {
      listeners.delete(listener);
    };
  };
}

function getSnapshot() {
  return state;
}

export function useInvoices() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const invoicesState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  const addInvoice = useCallback(async (data: Partial<Record<string, unknown>>) => {
    if (!user) return null;
    const path = 'invoices';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...data,
        status: data.status || 'draft',
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const deleteInvoice = useCallback(async (id: string) => {
    const path = `invoices/${id}`;
    try {
      await deleteDoc(doc(db, 'invoices', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  const updateInvoice = useCallback(async (id: string, data: Partial<Record<string, unknown>>) => {
    const path = `invoices/${id}`;

    // Check if transition to 'invoiced' or complete is being attempted
    const newStatus = typeof data.status === 'string' ? data.status.toLowerCase() : '';
    if (newStatus === 'invoiced' || newStatus === 'complete' || newStatus === 'completed') {
      // Read from the shared cache so this check always sees the latest data,
      // regardless of which component's useInvoices() call triggered it.
      const currentInvoice = state.invoices.find(inv => inv.id === id);
      if (currentInvoice) {
        const baseNumber = currentInvoice.number.replace(/-R$/, '');
        const relatedInvoices = state.invoices.filter(inv => {
          const invBase = inv.number.replace(/-R$/, '');
          return invBase === baseNumber || inv.parentInvoiceId === currentInvoice.id || (currentInvoice.parentInvoiceId && inv.id === currentInvoice.parentInvoiceId);
        });

        // Any related invoice which is NOT in a delivered status blocks this
        const hasUndelivered = relatedInvoices.some(inv => {
          const s = inv.status.toLowerCase();
          return s !== 'delivered' && s !== 'invoiced' && s !== 'complete' && s !== 'completed';
        });

        if (hasUndelivered) {
          toast.error('Action Blocked', { description: `Invoice ${baseNumber} is partially complete. Both the original and split pieces must be marked "Delivered" before invoicing.` });
          return false;
        }
      }
    }

    try {
      await updateDoc(doc(db, 'invoices', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  return { invoices: invoicesState.invoices, loading: invoicesState.loading, error: invoicesState.error, addInvoice, deleteInvoice, updateInvoice };
}
