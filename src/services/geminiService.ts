export interface DetailedInvoice {
  taxInvoice: string;
  invoiceDate: string;
  customerPO: string;
  salesOrderNo: string;
  deliveryNoteNo: string;
  customerContact: string;
  customerCode: string;
  customerName: string;
  schoolName: string;
  streetAddress: string;
  suburb: string;
  district: string;
  customerAddressLine1: string;
  customerAddressLine2: string;
  postalCode: string;
  vatNo: string;
  deliveryCustomerName: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string;
  deliveryRegion: string;
  // Google-resolved (or manually overridden) address actually used for the map
  // pin. Populated by the geocoding flows; editable on the invoice edit screens.
  deliveryAddress?: string;
  // True when `deliveryAddress` was set/edited by a user, so Refresh Pins preserves
  // it instead of overwriting it with a fresh school lookup.
  deliveryAddressManual?: boolean;
  lineItems: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    disc: number;
    value: number;
  }[];
  subTotal: number;
  vatAmount: number;
  amountIncl: number;
  freight: number;
  totalDue: number;
  vatRate?: string;
  accountTerms: string;
  companyName: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyPhysicalAddress: string;
  companyIndustrialPark: string;
  telephone: string;
  email: string;
  website: string;
  registrationNo: string;
  companyVatNo: string;
  bankName: string;
  branch: string;
  account: string;
  swift: string;
  page: string;
  originalFileName?: string;
}
