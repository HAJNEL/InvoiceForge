import { DetailedInvoice } from './xaiService';

/**
 * A deterministic parser that uses Regular Expressions to extract invoice data.
 * This is "AI-free" and relies on predictable patterns in the text.
 */
export function parseInvoiceWithRegex(text: string): DetailedInvoice {
  // Initialize with empty values
  const invoice: DetailedInvoice = {
    taxInvoice: '',
    invoiceDate: '',
    customerPO: '',
    salesOrderNo: '',
    deliveryNoteNo: '',
    customerContact: '',
    customerCode: '',
    customerName: '',
    schoolName: '',
    streetAddress: '',
    suburb: '',
    district: '',
    customerAddressLine1: '',
    customerAddressLine2: '',
    postalCode: '',
    vatNo: '',
    deliveryCustomerName: '',
    deliveryAddressLine1: '',
    deliveryAddressLine2: '',
    deliveryRegion: '',
    lineItems: [],
    subTotal: 0,
    vatAmount: 0,
    amountIncl: 0,
    freight: 0,
    totalDue: 0,
    accountTerms: '',
    companyName: '',
    companyAddressLine1: '',
    companyAddressLine2: '',
    companyPhysicalAddress: '',
    companyIndustrialPark: '',
    telephone: '',
    email: '',
    website: '',
    registrationNo: '',
    companyVatNo: '',
    bankName: '',
    branch: '',
    account: '',
    swift: '',
    page: '1',
  };

  // Helper to extract specifically numbers
  const cleanAmount = (raw: string) => {
    if (!raw) return 0;
    const clean = raw.replace(/[^\d.]/g, ''); // Keep digits and dots
    return parseFloat(clean) || 0;
  };

  // Helper to extract a single field based on label
  const extractField = (regex: RegExp): string => {
    const match = text.match(regex);
    if (match) {
        // Return the first captured group that isn't null, or the full match if no groups
        for (let i = 1; i < match.length; i++) {
            if (match[i]) return match[i].trim();
        }
        return match[0].trim();
    }
    return '';
  };

  // Common patterns for invoice fields
  // Handle "Invoice Date : Customer P/O: ..." block then "VALUE1 VALUE2 ..." block
  const labelBlockRegex = /Invoice Date\s*[:-]?\s*Customer P\/O\s*[:-]?\s*Delivery Note No\s*[:-]?\s*Customer Contact\s*[:-]?\s*Sales Order No\s*[:-]?\s*(?:[A-Z0-9-/]+\s+)?(\d{4,})\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+([A-Z0-9-]+)\s+(\d+)\s+(\d+)/i;
  const labelBlockMatch = text.match(labelBlockRegex);
  
  if (labelBlockMatch) {
    invoice.taxInvoice = labelBlockMatch[1];
    invoice.invoiceDate = labelBlockMatch[2];
    invoice.customerPO = labelBlockMatch[3];
    invoice.deliveryNoteNo = labelBlockMatch[4];
    invoice.customerContact = labelBlockMatch[5];
    invoice.salesOrderNo = labelBlockMatch[1]; // Often same as invoice no in these docs
  } else {
    // Fallback search
    invoice.taxInvoice = extractField(/(?:TAX INVOICE|Invoice|INV)\s+(?:No[.]?\s*)?([A-Z0-9]{4,})/i) ||
                          extractField(/(?:Invoice|TAX INVOICE|INV|Doc)\s*#?\s*[:-]\s*([A-Z0-9]+)/i);
    
    invoice.invoiceDate = extractField(/(?:Date|Invoice Date)\s*[:-]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}))/i);
    
    invoice.customerPO = extractField(/(?:Customer P\/O|PO Reference|Order No)\s*[:-]\s*([A-Z0-9-]+)/i);
    invoice.customerCode = extractField(/(?:Account|Cust Code|Acc No|Client Code)\s*[:-]\s*([A-Z0-9-]+)/i);
  }

  // VAT and Company Info
  // Company Name
  invoice.companyName = extractField(/^([A-Z\s]+(?:\(Pty\))?\s+Ltd)/m) || "REBONI FURNITURE FACTORY (Pty) Ltd";
  
  // Telephone and Email
  invoice.telephone = extractField(/Tel\s*:\s*([(\d)\s-]+)/i);
  invoice.email = extractField(/Email\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  invoice.website = extractField(/web\s*:\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

  // Registration Number
  invoice.registrationNo = extractField(/(?:Reg No[.]?)\s*[:-]?\s*([A-Z0-9/]+)/i);

  // VAT (usually occurs twice: first is company, second is customer)
  const vatMatches = [...text.matchAll(/VAT No\s*[:.]?\s*(\d{10,})/gi)];
  if (vatMatches.length > 0) {
    invoice.companyVatNo = vatMatches[0][1];
    if (vatMatches.length > 1) {
      invoice.vatNo = vatMatches[1][1]; // Customer VAT
    }
  }

  // Account Terms
  invoice.accountTerms = extractField(/Account Terms\s*:\s*([^\n\r]+?)(?=Banking Details|$)/i);

  // Banking Details
  const bankMatch = text.match(/Banking Details:([\s\S]+?)(?=AccountTerms|Account Terms|E&OE|TOTAL DUE|FREIGHT|$)/i);
  if (bankMatch) {
    const bankSection = bankMatch[1];
    const lines = bankSection.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      // First line after "Banking Details:" is internal, second is likely bank name
      invoice.bankName = lines.find(l => l.includes('Bank') || l.includes('Corporate')) || lines[1] || "";
      invoice.branch = bankSection.match(/Branch\s*:\s*(\d+)/i)?.[1] || "";
      invoice.account = bankSection.match(/Account\s*:\s*(\d+)/i)?.[1] || "";
      invoice.swift = bankSection.match(/SWIFT\s*:\s*([A-Z0-9]+)/i)?.[1] || "";
    }
  }

  // Customer / Delivery details heuristic
  // These usually follow "TAX INVOICE" header
  const customerMatch = text.match(/TAX INVOICE\s+([\s\S]+?)(?=Descrip|Qty|Values|Stock Code|$)/i);
  if (customerMatch) {
    const cleanSection = customerMatch[1].replace(/\t/g, '  ').replace(/Ɵ/g, 'ti');
    const sections = cleanSection.split(/VAT No\s*[:.]?/i);
    
    if (sections.length >= 1) {
      const billToLines = sections[0].split(/\n|\s{2,}/).map(l => l.trim()).filter(l => l.length > 2);
      invoice.customerName = billToLines[0] || "";
      invoice.customerAddressLine1 = billToLines[1] || "";
      invoice.customerAddressLine2 = billToLines.slice(2).join(', ') || "";
      
      // Extract postal code (usually 4 digits at the end of a line)
      const pcMatch = sections[0].match(/\b(\d{4})\b/);
      if (pcMatch) invoice.postalCode = pcMatch[1];
    }
    
    // Extract district using user provided regex: (?<=\s{2})([A-Z]+(?:\s[A-Z]+)*)(?=\s{2}WC\b)
    // This finds a sequence of words (the district) between double spaces and followed by "WC"
    const districtRegex = /(?<=\s{2,})([A-Z]+(?:\s[A-Z]+)*)(?=\s{2,}WC\b)/i;
    const districtMatch = text.match(districtRegex);
    if (districtMatch) {
      invoice.district = districtMatch[1].trim();
    }
    
    if (sections.length >= 2) {
      const shipToLines = sections[1].split(/\n|\s{2,}/).map(l => l.trim()).filter(l => l.length > 2);
      invoice.deliveryCustomerName = shipToLines[0] || "";
      invoice.deliveryAddressLine1 = shipToLines[1] || "";
      invoice.deliveryAddressLine2 = shipToLines.slice(2).join(', ') || "";
      
      // Refined mapping for schools
      // First line might be Dept name, second line is School Name
      if (shipToLines.length >= 2) {
        if (shipToLines[1].toUpperCase().includes('SCHOOL') || shipToLines[1].toUpperCase().includes('PRIMARY') || shipToLines[1].toUpperCase().includes('HIGH')) {
          invoice.schoolName = shipToLines[1];
          invoice.streetAddress = shipToLines[2] || "";
          invoice.suburb = shipToLines[3] || "";
        } else {
          invoice.schoolName = shipToLines[0];
          invoice.streetAddress = shipToLines[1] || "";
          invoice.suburb = shipToLines[2] || "";
        }
      }
    }
  }

  // Totals - improve cleaning for spaces inside numbers "4,045. 03"
  invoice.subTotal = cleanAmount(extractField(/(?:SUB TOTAL|Subtotal|Net Value)\s*[:-]?\s*R?\s*([\d\s,.]+\d)/i));
  invoice.vatAmount = cleanAmount(extractField(/(?:VAT @ 15%|VAT Amount|Tax)\s*[:-]?\s*R?\s*([\d\s,.]+\d)/i));
  invoice.totalDue = cleanAmount(extractField(/(?:TOTAL DUE|Amount Due|Total Incl|AMOUNT INCL)\s*[:-]?\s*R?\s*([\d\s,.]+\d)/i));
  invoice.amountIncl = invoice.totalDue;

  // Extract Line Items
  const reboniItemsRegex = /(\d+\.\d{2})\s+([\d\s,.]+\.\d{2})\s+([\d\s,.]+\.\d{3})\s+(\d+\.\d{2})\s+([A-Z0-9-]+)/gi;
  const matches = [...text.matchAll(reboniItemsRegex)];
  
  matches.forEach((match, idx) => {
    const qty = match[1];
    const value = match[2];
    const unitPrice = match[3];
    const disc = match[4];
    const stockCode = match[5];
    
    // Find where this item's description starts (usually after the numeric block/stock code)
    const startIdx = match.index! + match[0].length;
    
    // Find where it ends (start of next item numeric block or a total/footer)
    let endIdx = text.length;
    if (idx < matches.length - 1) {
      endIdx = matches[idx + 1].index!;
    } else {
      const stopMatch = text.slice(startIdx).match(/SUB TOTAL|TOTAL DUE|AMOUNT INCL|TOTAL EXCL|E&OE|FREIGHT/i);
      if (stopMatch) {
        endIdx = startIdx + stopMatch.index!;
      }
    }
    
    let description = text.slice(startIdx, endIdx).trim();
    
    // Clean up ligaments and collapsed text
    description = description.replace(/Ɵ/g, 'ti');
    
    // Remove trailing 'R' or leading noise
    description = description.replace(/^R\s+/i, '').replace(/R\s*$/i, '').trim();
    
    // Remove page numbers that might get captured if items span pages
    description = description.replace(/Page\s+\d+\s+of\s+\d+/gi, '').trim();

    // Collapse multiple spaces
    description = description.replace(/\s+/g, ' ').trim();

    if (!description) description = "Description not found";
    
    invoice.lineItems.push({
      stockCode: stockCode.trim(),
      description: description,
      qty: parseFloat(qty.replace(/,/g, '')),
      unitPrice: cleanAmount(unitPrice),
      disc: parseFloat(disc.replace(/,/g, '')),
      value: cleanAmount(value)
    });
  });

  // Fallback for standard line items if Reboni pattern didn't match anything
  if (invoice.lineItems.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const stdLineRegex = /^([A-Z0-9-]+)\s+(.+?)\s+(\d+)\s+([\d\s,.]+)\s+([\d\s,.]+)$/i;
    lines.forEach(line => {
      const match = line.match(stdLineRegex);
      if (match) {
        const [, code, desc, qty, price, total] = match;
        invoice.lineItems.push({
          stockCode: code.trim(),
          description: desc.trim(),
          qty: parseFloat(qty),
          unitPrice: cleanAmount(price),
          disc: 0,
          value: cleanAmount(total)
        });
      }
    });
  }

  // Console log the populated fields as requested by user
  console.log("--- INVOICE EXTRACTION SUMMARY ---");
  const populatedFields: Record<string, unknown> = {};
  Object.entries(invoice).forEach(([key, value]) => {
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      populatedFields[key] = value;
    }
  });
  console.table(populatedFields);
  console.log("----------------------------------");

  return invoice;
}
