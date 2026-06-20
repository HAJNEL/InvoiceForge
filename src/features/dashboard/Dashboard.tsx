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
import { RecentActivityCard } from './components/RecentActivityCard';
import { RecentInvoicesTable } from './components/RecentInvoicesTable';
import { DeliveredInvoicesModal } from './components/DeliveredInvoicesModal';
import { DispatchTripsModal } from './components/DispatchTripsModal';

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

  const { invoices, loading: invoicesLoading, deleteInvoice, updateInvoice } = useInvoices();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { trips, loading: tripsLoading, updateTrip } = useTrips();

  // Table Pagination States
  const [trucksPage, setTrucksPage] = useState(1);
  const trucksPerPage = 5;
  const totalTrucksPages = Math.ceil(trucks.length / trucksPerPage);
  const paginatedTrucks = useMemo(() => {
    const startIndex = (trucksPage - 1) * trucksPerPage;
    return trucks.slice(startIndex, startIndex + trucksPerPage);
  }, [trucks, trucksPage]);

  const [invoicesPage, setInvoicesPage] = useState(1);
  const invoicesPerPage = 5;
  const totalInvoicesPages = Math.ceil(invoices.length / invoicesPerPage);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (invoicesPage - 1) * invoicesPerPage;
    return invoices.slice(startIndex, startIndex + invoicesPerPage);
  }, [invoices, invoicesPage]);

  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
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
    recentActivity,
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
      <KpiStatsRow stats={stats} onDeliveredClick={() => setShowDeliveredModal(true)} />

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
          onClose={() => setSelectedCellInfo(null)}
          onUpdateStatus={updateTrip}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <BusinessIntelligencePanel
          invoiceCount={invoices.length}
          invoiceTotalsOverTime={invoiceTotalsOverTime}
          topCustomersData={topCustomersData}
          pipelineData={pipelineData}
          truckUtilizationData={truckUtilizationData}
          districtData={districtData}
          productData={productData}
        />

        <RecentActivityCard recentActivity={recentActivity} />
      </div>

      <RecentInvoicesTable
        invoices={invoices}
        paginatedInvoices={paginatedInvoices}
        invoicesPage={invoicesPage}
        setInvoicesPage={setInvoicesPage}
        totalInvoicesPages={totalInvoicesPages}
        invoicesPerPage={invoicesPerPage}
        deleteInvoice={deleteInvoice}
      />

      {showDeliveredModal && (
        <DeliveredInvoicesModal
          invoices={completedInvoices}
          onClose={() => setShowDeliveredModal(false)}
          onUpdateStatus={updateInvoice}
        />
      )}
    </div>
  );
}
