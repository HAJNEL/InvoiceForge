import React, { useMemo, useState } from 'react';
import { 
  ClipboardList,
  Package,
  FileCheck,
  Clock,
  Plus,
  Loader2,
  FileSearch,
  ChevronRight,
  Trash2,
  Truck as TruckIcon,
  X,
  FileText,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useTrucks, Truck } from '../trucks/hooks/useTrucks';
import { useSchedules, Schedule } from '../schedules/hooks/useSchedules';
import { useTrips } from '../trips/hooks/useTrips';
import { Trip, TripStatus } from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Dashboard() {
  const { invoices, loading: invoicesLoading, deleteInvoice, updateInvoice } = useInvoices();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { schedules, loading: schedulesLoading } = useSchedules();
  const { trips, loading: tripsLoading, updateTrip } = useTrips();
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    dateString: string;
    dayName: string;
    truckId: string;
  } | null>(null);

  const loading = invoicesLoading || trucksLoading || schedulesLoading || tripsLoading;

  const stats = (() => {
    if (!invoices.length) return {
      total: 0,
      assembly: 0,
      loaded: 0,
      delivered: 0,
      invoicedAmt: 0
    };

    return invoices.reduce((acc, inv) => {
      acc.total += 1;
      const status = inv.status.toLowerCase();
      if (status === 'assembly') acc.assembly += 1;
      if (status === 'loaded') acc.loaded += 1;
      // DELIVERED KPI card based on the count of invoices on a "COMPLETED" status
      if (status === 'completed' || status === 'delivered') acc.delivered += 1;
      // INVOICED KPI card based on the amount of invoices in an "INVOICED" status
      if (status === 'invoiced') acc.invoicedAmt += (inv.amount || 0);
      return acc;
    }, { total: 0, assembly: 0, loaded: 0, delivered: 0, invoicedAmt: 0 });
  })();

  const completedInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status.toLowerCase() === 'completed' || inv.status.toLowerCase() === 'delivered');
  }, [invoices]);

  const recentActivity = useMemo(() => {
    return invoices.slice(0, 5).map(inv => ({
      id: inv.id,
      title: `Invoice ${inv.number}`,
      desc: `For ${inv.client} • ${inv.date}`,
      status: inv.status
    }));
  }, [invoices]);

  const selectedSchedule = useMemo(() => {
    return schedules.find(s => s.id === selectedScheduleId);
  }, [schedules, selectedScheduleId]);

  const weekDays = useMemo(() => {
    const dates = [];
    const today = new Date();
    const currentDay = today.getDay();
    // Monday is index 1, Sunday is 0. If currentDay is 0, we seek -6 index offset for Monday of current week.
    const distanceToMonday = (currentDay === 0 ? -6 : 1 - currentDay) + (weekOffset * 7);

    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);

      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;

      const label = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      dates.push({
        dateString,
        label,
        dayName: DAYS[i]
      });
    }
    return dates;
  }, [weekOffset]);

  const getTripsForCell = (truckId: string, dateString: string) => {
    return trips.filter(trip => trip.truckId === truckId && trip.date === dateString);
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="ASSEMBLY" 
          value={stats.assembly.toString()} 
          icon={ClipboardList} 
          color="bg-blue-50 text-blue-600"
          subtitle="Picking & Packing"
        />
        <StatCard 
          title="LOADED" 
          value={stats.loaded.toString()} 
          icon={Package} 
          color="bg-amber-50 text-amber-600"
          subtitle="Ready for Transit"
        />
        <StatCard 
          title="DELIVERED" 
          value={stats.delivered.toString()} 
          icon={TruckIcon} 
          color="bg-indigo-50 text-indigo-600"
          subtitle="Click to view & bill"
          onClick={() => setShowDeliveredModal(true)}
        />
        <StatCard 
          title="INVOICED" 
          value={formatCurrency(stats.invoicedAmt)} 
          icon={FileCheck} 
          color="bg-emerald-50 text-emerald-600"
          subtitle="Total Completed Invoiced"
        />
      </div>

      {/* Weekly Dispatch Schedule */}
      <div className="saas-card overflow-hidden">
        <div className="bg-[#e0f2f1]/50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-[#2d3748] tracking-tight">Weekly Dispatch Schedule</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              ← Prev Week
            </button>
            <button 
              onClick={() => setWeekOffset(0)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                weekOffset === 0 
                  ? "bg-brand-primary text-white" 
                  : "bg-white border border-zinc-200 text-zinc-650 hover:bg-zinc-50 shadow-sm"
              )}
            >
              Current
            </button>
            <button 
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              Next Week →
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          {trucks.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <TruckIcon className="w-10 h-10 text-zinc-300 mb-4" />
              <p className="text-sm font-medium text-zinc-900">No trucks in fleet</p>
              <p className="text-xs text-zinc-500 mt-1 mb-6">Add vehicles to manage your weekly dispatch schedule.</p>
              <Link 
                to="/trucks"
                className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
              >
                Add Truck
              </Link>
            </div>
          ) : (
            <>
              <table className="w-full min-w-[600px] border-collapse relative">
                <thead>
                  <tr>
                    <th className="w-40 bg-zinc-50 border border-zinc-100 py-4 px-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Truck Name</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx} className="bg-zinc-50 border border-zinc-100 py-3 text-center min-w-[80px]">
                        <div className="text-xs font-black text-zinc-600">{day.dayName.substring(0, 3).toUpperCase()}</div>
                        <div className="text-[9px] font-bold text-zinc-400 font-mono mt-0.5">{day.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((truck) => (
                    <tr key={truck.id}>
                      <td className="bg-white border border-zinc-100 py-4 px-4 text-xs font-bold text-zinc-700">
                        {truck.name}
                        <p className="text-[10px] text-zinc-400 font-mono font-normal">{truck.licensePlate}</p>
                      </td>
                      {weekDays.map((day, colIdx) => {
                        const cellTrips = getTripsForCell(truck.id, day.dateString);
                        const tripCount = cellTrips.length;
                        
                        return (
                          <td key={colIdx} className="border border-zinc-100 p-2">
                            <div 
                              onClick={() => setSelectedCellInfo({
                                dateString: day.dateString,
                                dayName: day.dayName,
                                truckId: truck.id
                              })}
                              className={cn(
                                "aspect-[4/3] w-full rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer",
                                tripCount > 0 
                                  ? "bg-brand-primary/5 border-brand-primary/20 hover:bg-brand-primary hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/20 group" 
                                  : "bg-zinc-50/50 border-zinc-100 opacity-60 hover:opacity-100 hover:border-zinc-300 hover:bg-white"
                              )}
                            >
                              {tripCount > 0 ? (
                                <>
                                  <span className="text-sm font-black text-brand-primary group-hover:text-white">{tripCount}</span>
                                  <span className="text-[8px] font-bold uppercase tracking-tighter text-brand-primary/60 group-hover:text-white/80">
                                    {tripCount === 1 ? 'Trip' : 'Trips'}
                                  </span>
                                </>
                              ) : (
                                <Plus className="w-3.5 h-3.5 text-zinc-300 transition-colors" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <p>Click on grid cells to view, change, or schedule trips on that day</p>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-primary"></div> Scheduled Trips</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-200"></div> No Trips</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedCellInfo && (
        <DispatchTripsModal
          dateString={selectedCellInfo.dateString}
          truck={trucks.find(t => t.id === selectedCellInfo.truckId)}
          trips={getTripsForCell(selectedCellInfo.truckId, selectedCellInfo.dateString)}
          onClose={() => setSelectedCellInfo(null)}
          onUpdateStatus={updateTrip}
        />
      )}

      {selectedSchedule && (
        <ScheduleDetailsModal 
          schedule={selectedSchedule} 
          onClose={() => setSelectedScheduleId(null)}
          truck={trucks.find(t => t.id === selectedSchedule.truckId)}
          invoices={invoices}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 saas-card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Revenue Growth</h3>
            <select className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2 py-1 outline-none">
              <option>Live Data</option>
            </select>
          </div>
          <div className="h-[300px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
             <div className="text-center p-6">
                <div className="w-8 h-8 text-zinc-300 mx-auto mb-2 flex items-center justify-center">
                   <div className="w-2 h-2 rounded-full bg-zinc-300"></div>
                </div>
                <p className="text-zinc-500 text-sm">Growth chart will populate as you process more invoices.</p>
             </div>
          </div>
        </div>

        <div className="saas-card p-6">
          <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 mb-8">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">No recent activity</div>
            </div>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{activity.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/invoices" className="w-full inline-block mt-8 text-sm font-bold text-brand-accent hover:underline text-center">
            View all invoices
          </Link>
        </div>
      </div>

      <div className="saas-card p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Recent Invoices</h3>
          <Link to="/invoices" className="text-xs font-bold text-zinc-400 hover:text-brand-accent flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        
        {invoices.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center border border-dashed border-zinc-100 rounded-xl">
            <FileSearch className="w-10 h-10 text-zinc-200 mb-4" />
            <p className="text-sm font-medium text-zinc-900">Your invoice list is empty</p>
            <p className="text-xs text-zinc-500 mt-1 mb-6">Start by uploading a PDF invoice for AI extraction.</p>
            <Link 
              to="/invoices/import"
              className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 italic font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="pb-4 font-normal">Invoice</th>
                  <th className="pb-4 font-normal">Client</th>
                  <th className="pb-4 font-normal">Date</th>
                  <th className="pb-4 font-normal">Amount</th>
                  <th className="pb-4 font-normal">Status</th>
                  <th className="pb-4 font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {invoices.slice(0, 5).map((invoice) => (
                  <tr key={invoice.id} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4">
                      <Link to={`/invoices/${invoice.id}`} className="font-mono text-xs font-medium hover:text-brand-accent">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{invoice.client}</span>
                        <span className="text-[10px] text-zinc-500">{invoice.clientEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-zinc-600 font-mono italic">{invoice.date}</td>
                    <td className="py-4 text-sm font-bold tabular-nums">R {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="py-4 text-right">
                      <button 
                        onClick={() => deleteInvoice(invoice.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-lg text-red-500"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
    completed: "bg-indigo-50 text-indigo-600 border-indigo-100",
    loaded: "bg-amber-50 text-amber-600 border-amber-100",
    assembly: "bg-blue-50 text-blue-600 border-blue-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
      styles[status.toLowerCase()] || styles.draft
    )}>
      {status}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle, onClick }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "saas-card p-6 group transition-all relative overflow-hidden",
        onClick 
          ? "cursor-pointer hover:border-brand-primary hover:shadow-xl hover:shadow-zinc-100 active:scale-[0.98]" 
          : "hover:translate-y-[-2px] hover:shadow-xl hover:shadow-zinc-100"
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="h-1 w-8 bg-zinc-100 rounded-full" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{title}</p>
        <p className="text-3xl font-black mt-1 tracking-tight tabular-nums text-zinc-900">{value}</p>
        {subtitle && (
          <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-tight">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function ScheduleDetailsModal({ schedule, onClose, truck, invoices }: { 
  schedule: Schedule; 
  onClose: () => void;
  truck?: Truck;
  invoices: UIInvoice[];
}) {
  const linkedInvoices = useMemo(() => {
    return schedule.invoiceIds.map(id => invoices.find(inv => inv.id === id)).filter((inv): inv is UIInvoice => !!inv);
  }, [schedule, invoices]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-bold">Dispatch Details</h2>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{schedule.day}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="mb-8 p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
              <TruckIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{truck?.name || 'Assigned Truck'}</p>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{truck?.licensePlate || 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Linked Invoices ({linkedInvoices.length})</h3>
            <div className="space-y-3">
              {linkedInvoices.length === 0 ? (
                <p className="text-sm text-zinc-500 italic py-4">No invoices linked to this schedule.</p>
              ) : (
                linkedInvoices.map((inv: UIInvoice) => (
                  <Link 
                    key={inv.id} 
                    to={`/invoices/${inv.id}`}
                    className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-xl hover:border-brand-accent hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-brand-accent transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{inv.number}</p>
                        <p className="text-[10px] text-zinc-500">{inv.client}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-black">R {inv.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-400">{inv.date}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-zinc-300 group-hover:text-brand-accent transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-white border border-zinc-200 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all shadow-sm"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveredInvoicesModal({ invoices, onClose, onUpdateStatus }: {
  invoices: UIInvoice[];
  onClose: () => void;
  onUpdateStatus: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<UIInvoice | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMarkAsInvoiced = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await onUpdateStatus(invoiceId, { status: 'invoiced' });
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'invoiced' } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className={cn(
        "bg-white rounded-2xl w-full relative z-10 shadow-2xl overflow-hidden transition-all duration-300 flex flex-col max-h-[85vh] md:flex-row",
        selectedInvoice ? "max-w-4xl" : "max-w-xl"
      )}>
        {/* Left Side: Invoice List */}
        <div className={cn("flex flex-col flex-1 border-r border-zinc-100 max-h-[85vh]", selectedInvoice ? "md:max-w-md" : "w-full")}>
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-lg font-bold">Delivered Invoices</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">In Completed Status ({invoices.length})</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {invoices.length === 0 ? (
              <div className="py-12 text-center">
                <FileCheck className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
                <p className="text-zinc-400 text-[10px] mt-1">When trip deliveries are finalized, invoices appear here.</p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div 
                  key={inv.id}
                  className={cn(
                    "p-4 border rounded-xl transition-all flex flex-col gap-3 relative overflow-hidden group",
                    selectedInvoice?.id === inv.id 
                      ? "border-brand-primary bg-brand-primary/5 shadow-sm" 
                      : "border-zinc-100 hover:border-zinc-200 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                    >
                      <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 hover:text-brand-primary">
                        {inv.number}
                        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold tracking-widest uppercase rounded">
                          {inv.status}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">{inv.client}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs font-black text-zinc-800">R {inv.amount.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-400">{inv.date}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-all flex items-center gap-1 self-end"
                        title="View Info"
                      >
                        <FileText className="w-3 h-3 text-zinc-500" />
                        Info
                      </button>
                      <button
                        onClick={() => handleMarkAsInvoiced(inv.id)}
                        disabled={updatingId === inv.id}
                        className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {updatingId === inv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileCheck className="w-3.5 h-3.5" />
                        )}
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Invoice Detail Pane */}
        {selectedInvoice && (
          <div className="flex-1 flex flex-col max-h-[85vh] bg-zinc-50/50 w-full md:w-[480px] animate-in slide-in-from-right duration-250">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="font-bold text-sm">Invoice Information</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{selectedInvoice.number}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-1 hover:bg-zinc-250 rounded text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Client and Metadata Info */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3 shadow-inner">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">School / Client Name</span>
                  <p className="text-sm font-bold text-zinc-800">{selectedInvoice.client}</p>
                </div>
                {selectedInvoice.clientEmail && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Client Email</span>
                    <p className="text-xs text-zinc-650 font-mono">{selectedInvoice.clientEmail}</p>
                  </div>
                )}
                {selectedInvoice.district && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery District</span>
                    <p className="text-xs text-zinc-650 font-bold">{selectedInvoice.district}</p>
                  </div>
                )}
                {(selectedInvoice.deliveryAddressLine1 || selectedInvoice.deliveryAddressLine2) && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery Address</span>
                    <p className="text-xs text-zinc-650 leading-relaxed">
                      {selectedInvoice.deliveryAddressLine1} {selectedInvoice.deliveryAddressLine2}
                    </p>
                  </div>
                )}
              </div>

              {/* Financials Summary */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3.5 shadow-inner">
                <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total Invoice Amount</span>
                  <span className="text-sm font-black text-zinc-900">R {selectedInvoice.amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Invoice Issue Date</span>
                  <p className="text-xs text-zinc-700">{selectedInvoice.date}</p>
                </div>
              </div>

              {/* Line Items checklist */}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Product Line Items</h4>
                  <div className="bg-white border border-zinc-100 rounded-xl divide-y divide-zinc-50 overflow-hidden">
                    {selectedInvoice.lineItems.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-zinc-800">{item.description}</p>
                          <span className="text-[10px] font-mono text-zinc-400">Code: {item.stockCode || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-zinc-850">Qty: {item.qty}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">Value: R {item.value?.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600"
              >
                Clear Selection
              </button>
              {selectedInvoice.status.toLowerCase() !== 'invoiced' && (
                <button
                  onClick={() => handleMarkAsInvoiced(selectedInvoice.id)}
                  disabled={updatingId === selectedInvoice.id}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  {updatingId === selectedInvoice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileCheck className="w-3.5 h-3.5" />
                  )}
                  Mark Invoiced
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DispatchTripsModal({ 
  dateString, 
  truck, 
  trips, 
  onClose,
  onUpdateStatus
}: {
  dateString: string;
  truck?: Truck;
  trips: Trip[];
  onClose: () => void;
  onUpdateStatus: (id: string, tripData: Partial<Trip>) => Promise<boolean>;
}) {
  const navigate = useNavigate();

  // Format readable date
  const dateFormatted = new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-2xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-bold">Trips for {truck?.name || 'Truck'}</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{dateFormatted}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {trips.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Trips Scheduled</p>
              <p className="text-zinc-400 text-[10px] mt-1 mb-6">There are no trips created for this truck on this day.</p>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
                }}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-1.5 mx-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule a Trip
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <div key={trip.id} className="p-4 border border-zinc-100 bg-zinc-50/20 rounded-xl space-y-3 hover:border-zinc-200 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900">{trip.name || 'Unnamed Trip'}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Invoices: <span className="font-bold font-mono">{trip.invoiceIds?.length || 0}</span>
                      </p>
                    </div>
                    {/* Status Select inside dialog to edit status immediately! */}
                    <div className="flex flex-col items-end gap-1.5">
                      <select
                        value={trip.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as TripStatus;
                          await onUpdateStatus(trip.id, { status: nextStatus });
                        }}
                        className="text-xs font-bold bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none text-zinc-700 shadow-sm"
                      >
                        <option value="proposed">Proposed</option>
                        <option value="assembled">Assembled</option>
                        <option value="on-route">On Route</option>
                        <option value="partially-completed">Partially Completed</option>
                        <option value="completed">Completed</option>
                        <option value="invoiced">Invoiced</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
                      Status: {trip.status}
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/trips/edit/${trip.id}`);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-brand-primary text-white rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-1"
                    >
                      Edit Trip Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              onClose();
              navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
            }}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50 transition-all flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-500" />
            Add Another Trip
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

