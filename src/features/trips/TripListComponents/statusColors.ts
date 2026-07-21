export const STATUS_COLORS: { [key: string]: { bg: string; border: string; label: string } } = {
  'partially_complete': { bg: '#f43f5e', border: '#be123c', label: 'Partially Complete' },
  'draft': { bg: '#94a3b8', border: '#475569', label: 'Draft' },
  'pending': { bg: '#8b5cf6', border: '#6d28d9', label: 'Pending' },
  'proposed': { bg: '#f97316', border: '#ea580c', label: 'Proposed' },
  'assembled': { bg: '#3b82f6', border: '#1d4ed8', label: 'Assembled' },
  'on-route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'on_route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'delivered': { bg: '#0d9488', border: '#0f766e', label: 'Delivered' },
  'invoiced': { bg: '#10b981', border: '#047857', label: 'Complete' }
};
