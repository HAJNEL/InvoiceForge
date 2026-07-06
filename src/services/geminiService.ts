import { Type } from "@google/genai";
import { ai } from "../lib/gemini";

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

export async function extractDetailedInvoice(text: string): Promise<DetailedInvoice> {
  const prompt = `Extract all invoice details from the following document text. 
  Follow the provided JSON schema exactly. 
  
  CRITICAL INSTRUCTION:
  Look for a specific 5-line address block and extract it as follows:
  Line 1: Client Name (map to customerName)
  Line 2: School Name (map to schoolName)
  Line 3: Street Address (map to streetAddress)
  Line 4: Suburb (map to suburb)
  Line 5: District (map to district)

  If a field is not found, return an empty string or 0 as appropriate.
  
  Document Text:
  ${text}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          taxInvoice: { type: Type.STRING },
          invoiceDate: { type: Type.STRING },
          customerPO: { type: Type.STRING },
          salesOrderNo: { type: Type.STRING },
          deliveryNoteNo: { type: Type.STRING },
          customerContact: { type: Type.STRING },
          customerCode: { type: Type.STRING },
          customerName: { type: Type.STRING },
          schoolName: { type: Type.STRING },
          streetAddress: { type: Type.STRING },
          suburb: { type: Type.STRING },
          district: { type: Type.STRING },
          customerAddressLine1: { type: Type.STRING },
          customerAddressLine2: { type: Type.STRING },
          postalCode: { type: Type.STRING },
          vatNo: { type: Type.STRING },
          deliveryCustomerName: { type: Type.STRING },
          deliveryAddressLine1: { type: Type.STRING },
          deliveryAddressLine2: { type: Type.STRING },
          deliveryRegion: { type: Type.STRING },
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stockCode: { type: Type.STRING },
                description: { type: Type.STRING },
                qty: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                disc: { type: Type.NUMBER },
                value: { type: Type.NUMBER }
              }
            }
          },
          subTotal: { type: Type.NUMBER },
          vatAmount: { type: Type.NUMBER },
          amountIncl: { type: Type.NUMBER },
          freight: { type: Type.NUMBER },
          totalDue: { type: Type.NUMBER },
          accountTerms: { type: Type.STRING },
          companyName: { type: Type.STRING },
          companyAddressLine1: { type: Type.STRING },
          companyAddressLine2: { type: Type.STRING },
          companyPhysicalAddress: { type: Type.STRING },
          companyIndustrialPark: { type: Type.STRING },
          telephone: { type: Type.STRING },
          email: { type: Type.STRING },
          website: { type: Type.STRING },
          registrationNo: { type: Type.STRING },
          companyVatNo: { type: Type.STRING },
          bankName: { type: Type.STRING },
          branch: { type: Type.STRING },
          account: { type: Type.STRING },
          swift: { type: Type.STRING },
          page: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.text ?? '');
    return result as DetailedInvoice;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to extract structured data from the invoice.", { cause: error });
  }
}
