// Pin colors for the Order Builder overview map's "status" color mode (see
// OrderBuilderMap.tsx's colorMode prop) - distinct from the selection-based
// none/partial/full palette used while a build is in progress. Reuses hex
// values already meaningful elsewhere in the app: green/amber match the
// existing full/partial selection colors, and red already means "location
// issue" everywhere else in the Orders UI (the MapPinOff icon, OrdersKpiRow).
export const ORDER_PIN_STATUS_COLORS = {
  active: { bg: '#f59e0b', border: '#b45309', label: 'Active' },
  complete: { bg: '#16a34a', border: '#166534', label: 'Complete' },
  locationIssue: { bg: '#ef4444', border: '#b91c1c', label: 'Location Issue' },
} as const;
