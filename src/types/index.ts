export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  PARTIALLY_COMPLETE = 'partially_complete'
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  
  // Vendor Info
  vendorName: string;
  vendorAddress: string;
  vendorTaxId?: string;
  vendorEmail?: string;
  
  // Client Info
  clientId: string;
  clientName: string;
  clientAddress: string;
  
  // Financials
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  
  lineItems: LineItem[];
  notes?: string;
  
  // Metadata
  originalFileUrl?: string;
  originalFileName?: string;
  aiExtractionMetadata?: {
    confidenceScore: number;
    extractedAt: string;
    processingTimeMs: number;
  };
  
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  email: string;
  address: string;
  phone?: string;
  taxId?: string;
  createdAt: string;
}

export enum TripStatus {
  PENDING = 'pending',
  PROPOSED = 'proposed',
  ASSEMBLED = 'assembled',
  ON_ROUTE = 'on-route',
  PARTIALLY_COMPLETED = 'partially-completed',
  COMPLETED = 'completed',
  DELIVERED = 'delivered',
  INVOICED = 'invoiced'
}

export interface TripStop {
  id: string;
  location: string;
  type: string;
  startTime: string;
  endTime: string;
  duration?: string;
  invoiceId?: string;
  // Compatibility fields
  client: string;
  number: string;
  amount: number;
  address: string;
}

export interface Trip {
  id: string;
  userId: string;
  name: string;
  date: string;
  truckId: string;
  truckName?: string;
  status: TripStatus;
  invoiceIds: string[];
  stops?: TripStop[];
  manifestItems?: { stockCode: string; description: string; qty: number }[];
  checkedItems?: { [key: string]: boolean };
  // Records the quantity already deducted from inventory per item key, so an item that has
  // been counted at assembly is never deducted twice on re-save/edit.
  deductedItems?: { [key: string]: number };
  partialItems?: {
    [key: string]: {
      isPartial: boolean;
      actualQty: number;
      expectedQty: number;
      reason: string;
      stockCode?: string;
      description?: string;
    }
  };
  createdAt: string;
  updatedAt: string;
}

export interface Truck {
  id: string;
  userId: string;
  name: string;
  licensePlate: string;
  maxValue?: number;
  createdAt: string;
}

export interface Settings {
  id: string;
  userId: string;
  warehouseAddress?: string;
  warehouseLat?: number;
  warehouseLng?: number;
  sidebarLogoBase64?: string;
  pushoverUserKey?: string;
  // Set when the account owner has opted in to Google Calendar sync (mirrors
  // TeamMember.calendarSyncEnabled for team members).
  calendarSyncEnabled?: boolean;
  updatedAt: string;
}

// Lives in its own `zoho_credentials/{uid}` collection (owner-only Firestore
// rules), never in the publicly-readable `settings` doc - see firestore.rules.
export interface ZohoCredentials {
  id: string;
  userId: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  organizationId?: string;
  region?: string; // Zoho data center suffix: 'com' | 'eu' | 'in' | 'com.au' | ... (default 'com')
  connectedAt?: string; // set on the last successful Test Connection
  updatedAt: string;
}

export interface SelfInvoice {
  id: string;
  userId: string;
  invoiceNumber: string;   // e.g. "SELF-0001", sequential per account
  invoiceIds: string[];    // ids of the underlying Invoice docs billed together
  totalAmount: number;     // sum of included invoices' amounts, snapshotted at creation
  status: 'open' | 'completed';
  // The Zoho Books customer this bundle is linked to, picked by the user from
  // a picker dialog on Complete (see SelfInvoiceModal.handleComplete /
  // GET /api/zoho/contacts) - a bundle can combine invoices from different
  // underlying clients/schools, so this is chosen explicitly rather than
  // derived from them.
  zohoCustomerId?: string;
  zohoCustomerName?: string;
  // Set once the bundle has been pushed to Zoho Books on Complete (see
  // POST /api/zoho/create-invoice).
  zohoInvoiceId?: string;
  zohoInvoiceUrl?: string;
  zohoSyncedAt?: string;
  // Present when the most recent Zoho push failed, so it can be surfaced/retried.
  zohoSyncError?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  recentInvoices: Invoice[];
  revenueData: { date: string; amount: number }[];
}

export interface Task {
  id: string;
  userId: string;        // owner uid (ownership, mirrors every other collection)
  assigneeId: string;    // owner uid for "self", else team_members doc id (also used as notify member id)
  assigneeEmail: string; // stable key the team member queries by (survives uid reconciliation)
  assigneeName: string;  // cached display name for the board
  title: string;
  note?: string;
  done: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlannerEntry {
  id: string;
  time?: string;    // optional "HH:MM"; omitted/empty means no time was set and it stays hidden in the UI
  note: string;
  completed: boolean;
  completedBy?: string; // display name of whoever last ticked it (owner or team member); omitted while not completed
}

export interface DayPlanner {
  id: string;       // `${userId}_${date}` - one planner per user per date
  userId: string;
  date: string;      // "YYYY-MM-DD", matches Trip.date
  entries: DayPlannerEntry[]; // array order IS the display/drag order
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  ownerId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'viewer' | 'editor';
  note?: string;
  inviteCode: string;
  status: 'pending' | 'active' | 'deleted';
  userId?: string | null;
  pushoverUserKey?: string;
  // Personal details a team member can edit on their own profile page.
  phone?: string;
  photoBase64?: string;
  // Set when the member has opted in to Google Calendar sync (Phase 2).
  calendarSyncEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  roles?: string[];
}

