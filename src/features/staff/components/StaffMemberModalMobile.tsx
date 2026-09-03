import { useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { StaffMemberFormFields } from './StaffMemberFormFields';
import { EMPTY_STAFF_FORM, staffToFormData, formDataToStaff, StaffFormData } from './staffFormTypes';
import { useRateGroups } from '../../settings/hooks/useRateGroups';
import { useSimplePayEmployeeSync } from '../hooks/useSimplePayEmployeeSync';

export function StaffMemberModalMobile({ staffMember, onSave, onClose }: {
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
    <MobileSheet
      isOpen
      onClose={onClose}
      title={staffMember ? 'Edit Staff Member' : 'Add Staff Member'}
      footer={
        <button
          type="button"
          title={staffMember ? 'Save changes' : 'Save staff member'}
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
          {staffMember ? 'Save Changes' : 'Save Staff Member'}
        </button>
      }
    >
      <StaffMemberFormFields
        form={form}
        setForm={setForm}
        rateGroups={rateGroups}
        onSyncSimplePay={handleSyncSimplePay}
        isSyncingSimplePay={isSyncingSimplePay}
      />
    </MobileSheet>
  );
}
