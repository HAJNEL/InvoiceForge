import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, collection, query, where, getDocs, limit, updateDoc, writeBatch } from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../core/hooks/useAuth';
import { TeamMember, Trip, DayPlanner } from '../../types';
import { KnockdownItem } from '../stock/hooks/useStock';

export interface TeamInventoryItem {
  id: string;
  stockCode: string;
  description: string;
  displayName: string;
  qty: number;
  isPart?: boolean;
  parentItem?: string | null;
  createdAt?: string;
  userId?: string;
}

export interface UIDashboardInvoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  date: string;
  status: string;
  district: string;
  deliveryAddress: string;
  lineItems: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}

export interface StockTakeItem {
  id: string;
  stockCode: string;
  description: string;
  qty: number;
  submittedBy?: string;
  submittedAt?: string;
  status: string;
  userId?: string;
  submittedByUserId?: string;
}

export interface StockTakeSubmission {
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
    status: string;
  }[];
}

export interface CatalogProduct {
  id: string;
  stockCode: string;
  description: string;
  unitPrice: number;
  category?: 'product' | 'consumable';
  userId: string;
}

export function useTeamDashboard() {
  const { user } = useAuth();

  // States
  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [invoices, setInvoices] = useState<UIDashboardInvoice[]>([]);
  const [invoicesCount, setInvoicesCount] = useState<number | null>(null);
  const [knockdownItems, setKnockdownItems] = useState<KnockdownItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [inventoryItems, setInventoryItems] = useState<TeamInventoryItem[]>([]);
  const [teamStockSubmissions, setTeamStockSubmissions] = useState<StockTakeItem[]>([]);
  const [teamStockTakes, setTeamStockTakes] = useState<StockTakeSubmission[]>([]);
  const [dayPlanners, setDayPlanners] = useState<DayPlanner[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorWord, setErrorWord] = useState('');

  // 1. Fetch member profile first, or redirect if owner
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function resolveRole() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'team_members'),
          where('userId', '==', user.uid),
          limit(1)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          // No team profile exists, so this is the main account owner.
          // Give them a synthetic profile covering every role so the team
          // dashboard loads directly for them, without a redirect or a second login.
          setIsOwner(true);
          setProfile({
            id: user.uid,
            ownerId: user.uid,
            firstName: user.email?.split('@')[0] || 'Account',
            lastName: 'Owner',
            email: user.email || '',
            role: 'editor',
            inviteCode: '',
            status: 'active',
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            roles: ['Assembler', 'Loader', 'Delivered Checker', 'Stock Counter', 'Invoice Management', 'Trip Overview'],
          });
          return;
        }

        const profileData = { id: snap.docs[0].id, ...snap.docs[0].data() } as TeamMember;
        if (profileData.status === 'deleted') {
          setErrorWord("Your access to this portal has been revoked or suspended by the administrator.");
          setLoading(false);
          return;
        }
        setProfile(profileData);
      } catch (err) {
        console.error("Resolve team member role error:", err);
        setErrorWord("Failed to load user credentials.");
        setLoading(false);
      }
    }

    resolveRole();
  }, [user]);

  // 2. Once member profile is resolved, fetch all dispatches/trips and invoices belonging to ownerId
  useEffect(() => {
    if (!profile) return;

    setLoading(true);

    const qTrips = query(
      collection(db, 'trips'),
      where('userId', '==', profile.ownerId)
    );

    const qInvoices = query(
      collection(db, 'invoices'),
      where('userId', '==', profile.ownerId)
    );

    const qKnockdowns = query(
      collection(db, 'knockdown_items'),
      where('userId', '==', profile.ownerId)
    );

    const qProducts = query(
      collection(db, 'products'),
      where('userId', '==', profile.ownerId)
    );

    const qStock = query(
      collection(db, 'stock'),
      where('userId', '==', profile.ownerId)
    );

    const qStockTakes = query(
      collection(db, 'stock_takes'),
      where('userId', '==', profile.ownerId)
    );

    const qInventory = query(
      collection(db, 'inventory'),
      where('userId', '==', profile.ownerId)
    );

    const qDayPlanners = query(
      collection(db, 'day_planners'),
      where('userId', '==', profile.ownerId)
    );

    let tripsDone = false;
    let invoicesDone = false;

    const unsubscribeTrips = onSnapshot(qTrips, (snap) => {
      const results: Trip[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as Trip);
      });
      // Sort by date descending
      results.sort((a, b) => b.date.localeCompare(a.date));
      setTrips(results);
      tripsDone = true;
      if (invoicesDone) {
        setLoading(false);
      }
    }, (err) => {
      console.error("Fetch shared trips error:", err);
      setErrorWord("Permission error downloading shared dispatches.");
      setLoading(false);
    });

    const unsubscribeInvoices = onSnapshot(qInvoices, (snap) => {
      const results: UIDashboardInvoice[] = [];
      snap.forEach((dDoc) => {
        const d = dDoc.data();
        results.push({
          id: dDoc.id,
          number: d.taxInvoice || d.invoiceNumber || '#NO-NUM',
          client: d.schoolName || d.customerName || d.clientName || 'Unknown Client',
          amount: d.subTotal !== undefined ? d.subTotal : (d.sub_total !== undefined ? d.sub_total : (d.summary?.sub_total !== undefined ? d.summary.sub_total : (d.summary?.subTotal !== undefined ? d.summary.subTotal : (d.totalDue || d.amountIncl || d.totalAmount || 0)))),
          date: d.invoiceDate || d.issueDate || 'N/A',
          status: d.status || 'draft',
          district: d.district || d.region || '',
          deliveryAddress: d.deliveryAddress || [d.deliveryAddressLine1, d.deliveryAddressLine2].filter(Boolean).join(', ') || d.address || '',
          lineItems: (d.line_items || d.lineItems || []).map((item: Record<string, unknown>) => ({
            stockCode: String(item.stock_code || item.stockCode || ''),
            description: String(item.description || ''),
            qty: Number(item.quantity ?? item.qty ?? 0) || 0,
            unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0) || 0,
            value: Number(item.line_item_value ?? item.value ?? 0) || 0,
          }))
        });
      });
      setInvoices(results);
      setInvoicesCount(snap.size);
      invoicesDone = true;
      if (tripsDone) {
        setLoading(false);
      }
    }, (err) => {
      console.error("Fetch shared invoices error:", err);
      setInvoices([]);
      setInvoicesCount(0);
      invoicesDone = true;
      if (tripsDone) {
        setLoading(false);
      }
    });

    const unsubscribeKnockdowns = onSnapshot(qKnockdowns, (snap) => {
      const results: KnockdownItem[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as KnockdownItem);
      });
      setKnockdownItems(results);
    }, (err) => {
      console.error("Fetch shared knockdown items error:", err);
    });

    const unsubscribeProducts = onSnapshot(qProducts, (snap) => {
      const results: CatalogProduct[] = [];
      snap.forEach((d) => {
        const v = d.data();
        results.push({
          id: d.id,
          stockCode: v.stockCode || '',
          description: v.description || '',
          unitPrice: Number(v.unitPrice) || 0,
          category: v.category || 'product',
          userId: v.userId || ''
        });
      });
      setCatalogProducts(results);
    }, (err) => {
      console.error("Fetch catalog products error:", err);
    });

    const unsubscribeStock = onSnapshot(qStock, (snap) => {
      const results: StockTakeItem[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as StockTakeItem);
      });
      setTeamStockSubmissions(results);
    }, (err) => {
      console.error("Fetch shared stock takes error:", err);
    });

    const unsubscribeStockTakes = onSnapshot(qStockTakes, (snap) => {
      const results: StockTakeSubmission[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as StockTakeSubmission);
      });
      setTeamStockTakes(results);
    }, (err) => {
      console.error("Fetch shared stock takes list error:", err);
    });

    const unsubscribeInventory = onSnapshot(qInventory, (snap) => {
      const results: TeamInventoryItem[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as TeamInventoryItem);
      });
      setInventoryItems(results);
    }, (err) => {
      console.error("Fetch shared inventory error:", err);
    });

    const unsubscribeDayPlanners = onSnapshot(qDayPlanners, (snap) => {
      const results: DayPlanner[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as DayPlanner);
      });
      setDayPlanners(results);
    }, (err) => {
      console.error("Fetch shared day planners error:", err);
    });

    return () => {
      unsubscribeTrips();
      unsubscribeInvoices();
      unsubscribeKnockdowns();
      unsubscribeProducts();
      unsubscribeStock();
      unsubscribeStockTakes();
      unsubscribeInventory();
      unsubscribeDayPlanners();
    };
  }, [profile]);

  // 3. Action to check/uncheck checklist items dynamically
  const toggleCheckItem = useCallback(async (tripId: string, itemKey: string, currentVal: boolean) => {
    if (!profile || profile.role !== 'editor') return false;

    const tripRef = doc(db, 'trips', tripId);
    
    // Optimistic / current trip reference helper lookup
    const targetTrip = trips.find(t => t.id === tripId);
    if (!targetTrip) return false;

    const checkedItems = { ...(targetTrip.checkedItems || {}) };
    checkedItems[itemKey] = !currentVal;

    try {
      await updateDoc(tripRef, {
        checkedItems,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Update trip check item error:", err);
      return false;
    }
  }, [profile, trips]);

  // 4. Action to update trip status dynamically
  const updateTripStatus = useCallback(async (tripId: string, status: string) => {
    if (!profile || profile.role !== 'editor') return false;

    const tripRef = doc(db, 'trips', tripId);
    const targetTrip = trips.find(t => t.id === tripId);

    try {
      if (status === 'delivered' && targetTrip) {
        const batch = writeBatch(db);
        
        // 1. Update trip status
        batch.update(tripRef, {
          status: 'delivered',
          updatedAt: new Date().toISOString()
        });

        // 2. Load and update all associated invoices to 'delivered'
        const invoiceIds = targetTrip.invoiceIds || [];
        for (const id of invoiceIds) {
          const invRef = doc(db, 'invoices', id);
          batch.update(invRef, {
            status: 'delivered',
            deliveredDate: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString()
          });

          // 3. Find any child/split invoices of this invoice and set them to 'delivered'
          // as well — EXCEPT loader-created partial (outstanding stock) invoices. Those
          // represent items that never made it onto this truck at all, so they must stay
          // 'partially_complete' pending a future redelivery trip, not be swept to 'delivered'
          // just because the original invoice's trip finished.
          try {
            const qChild = query(
              collection(db, 'invoices'),
              where('parentInvoiceId', '==', id)
            );
            const snapChild = await getDocs(qChild);
            snapChild.forEach((cDoc) => {
              if (cDoc.data().isPartialInvoice) return;
              const childRef = doc(db, 'invoices', cDoc.id);
              batch.update(childRef, {
                status: 'delivered',
                deliveredDate: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString()
              });
            });
          } catch (innerErr) {
            console.error("Error finding child/split invoices during trip delivery closure:", innerErr);
          }
        }

        await batch.commit();
        return true;
      }

      // For non-delivered statuses, do a regular single document status update
      const updateData: Record<string, FieldValue | Partial<unknown> | undefined> = {
        status,
        updatedAt: new Date().toISOString()
      };

      // Reset checklist state for the next role phase so they don't inherit previous selections.
      // Reverting to 'proposed' also clears it so the trip re-enters the Assembler's workspace fresh.
      if (status === 'proposed' || status === 'assembled' || status === 'on-route') {
        updateData.checkedItems = {};
        updateData.partialItems = {};
      }

      await updateDoc(tripRef, updateData);
      return true;
    } catch (err) {
      console.error("Update trip status error:", err);
      return false;
    }
  }, [profile, trips]);

  // 5. Action to set or clear partially completed line item records
  const updatePartialItem = useCallback(async (
    tripId: string, 
    itemKey: string, 
    partialData: {
      isPartial: boolean;
      actualQty: number;
      expectedQty: number;
      reason: string;
      stockCode?: string;
      description?: string;
    } | null
  ) => {
    if (!profile || profile.role !== 'editor') return false;

    const tripRef = doc(db, 'trips', tripId);
    const targetTrip = trips.find(t => t.id === tripId);
    if (!targetTrip) return false;

    const partialItems = { ...(targetTrip.partialItems || {}) };
    if (!partialData) {
      delete partialItems[itemKey];
    } else {
      partialItems[itemKey] = partialData;
    }

    try {
      await updateDoc(tripRef, {
        partialItems,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Update trip partial item error:", err);
      return false;
    }
  }, [profile, trips]);

  // 6. Toggle a single day planner entry's completed flag (Today's Plan dialog).
  // Writes straight to the owner's planner doc - id is deterministic (`${ownerId}_${date}`)
  // so no query is needed to find it, matching useDayPlanners' own id scheme. Records
  // who ticked it so the account owner can see who completed each item.
  const toggleDayPlannerEntry = useCallback(async (date: string, entryId: string) => {
    if (!profile || profile.role !== 'editor') return false;

    const plannerDocId = `${profile.ownerId}_${date}`;
    const planner = dayPlanners.find(p => p.id === plannerDocId);
    if (!planner) return false;

    const completedByName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email;

    // Firestore rejects `undefined` field values, so uncompleting must omit
    // `completedBy` entirely rather than null/undefined it out.
    const updatedEntries = planner.entries.map(e => {
      if (e.id !== entryId) return e;
      if (!e.completed) return { ...e, completed: true, completedBy: completedByName };
      const { completedBy: _oldCompletedBy, ...rest } = e;
      return { ...rest, completed: false };
    });

    try {
      await updateDoc(doc(db, 'day_planners', plannerDocId), {
        entries: updatedEntries,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Toggle day planner entry error:", err);
      return false;
    }
  }, [profile, dayPlanners]);

  return {
    profile,
    trips,
    invoices,
    invoicesCount,
    isOwner,
    loading,
    errorWord,
    toggleCheckItem,
    updateTripStatus,
    updatePartialItem,
    knockdownItems,
    catalogProducts,
    inventoryItems,
    teamStockSubmissions,
    teamStockTakes,
    dayPlanners,
    toggleDayPlannerEntry
  };
}
