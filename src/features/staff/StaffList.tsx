import { useState, useMemo } from 'react';
import { UserCog, Plus, Search, Edit2, Trash2, Loader2, AlertCircle, Users, Check, X, Upload } from 'lucide-react';
import { useStaff } from './hooks/useStaff';
import { StaffMember } from '../../types';
import { StaffMemberModal } from './components/StaffMemberModal';
import { StaffMemberModalMobile } from './components/StaffMemberModalMobile';
import { StaffImportDialog } from './components/StaffImportDialog';
import { StaffListMobile } from './StaffListMobile';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

export function StaffList() {
  const { staff, loading, error, addStaff, updateStaff, deleteStaff } = useStaff();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.jobTitle || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.number || '').toLowerCase().includes(q)
    );
  }, [staff, searchQuery]);

  const handleOpenModal = (member?: StaffMember) => {
    setEditingStaff(member || null);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (editingStaff) {
      return await updateStaff(editingStaff.id, data);
    }
    return await addStaff(data);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteStaff(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        <StaffListMobile
          staff={filteredStaff}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenModal={handleOpenModal}
          onOpenImport={() => setIsImportOpen(true)}
          onDelete={deleteStaff}
        />
        {isModalOpen && (
          <StaffMemberModalMobile staffMember={editingStaff} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
        )}
        {isImportOpen && (
          <StaffImportDialog staff={staff} addStaff={addStaff} onClose={() => setIsImportOpen(false)} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-accent shrink-0" />
            Staff Members
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your payroll roster — fields align with SimplePay's Bulk Input format.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            title="Import Staff Members"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-zinc-500" />
            Import
          </button>
          <button
            onClick={() => handleOpenModal()}
            title="Add Staff Member"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search staff…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
            />
          </div>
          <div className="text-xs font-medium text-zinc-500 shrink-0">
            {filteredStaff.length} staff member{filteredStaff.length === 1 ? '' : 's'}
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
            <p className="text-zinc-500 font-medium text-sm">Loading staff…</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
              <UserCog className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">No staff members found</h3>
            <p className="text-sm text-zinc-500 mt-1.5">
              {searchQuery ? "No results match your search." : "Add your first staff member to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cell No.</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[100px]">Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-zinc-850">{s.firstName} {s.lastName}</p>
                      {s.number && <p className="text-[10px] text-zinc-400 mt-0.5">#{s.number}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-600">{s.jobTitle || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600">{s.cellNo || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600">{s.email || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border",
                        s.status === 'active'
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200"
                      )}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleOpenModal(s)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Staff Member"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === s.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(s.id)}
                              disabled={busyId === s.id}
                              className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(s.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Staff Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <StaffMemberModal staffMember={editingStaff} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
      )}
      {isImportOpen && (
        <StaffImportDialog staff={staff} addStaff={addStaff} onClose={() => setIsImportOpen(false)} />
      )}
    </div>
  );
}
