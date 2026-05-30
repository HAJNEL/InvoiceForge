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

export async function extractDetailedInvoiceXAI(text: string): Promise<DetailedInvoice> {
  try {
    const response = await fetch('/api/extractWithXAI', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Server error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg = parsed.error || errorMsg;
      } catch (e) {
        console.warn("Failed to parse xAI server error text:", e);
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to extract structured data using xAI.");
    }
    if (!result.data) {
      throw new Error("xAI response did not contain data.");
    }
    return result.data;
  } catch (error: unknown) {
    console.error("Failed to extract with xAI:", error);
    if (error instanceof Error) {
      throw new Error(error.message || "Failed to extract structured data using xAI.", { cause: error });
    }
    throw new Error("Failed to extract structured data using xAI.", { cause: error });
  }
}
