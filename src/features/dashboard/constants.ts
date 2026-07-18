export const STATUS_DISPLAY_MAP: Record<string, string> = {
  'partially_complete': 'Partially Complete',
  draft: 'Draft',
  pending: 'Pending',
  proposed: 'Proposed',
  assembled: 'Assembled',
  'on-route': 'On Route',
  'on_route': 'On Route',
  delivered: 'Delivered',
  complete: 'Complete',
  invoiced: 'Complete'
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The various raw status strings written for a partially-delivered invoice
// (see PartialConfirmModal.tsx / PartialConfirmModalMobile.tsx) - not yet
// finished, so it shouldn't be billed to the client yet.
const PARTIAL_STATUSES = new Set(['partially_complete', 'partially-completed', 'partially complete']);
export const isPartialInvoiceStatus = (status: string): boolean => PARTIAL_STATUSES.has((status || '').toLowerCase());

// Statuses that mean an invoice has actually been fulfilled - see useInvoices.ts's
// own "invoiced/complete" transition guard, which treats the same set as terminal.
const COMPLETED_STATUSES = new Set(['delivered', 'invoiced', 'complete', 'completed']);

// A split-off "missing stock" child invoice (see PartialConfirmModal.tsx and
// TeamTripDetail.tsx's Loader flow, numbered "<original>-R" or "PARTIAL-<original>")
// always carries parentInvoiceId, even long after its own status moves on from
// partially_complete (e.g. once it's picked up onto a redelivery trip and
// reassigned to draft/pending/etc). Only treat it as still-partial - and thus not
// billable yet - until it actually reaches one of the completed statuses above;
// otherwise a fully redelivered split invoice would stay hidden/excluded forever.
export function isPartialInvoice(inv: { status: string; parentInvoiceId?: string | null }): boolean {
  const status = (inv.status || '').toLowerCase();
  if (COMPLETED_STATUSES.has(status)) return false;
  return isPartialInvoiceStatus(status) || Boolean(inv.parentInvoiceId);
}
