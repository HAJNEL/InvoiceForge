import { useState } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Loader2, AlertCircle, UserCog, Upload } from 'lucide-react';
import { StaffMember } from '../../types';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { cn } from '../../lib/utils';

export function StaffListMobile({ staff, loading, error, searchQuery, setSearchQuery, onOpenModal, onOpenImport, onDelete }: {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenModal: (member?: StaffMember) => void;
  onOpenImport: () => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      setDeletingId(id);
      await onDelete(id);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-accent shrink-0" />
          Staff Members
        </h1>
        <p className="text-xs text-zinc-500">
          Manage your payroll roster — fields align with SimplePay's Bulk Input format.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenImport}
          title="Import Staff Members"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-500" />
          Import
        </button>
        <button
          onClick={() => onOpenModal()}
          title="Add Staff Member"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search staff…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
        />
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          <p className="text-zinc-500 font-medium text-xs">Loading staff…</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-sm text-zinc-500 mt-2">{error}</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
            <UserCog className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No staff members found</p>
          <p className="text-xs text-zinc-500 mt-1">
            {searchQuery ? "No results match your search." : "Add your first staff member to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <MobileCard key={s.id}>
              <MobileCard.Primary>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-850">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{s.jobTitle || 'No job title set'}</p>
                </div>
                <MobileCard.Actions>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Edit', icon: Edit2, onClick: () => onOpenModal(s) },
                      { label: 'Delete', icon: Trash2, onClick: () => handleDelete(s.id), destructive: true },
                    ]}
                  />
                </MobileCard.Actions>
              </MobileCard.Primary>
              <MobileCard.Secondary>
                {s.cellNo && <span>{s.cellNo}</span>}
                {s.email && <span>{s.email}</span>}
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border",
                  s.status === 'active'
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
                )}>
                  {s.status}
                </span>
                {deletingId === s.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />}
              </MobileCard.Secondary>
            </MobileCard>
          ))}
        </div>
      )}
    </div>
  );
}
