import type { Dispatch, SetStateAction } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UIInvoice } from '../invoices/hooks/useInvoices';
import { Truck } from '../trucks/hooks/useTrucks';
import { Trip } from '../../types';
import { KpiStatsRowMobile } from './components/KpiStatsRowMobile';
import { DispatchScheduleMobile } from './components/DispatchScheduleMobile';
import { BusinessIntelligencePanelMobile } from './components/BusinessIntelligencePanelMobile';
import { DeliveredInvoicesModalMobile } from './components/DeliveredInvoicesModalMobile';
import { PartiallyCompletedInvoicesModalMobile } from './components/PartiallyCompletedInvoicesModalMobile';
import { DispatchTripsModalMobile } from './components/DispatchTripsModalMobile';
import { SelfInvoiceModalMobile } from './components/SelfInvoiceModalMobile';
import { FuelLogModalMobile } from './components/FuelLogModalMobile';
import { FuelLog } from './hooks/useFuelLogs';
import { useDashboardAnalytics } from './hooks/useDashboardAnalytics';

type Analytics = ReturnType<typeof useDashboardAnalytics>;

interface DashboardMobileProps {
  trucks: Truck[];
  paginatedTrucks: Truck[];
  invoices: UIInvoice[];
  updateInvoice: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
  updateTrip: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;

  lastInvoicedAmount: number;
  historyInvoicedTotal: number;
  fuelLogs: FuelLog[];

  trucksPage: number;
  setTrucksPage: Dispatch<SetStateAction<number>>;
  totalTrucksPages: number;
  trucksPerPage: number;

  showDeliveredModal: boolean;
  setShowDeliveredModal: Dispatch<SetStateAction<boolean>>;
  showPartiallyCompletedModal: boolean;
  setShowPartiallyCompletedModal: Dispatch<SetStateAction<boolean>>;
  showSelfInvoiceModal: boolean;
  setShowSelfInvoiceModal: Dispatch<SetStateAction<boolean>>;
  showFuelModal: boolean;
  setShowFuelModal: Dispatch<SetStateAction<boolean>>;

  weekOffset: number;
  setWeekOffset: Dispatch<SetStateAction<number>>;
  selectedCellInfo: { dateString: string; dayName: string; truckId: string } | null;
  setSelectedCellInfo: Dispatch<SetStateAction<{ dateString: string; dayName: string; truckId: string } | null>>;

  invoiceTotalsOverTime: Analytics['invoiceTotalsOverTime'];
  topCustomersData: Analytics['topCustomersData'];
  pipelineData: Analytics['pipelineData'];
  truckUtilizationData: Analytics['truckUtilizationData'];
  districtData: Analytics['districtData'];
  productData: Analytics['productData'];
  weekDays: Analytics['weekDays'];
  stats: Analytics['stats'];
  completedInvoices: UIInvoice[];
  partiallyCompletedInvoices: UIInvoice[];
  weekNumber: number;
  getTripsForCell: (truckId: string, dateString: string) => Trip[];
}

export function DashboardMobile({
  trucks, paginatedTrucks, invoices, updateInvoice, updateTrip,
  lastInvoicedAmount, historyInvoicedTotal, fuelLogs,
  trucksPage, setTrucksPage, totalTrucksPages, trucksPerPage,
  showDeliveredModal, setShowDeliveredModal,
  showPartiallyCompletedModal, setShowPartiallyCompletedModal,
  showSelfInvoiceModal, setShowSelfInvoiceModal,
  showFuelModal, setShowFuelModal,
  weekOffset, setWeekOffset, selectedCellInfo, setSelectedCellInfo,
  invoiceTotalsOverTime, topCustomersData, pipelineData, truckUtilizationData,
  districtData, productData, weekDays, stats,
  completedInvoices, partiallyCompletedInvoices, weekNumber, getTripsForCell,
}: DashboardMobileProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Financial Overview</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Monitor your business performance.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/invoices/import"
            title="Bulk Import"
            className="inline-flex items-center justify-center w-10 h-10 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors mobile-tap-target"
          >
            <Clock className="w-4 h-4" />
          </Link>
          <Link
            to="/invoices/new"
            title="New Invoice"
            className="inline-flex items-center justify-center w-10 h-10 bg-brand-primary text-white rounded-lg hover:bg-zinc-800 transition-colors mobile-tap-target"
          >
            <Plus className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <KpiStatsRowMobile
        stats={stats}
        onDeliveredClick={() => setShowDeliveredModal(true)}
        onPartiallyCompletedClick={() => setShowPartiallyCompletedModal(true)}
        onInvoicedClick={() => setShowSelfInvoiceModal(true)}
        onFuelClick={() => setShowFuelModal(true)}
        lastInvoicedAmount={lastInvoicedAmount}
        historyInvoicedTotal={historyInvoicedTotal}
        fuelLogs={fuelLogs}
      />

      <DispatchScheduleMobile
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
        <DispatchTripsModalMobile
          dateString={selectedCellInfo.dateString}
          truck={trucks.find(t => t.id === selectedCellInfo.truckId)}
          trips={getTripsForCell(selectedCellInfo.truckId, selectedCellInfo.dateString)}
          invoices={invoices}
          onClose={() => setSelectedCellInfo(null)}
          onUpdateStatus={updateTrip}
          onUpdateInvoice={updateInvoice}
        />
      )}

      <BusinessIntelligencePanelMobile
        invoiceCount={invoices.length}
        invoiceTotalsOverTime={invoiceTotalsOverTime}
        topCustomersData={topCustomersData}
        pipelineData={pipelineData}
        truckUtilizationData={truckUtilizationData}
        districtData={districtData}
        productData={productData}
      />

      {showDeliveredModal && (
        <DeliveredInvoicesModalMobile
          invoices={completedInvoices}
          onClose={() => setShowDeliveredModal(false)}
          onUpdateStatus={updateInvoice}
        />
      )}

      {showPartiallyCompletedModal && (
        <PartiallyCompletedInvoicesModalMobile
          invoices={partiallyCompletedInvoices}
          onClose={() => setShowPartiallyCompletedModal(false)}
        />
      )}

      {showSelfInvoiceModal && (
        <SelfInvoiceModalMobile
          invoices={invoices}
          updateInvoice={updateInvoice}
          onClose={() => setShowSelfInvoiceModal(false)}
        />
      )}

      {showFuelModal && (
        <FuelLogModalMobile
          trucks={trucks}
          onClose={() => setShowFuelModal(false)}
        />
      )}
    </div>
  );
}
