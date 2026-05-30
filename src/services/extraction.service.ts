export interface ExtractedInvoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  vendorName: string;
  vendorAddress: string;
  vendorTaxId?: string;
  clientName: string;
  clientAddress: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  notes?: string;
  confidenceScore: number;
}

export const extractInvoiceData = async (fileUrl: string): Promise<ExtractedInvoice> => {
  const response = await fetch('/api/extractInvoiceData', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileUrl })
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMsg = `Server error ${response.status}`;
    try {
      const parsed = JSON.parse(errText);
      errorMsg = parsed.error || errorMsg;
    } catch (e) {
      console.warn("Failed to parse server error text:", e);
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to extract invoice data using OpenAI.");
  }
  if (!result.data) {
    throw new Error("OpenAI response did not contain data.");
  }
  return result.data;
};
