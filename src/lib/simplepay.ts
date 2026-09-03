import { auth } from './firebase';

export interface SimplePayConnectionInput {
  apiKey: string;
  clientId: string;
}

export type TestSimplePayConnectionResult =
  | { success: true }
  | { success: false; error: string };

// Verifies a candidate SimplePay connection works before it's saved (or to
// re-check an already-saved one) - see POST /api/simplepay/test-connection.
export async function testSimplePayConnection(input: SimplePayConnectionInput): Promise<TestSimplePayConnectionResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to test the SimplePay connection.' };
    }

    const response = await fetch('/api/simplepay/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Could not connect to SimplePay with these credentials.' };
  } catch (err) {
    console.error('testSimplePayConnection error:', err);
    return { success: false, error: 'Could not connect to SimplePay with these credentials.' };
  }
}

export type DiscoverSimplePayClientsResult =
  | { success: true; clients: unknown }
  | { success: false; error: string };

// Lists the clients (companies) an API key can access - SimplePay's client_id
// isn't shown anywhere in their dashboard, so this is how the admin finds it
// before they even have a full {apiKey, clientId} pair to test - see
// POST /api/simplepay/discover-clients.
export async function discoverSimplePayClients(apiKey: string): Promise<DiscoverSimplePayClientsResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to look up SimplePay clients.' };
    }
    const response = await fetch('/api/simplepay/discover-clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ apiKey }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, clients: data.clients };
    }
    return { success: false, error: data.error || 'Could not list clients from SimplePay with this API key.' };
  } catch (err) {
    console.error('discoverSimplePayClients error:', err);
    return { success: false, error: 'Could not list clients from SimplePay with this API key.' };
  }
}

export interface SyncSimplePayEmployeeInput {
  employeeId?: string;
  employee: {
    firstName: string;
    lastName: string;
    birthdate?: string;
    appointmentDate?: string;
    identificationType: string;
    idNumber?: string;
    otherNumber?: string;
    paymentMethod: string;
    bankId?: string;
    accountNumber?: string;
    branchCode?: string;
    accountType?: string;
    holderRelationship?: string;
    holderName?: string;
  };
}

export type SyncSimplePayEmployeeResult =
  | { success: true; employeeId: string }
  | { success: false; error: string };

// Creates or updates a SimplePay employee from a staff member's current form
// data - see POST /api/simplepay/employees/sync. Pass `employeeId` to update
// an already-linked employee, or omit it to create a new one.
export async function syncStaffToSimplePay(input: SyncSimplePayEmployeeInput): Promise<SyncSimplePayEmployeeResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to sync to SimplePay.' };
    }
    const response = await fetch('/api/simplepay/employees/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, employeeId: data.employeeId };
    }
    return { success: false, error: data.error || 'Failed to sync employee to SimplePay.' };
  } catch (err) {
    console.error('syncStaffToSimplePay error:', err);
    return { success: false, error: 'Failed to sync employee to SimplePay.' };
  }
}

async function simplePayGet<T>(path: string, errorKey: string): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to load data from SimplePay.' };
    }
    const response = await fetch(path, { headers: { 'Authorization': `Bearer ${idToken}` } });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, data: data[errorKey] };
    }
    return { success: false, error: data.error || 'Failed to load data from SimplePay.' };
  } catch (err) {
    console.error(`simplePayGet(${path}) error:`, err);
    return { success: false, error: 'Failed to load data from SimplePay.' };
  }
}

// Raw reference lists for the Settings screen - the admin copies the id they
// need rather than picking from a bound dropdown (see SimplePaySettings).
export function listSimplePayWaves() {
  return simplePayGet<unknown>('/api/simplepay/waves', 'waves');
}

export function listSimplePayItemsAndOutputs() {
  return simplePayGet<unknown>('/api/simplepay/items-and-outputs', 'items');
}

export interface SimplePayPayslipSummary {
  id: string;
  date?: string;
  finalised: boolean;
  nettPay?: number;
}

// Lists a linked employee's SimplePay payslips, so the push dialog can offer
// the correct open (non-finalised) one to write this period's pay into.
export function listSimplePayEmployeePayslips(employeeId: string) {
  return simplePayGet<SimplePayPayslipSummary[]>(`/api/simplepay/employees/${encodeURIComponent(employeeId)}/payslips`, 'payslips');
}

export interface PushPayrollLine {
  staffId: string;
  simplePayEmployeeId?: string;
  payslipId?: string;
  normalPay: number;
  overtimePay: number;
}

export interface PushPayrollLineResult extends PushPayrollLine {
  status: 'pushed' | 'skipped_unlinked' | 'skipped_no_payslip' | 'failed';
  error?: string;
}

export type PushPayrollResult =
  | { success: true; status: 'success' | 'partial' | 'failed'; lines: PushPayrollLineResult[] }
  | { success: false; error: string };

// Pushes a pay period's normal/overtime pay into SimplePay via bulk_input -
// see POST /api/simplepay/push-payroll. Does not itself record a
// PayrollSubmission; the caller does that with the returned line results.
export async function pushPayrollToSimplePay(periodKey: string, lines: PushPayrollLine[]): Promise<PushPayrollResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to push payroll to SimplePay.' };
    }
    const response = await fetch('/api/simplepay/push-payroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ periodKey, lines }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, status: data.status, lines: data.lines || [] };
    }
    return { success: false, error: data.error || 'Failed to push payroll to SimplePay.' };
  } catch (err) {
    console.error('pushPayrollToSimplePay error:', err);
    return { success: false, error: 'Failed to push payroll to SimplePay.' };
  }
}
