import { useState } from 'react';
import { X, UserCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember } from '../../../types';
import { StaffMemberFormFields } from './StaffMemberFormFields';
import { EMPTY_STAFF_FORM, staffToFormData, formDataToStaff, StaffFormData } from './staffFormTypes';
import { useRateGroups } from '../../settings/hooks/useRateGroups';
import { useSimplePayEmployeeSync } from '../hooks/useSimplePayEmployeeSync';

export function StaffMemberModal({ staffMember, onSave, onClose }: {
  staffMember: StaffMember | null;
  onSave: (data: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<boolean | string | null>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<StaffFormData>(() => staffMember ? staffToFormData(staffMember) : EMPTY_STAFF_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { rateGroups } = useRateGroups();
  const { isSyncing: isSyncingSimplePay, sync: syncSimplePay } = useSimplePayEmployeeSync();

  const isValid = form.firstName.trim() && form.lastName.trim();

  const handleSyncSimplePay = async () => {
    const employeeId = await syncSimplePay(form);
    if (employeeId) setForm(prev => ({ ...prev, simplePayEmployeeId: employeeId }));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const result = await onSave(formDataToStaff(form));
      if (result) {
        toast.success(staffMember ? 'Staff member updated' : 'Staff member added');
        onClose();
      }
    } catch (err) {
      console.error('Failed to save staff member:', err);
      toast.error('Could not save staff member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-xl border border-sky-200">
              <UserCog className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">
              {staffMember ? 'Edit Staff Member' : 'Add Staff Member'}
            </h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <StaffMemberFormFields
            form={form}
            setForm={setForm}
            rateGroups={rateGroups}
            onSyncSimplePay={handleSyncSimplePay}
            isSyncingSimplePay={isSyncingSimplePay}
          />
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
          <button type="button" title="Cancel" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            type="button"
            title={staffMember ? 'Save changes' : 'Save staff member'}
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCog className="w-3.5 h-3.5" />}
            {staffMember ? 'Save Changes' : 'Save Staff Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
