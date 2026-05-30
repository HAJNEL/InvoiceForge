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
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useTrucks, Truck } from '../trucks/hooks/useTrucks';
import { useSchedules, Schedule } from '../schedules/hooks/useSchedules';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Dashboard() {
  const { invoices, loading: invoicesLoading, deleteInvoice } = useInvoices();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { schedules, loading: schedulesLoading } = useSchedules();
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const loading = invoicesLoading || trucksLoading || schedulesLoading;

  const stats = useMemo(() => {
    if (!invoices.length) return {
      total: 0,
      assembly: 0,
      loaded: 0,
      delivered: 0,
      invoiced: 0
    };

    return invoices.reduce((acc, inv) => {
      acc.total += 1;
      const status = inv.status.toLowerCase();
      if (status === 'assembly') acc.assembly += 1;
      if (status === 'loaded') acc.loaded += 1;
      if (status === 'delivered') acc.delivered += 1;
      if (status === 'invoiced') acc.invoiced += 1;
      return acc;
    }, { total: 0, assembly: 0, loaded: 0, delivered: 0, invoiced: 0 });
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

  const getScheduleForCell = (truckId: string, dayIdx: number) => {
    const dayName = DAYS[dayIdx];
    return schedules.find(s => s.truckId === truckId && s.day === dayName);
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
          subtitle="Successful Drops"
        />
        <StatCard 
          title="INVOICED" 
          value={stats.invoiced.toString()} 
          icon={FileCheck} 
          color="bg-emerald-50 text-emerald-600"
          subtitle="Finalized Records"
        />
      </div>

      {/* Weekly Dispatch Schedule */}
      <div className="saas-card overflow-hidden">
        <div className="bg-[#e0f2f1]/50 py-4 text-center border-b border-zinc-100">
          <h2 className="text-xl font-bold text-[#2d3748] tracking-tight">Weekly Dispatch Schedule</h2>
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
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                      <th key={idx} className="bg-zinc-50 border border-zinc-100 py-4 text-xs font-black text-zinc-600">
                        {day}
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
                      {Array.from({ length: 7 }).map((_, colIdx) => {
                        const schedule = getScheduleForCell(truck.id, colIdx);
                        const dropCount = schedule?.invoiceIds?.length || 0;
                        
                        return (
                          <td key={colIdx} className="border border-zinc-100 p-2">
                            <div 
                              onClick={() => schedule && setSelectedScheduleId(schedule.id)}
                              className={cn(
                                "aspect-[4/3] w-full rounded-xl border flex flex-col items-center justify-center transition-all",
                                dropCount > 0 
                                  ? "bg-brand-accent/5 border-brand-accent/20 cursor-pointer hover:bg-brand-accent hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/20 group" 
                                  : "bg-zinc-50/50 border-zinc-100 opacity-40"
                              )}
                            >
                              {dropCount > 0 ? (
                                <>
                                  <span className="text-sm font-black text-brand-accent group-hover:text-white">{dropCount}</span>
                                  <span className="text-[8px] font-bold uppercase tracking-tighter text-brand-accent/60 group-hover:text-white/80">Drops</span>
                                </>
                              ) : (
                                <div className="w-1 h-1 rounded-full bg-zinc-200"></div>
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
                <p>Click on active schedule blocks to view linked invoices</p>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-accent"></div> Active Schedule</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-200"></div> No Schedule</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
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

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="saas-card p-6 group transition-all hover:translate-y-[-2px] hover:shadow-xl hover:shadow-zinc-100 relative overflow-hidden">
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
