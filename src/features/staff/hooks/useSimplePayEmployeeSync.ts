import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { syncStaffToSimplePay } from '../../../lib/simplepay';
import { StaffFormData } from '../components/staffFormTypes';

// Shared by StaffMemberModal / StaffMemberModalMobile: syncs the current form's
// data to SimplePay (creating or updating the employee record) and returns the
// resulting employee id for the caller to write onto its form state - it does
// not persist anything itself, so the user still needs to Save afterward.
export function useSimplePayEmployeeSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async (form: StaffFormData): Promise<string | null> => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Enter a first and last name before syncing to SimplePay.');
      return null;
    }
    setIsSyncing(true);
    try {
      const result = await syncStaffToSimplePay({
        employeeId: form.simplePayEmployeeId || undefined,
        employee: {
          firstName: form.firstName,
          lastName: form.lastName,
          birthdate: form.birthdate || undefined,
          appointmentDate: form.appointmentDate || undefined,
          identificationType: form.identificationType,
          idNumber: form.idNumber || undefined,
          otherNumber: form.otherNumber || undefined,
          paymentMethod: form.paymentMethod,
          bankId: form.bankId || undefined,
          accountNumber: form.accountNumber || undefined,
          branchCode: form.branchCode || undefined,
          accountType: form.accountType || undefined,
          holderRelationship: form.holderRelationship || undefined,
          holderName: form.holderName || undefined,
        },
      });
      if (result.success) {
        toast.success('Synced to SimplePay', { description: 'Click Save to keep this employee id on the staff record.' });
        return result.employeeId;
      }
      toast.error('SimplePay sync failed', { description: result.error });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { isSyncing, sync };
}
