import { useMemo, useState, useEffect } from 'react';
import { Clock, Plus, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvoices } from '../invoices/hooks/useInvoices';
import { useTrucks } from '../trucks/hooks/useTrucks';
import { useTrips } from '../trips/hooks/useTrips';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../core/hooks/useAuth';
import { useDashboardAnalytics } from './hooks/useDashboardAnalytics';
import { KpiStatsRow } from './components/KpiStatsRow';
import { DispatchSchedule } from './components/DispatchSchedule';
import { BusinessIntelligencePanel } from './components/BusinessIntelligencePanel';
import { DeliveredInvoicesModal } from './components/DeliveredInvoicesModal';
import { PartiallyCompletedInvoicesModal } from './components/PartiallyCompletedInvoicesModal';
import { DispatchTripsModal } from './components/DispatchTripsModal';
import { SelfInvoiceModal } from './components/SelfInvoiceModal';
import { FuelLogModal } from './components/FuelLogModal';
import { useSelfInvoices } from './hooks/useSelfInvoices';
import { useFuelLogs } from './hooks/useFuelLogs';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const checkTeamMember = async () => {
        try {
          const q = query(collection(db, 'team_members'), where('userId', '==', user.uid), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            navigate('/team-dashboard');
          }
        } catch (e) {
          console.error("Dashboard mount check team member error:", e);
        }
      };
      checkTeamMember();
    }
  }, [user, navigate]);

  const { invoices, loading: invoicesLoading, updateInvoice } = useInvoices();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { trips, loading: tripsLoading, updateTrip } = useTrips();
  const { selfInvoices } = useSelfInvoices();
  const { fuelLogs } = useFuelLogs();

  // Drives the two toggle icons on the Invoiced KPI card: the most recently created
  // self-invoice's amount, vs. the cumulative total of everything already Completed.
  const lastInvoicedAmount = useMemo(() => selfInvoices[0]?.totalAmount || 0, [selfInvoices]);
  const historyInvoicedTotal = useMemo(() => (
    selfInvoices.filter(si => si.status === 'completed').reduce((sum, si) => sum + si.totalAmount, 0)
  ), [selfInvoices]);

  // Table Pagination States
  const [trucksPage, setTrucksPage] = useState(1);
  const trucksPerPage = 5;
  const totalTrucksPages = Math.ceil(trucks.length / trucksPerPage);
  const paginatedTrucks = useMemo(() => {
    const startIndex = (trucksPage - 1) * trucksPerPage;
    return trucks.slice(startIndex, startIndex + trucksPerPage);
  }, [trucks, trucksPage]);

  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [showPartiallyCompletedModal, setShowPartiallyCompletedModal] = useState(false);
  const [showSelfInvoiceModal, setShowSelfInvoiceModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    dateString: string;
    dayName: string;
    truckId: string;
  } | null>(null);

  const loading = invoicesLoading || trucksLoading || tripsLoading;

  const {
    invoiceTotalsOverTime,
    topCustomersData,
    pipelineData,
    truckUtilizationData,
    districtData,
    productData,
    weekDays,
    stats,
    completedInvoices,
    partiallyCompletedInvoices,
    weekNumber,
    getTripsForCell
  } = useDashboardAnalytics({ invoices, trucks, trips, weekOffset });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <p className="text-zinc-500 text-sm">Synchronizing dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor your business performance and invoice status.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/invoices/import"
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Bulk Import
          </Link>
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <KpiStatsRow
        stats={stats}
        onDeliveredClick={() => setShowDeliveredModal(true)}
        onPartiallyCompletedClick={() => setShowPartiallyCompletedModal(true)}
        onInvoicedClick={() => setShowSelfInvoiceModal(true)}
        onFuelClick={() => setShowFuelModal(true)}
        lastInvoicedAmount={lastInvoicedAmount}
        historyInvoicedTotal={historyInvoicedTotal}
        fuelLogs={fuelLogs}
      />

      {/* Weekly Dispatch Schedule */}
      <DispatchSchedule
        trucks={trucks}
        paginatedTrucks={paginatedTrucks}
        weekDays={weekDays}
        weekNumber={weekNumber}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
        trucksPage={trucksPage}
        setTrucksPage={setTrucksPage}
        totalTrucksPages={totalTrucksPages}
        trucksPerPage={trucksPerPage}
        getTripsForCell={getTripsForCell}
        onCellClick={setSelectedCellInfo}
      />

      {selectedCellInfo && (
        <DispatchTripsModal
          dateString={selectedCellInfo.dateString}
          truck={trucks.find(t => t.id === selectedCellInfo.truckId)}
          trips={getTripsForCell(selectedCellInfo.truckId, selectedCellInfo.dateString)}
          invoices={invoices}
          onClose={() => setSelectedCellInfo(null)}
          onUpdateStatus={updateTrip}
          onUpdateInvoice={updateInvoice}
        />
      )}

      <BusinessIntelligencePanel
        invoiceCount={invoices.length}
        invoiceTotalsOverTime={invoiceTotalsOverTime}
        topCustomersData={topCustomersData}
        pipelineData={pipelineData}
        truckUtilizationData={truckUtilizationData}
        districtData={districtData}
        productData={productData}
      />

      {showDeliveredModal && (
        <DeliveredInvoicesModal
          invoices={completedInvoices}
          onClose={() => setShowDeliveredModal(false)}
          onUpdateStatus={updateInvoice}
        />
      )}

      {showPartiallyCompletedModal && (
        <PartiallyCompletedInvoicesModal
          invoices={partiallyCompletedInvoices}
          onClose={() => setShowPartiallyCompletedModal(false)}
        />
      )}

      {showSelfInvoiceModal && (
        <SelfInvoiceModal
          invoices={invoices}
          updateInvoice={updateInvoice}
          onClose={() => setShowSelfInvoiceModal(false)}
        />
      )}

      {showFuelModal && (
        <FuelLogModal
          trucks={trucks}
          onClose={() => setShowFuelModal(false)}
        />
      )}
    </div>
  );
}
