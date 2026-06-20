export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
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
  createdAt: string;
  updatedAt: string;
  roles?: string[];
}

