// Shared pure-function helpers for Order Builder - kept dependency-free (no React,
// no Firestore) so they're independently testable and reusable between the list,
// build, and export UIs.

// Human-readable delivery date, matching this app's existing en-ZA date-formatting
// convention (see src/features/trips/utils/printTripManifest.ts).
export function formatBuildDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
