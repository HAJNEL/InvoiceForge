// Order Builder bundles multiple Order docs from the same school into one
// delivery-ready "build". See src/features/orders/hooks/useOrders.ts for the
// source Order type this consumes.

export interface OrderBuildSchoolGroup {
  schoolId: string;
  schoolName: string;       // normalized (English) name, see src/lib/geocoding.ts normalizeSchoolName
  area: string;
  schoolType: string;
  orderIds: string[];       // source Order doc ids contributed to this group
  orderNumbers: string[];   // denormalized, for display/export without re-fetching orders
  lineItems: { stockCode: string; qty: number }[]; // summed by stockCode across orderIds
}

export interface OrderBuild {
  id: string;
  // Scoping field, same convention as Order.userId elsewhere in this app (see
  // firestore.rules' isOwner/isTeamMemberOfOwner pattern) - the account this build
  // belongs to. Order Builder only ever bundles orders from useOrders(), which is
  // itself scoped to the signed-in user's own uid, so a build's userId always
  // matches the uid of whoever created it.
  userId: string;
  buildNumber: string;      // zero-padded, e.g. "00001" - unique only within (userId, year)
  year: number;             // calendar year the build was created in, e.g. 2026
  deliveryDate: string;     // ISO date string (yyyy-mm-dd), user-picked, no default
  schoolGroups: OrderBuildSchoolGroup[];
  createdAt: string;
  updatedAt: string;
}
