import { useState } from 'react';
import { 
  Search,
  Plus, 
  ChevronRight,
  Users
} from 'lucide-react';

export function ClientList() {
  const [clients] = useState<unknown[]>([]); // Empty for now

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Clients & CRM
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your customer relationships and view their financial history.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors">
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="saas-card p-6 bg-white border-l-4 border-l-brand-accent">
           <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Total Active Clients</p>
           <p className="text-3xl font-black">{clients.length}</p>
        </div>
        <div className="saas-card p-6 bg-white border-l-4 border-l-emerald-500">
           <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">New this month</p>
           <p className="text-3xl font-black">0</p>
        </div>
        <div className="saas-card p-6 bg-white border-l-4 border-l-indigo-500">
           <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Avg. Lifetime Value</p>
           <p className="text-3xl font-black">R 0</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 text-zinc-300 pointer-events-none opacity-50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            disabled
            placeholder="Search functionality coming soon..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm italic"
          />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="py-24 text-center flex flex-col items-center justify-center saas-card bg-zinc-50/30 border-dashed">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
            <Users className="w-8 h-8 text-zinc-200" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Your CRM is empty</h3>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-2">
            As you process invoices, your unique clients will automatically appear here for tracking and insights.
          </p>
          <button className="mt-8 text-xs font-bold uppercase tracking-widest text-brand-accent flex items-center gap-2 hover:underline">
            Manually Add Client <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Client cards would regularlly render here */}
        </div>
      )}
    </div>
  );
}
