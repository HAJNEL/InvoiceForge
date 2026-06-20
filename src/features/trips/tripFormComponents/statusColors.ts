// Master status mapping helper
export const STATUS_COLORS: { [key: string]: { bg: string; border: string; label: string } } = {
  'partially_complete': { bg: '#f43f5e', border: '#be123c', label: 'Partially Complete' },
  'draft': { bg: '#94a3b8', border: '#475569', label: 'Draft' },
  'proposed': { bg: '#f97316', border: '#ea580c', label: 'Proposed' },
  'assembled': { bg: '#3b82f6', border: '#1d4ed8', label: 'Assembled' },
  'on-route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'on_route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'delivered': { bg: '#0d9488', border: '#0f766e', label: 'Delivered' },
  'invoiced': { bg: '#10b981', border: '#047857', label: 'Complete' },
  'custom_stop': { bg: '#6366f1', border: '#4338ca', label: 'Waypoint' }
};

// Helper colors for pins
export function getStatusColor(status: string) {
  const norm = (status || '').toLowerCase();
  return STATUS_COLORS[norm]?.bg || '#71717a';
}

export function getStatusBorderColor(status: string) {
  const norm = (status || '').toLowerCase();
  return STATUS_COLORS[norm]?.border || '#3f3f46';
}
