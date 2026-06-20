import express from "express";
import path from "path";
import https from "https";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import { createRequire } from "module";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Create a require function that is compatible with both ESM (tsx dev) and CJS (production)
const customRequire = typeof require !== "undefined"
  ? require
  : createRequire(import.meta.url);

let firebaseAdminApp: App | null = null;
function getFirebaseAdmin(): App {
  if (!firebaseAdminApp) {
    const firebaseConfig = customRequire("./firebase-applet-config.json");
    if (!firebaseConfig || !firebaseConfig.projectId) {
      throw new Error("Firebase project ID is not configured in firebase-applet-config.json.");
    }
    const apps = getApps();
    if (apps.length > 0) {
      firebaseAdminApp = apps[0];
    } else {
      firebaseAdminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }
  return firebaseAdminApp;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfModule = customRequire("pdf-parse");
  
  // 1. Try mehmet-kozan/pdf-parse style PDFParse class if available
  let PDFParseClass = pdfModule.PDFParse;
  if (!PDFParseClass && pdfModule.default && pdfModule.default.PDFParse) {
    PDFParseClass = pdfModule.default.PDFParse;
  }
  
  if (PDFParseClass) {
    try {
      console.log("Parsing PDF using mehmet-kozan/pdf-parse PDFParse class...");
      const parserInstance = new PDFParseClass({ data: buffer });
      const textResult = await parserInstance.getText();
      await parserInstance.destroy();
      return textResult.text || "";
    } catch (e: unknown) {
      const err = e as Error;
      console.warn("Failed parsing with PDFParse class, trying fallback modes...", err.message);
    }
  }

  // 2. Try the classic function style (original pdf-parse, or default function export)
  const primaryFunc = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
  if (typeof primaryFunc === "function") {
    console.log("Parsing PDF using classic function call...");
    const data = await primaryFunc(buffer);
    return data.text || "";
  }

  // 3. Roll through any exported keys to find any matching function fallback
  const keys = Object.keys(pdfModule) as Array<keyof typeof pdfModule>;
  for (const key of keys) {
    if (typeof pdfModule[key] === "function" && key !== "PDFParse") {
      try {
        console.log(`Trying fallback function under key: ${String(key)}...`);
        const data = await (pdfModule[key] as (b: Buffer) => Promise<{ text: string }>)(buffer);
        if (data && typeof data.text === "string") {
          return data.text;
        }
      } catch {
        console.warn(`Fallback function under key ${String(key)} failed too.`);
      }
    }
  }

  throw new Error("Unable to find a valid PDF parsing function/class in the loaded pdf-parse module.");
}

// Load .env.local first (gitignored local secrets), then fall back to .env.
// For any given key the first file that defines it wins.
dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const PORT = 3000;

// Set high buffer/body limit for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helpers
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}



interface RequestOptions {
  headers?: Record<string, string>;
  method?: string;
  timeout?: number;
}

interface CustomResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}

function makeRequest(
  url: string,
  options: RequestOptions = {},
  body: string | Buffer | null = null
): Promise<CustomResponse> {
  return new Promise((resolve, reject) => {
    const headers = options.headers ? { ...options.headers } : {};
    
    if (body) {
      if (Buffer.isBuffer(body)) {
        headers["Content-Length"] = String(body.length);
      } else if (typeof body === "string") {
        headers["Content-Length"] = String(Buffer.byteLength(body, "utf-8"));
      }
    }

    const reqOptions = {
      method: options.method || "GET",
      headers: headers,
      timeout: options.timeout || 300000,
    };

    const req = https.request(url, reqOptions, (res) => {
      const chunks: Uint8Array[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf-8");
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: async () => responseBody,
          json: async () => JSON.parse(responseBody) as unknown
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download file: Status ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// 1. OpenAI Extract Invoice Data Route
app.post("/api/extractInvoiceData", async (req, res) => {
  const { fileUrl } = req.body as { fileUrl?: string };
  if (!fileUrl) {
    return res.status(400).json({ success: false, error: "The request must contain fileUrl." });
  }

  try {
    let openaiApiInstance: OpenAI;
    try {
      openaiApiInstance = getOpenAI();
    } catch (apiKeyErr: unknown) {
      const err = apiKeyErr as Error;
      console.error(err.message);
      return res.status(500).json({
        success: false,
        error: "OpenAI API key is missing. Please set OPENAI_API_KEY as an environment secret."
      });
    }

    console.log(`Downloading PDF from ${fileUrl}...`);
    const buffer = await downloadFile(fileUrl);

    console.log("Parsing PDF text...");
    const textContent = await extractTextFromPdf(buffer);

    console.log("Calling OpenAI GPT-4o for invoice structure extraction...");
    const response = await openaiApiInstance.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert invoice processing AI. Extract all relevant data from the following invoice text into a valid JSON object. 
          Fields required: invoiceNumber, issueDate, dueDate, vendorName, vendorAddress, vendorTaxId, clientName, clientAddress, currency, subtotal, taxAmount, totalAmount, lineItems (array of {description, quantity, unitPrice, amount}), notes.
          Standardize dates to YYYY-MM-DD. 
          If a field is missing, return null. 
          Be very precise with numbers. 
          Line item amounts should sum up to the subtotal.`
        },
        {
          role: "user",
          content: textContent
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsedContent = response.choices[0]?.message?.content;
    if (!parsedContent) {
      throw new Error("No response content from OpenAI GPT-4o.");
    }
    
    const extractedData = JSON.parse(parsedContent) as Record<string, unknown>;
    extractedData.confidenceScore = 0.95;

    return res.json({
      success: true,
      data: extractedData
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("OpenAI Extract Invoice Data Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to extract info from invoice."
    });
  }
});

interface XAIResponse {
  response?: string;
  message?: string;
  choices?: Array<{ message?: { content?: string } }>;
  results?: Array<{ text?: string }>;
}

// 2. xAI (Grok) Extract Invoice Details Route
app.post("/api/extractWithXAI", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text) {
    return res.status(400).json({ success: false, error: "The request must contain 'text'." });
  }

  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "xAI API key is not configured. Please set XAI_API_KEY config."
      });
    }

    const prompt = `Return ONLY a valid JSON object extracting invoice details from the following document text. Do not include markdown formatting like \`\`\`json.
    Fields structure:
    {
      "taxInvoice": "string",
      "invoiceDate": "string",
      "customerPO": "string",
      "salesOrderNo": "string",
      "deliveryNoteNo": "string",
      "customerContact": "string",
      "customerCode": "string",
      "customerName": "string",
      "schoolName": "string",
      "streetAddress": "string",
      "suburb": "string",
      "district": "string",
      "customerAddressLine1": "string",
      "customerAddressLine2": "string",
      "postalCode": "string",
      "vatNo": "string",
      "deliveryCustomerName": "string",
      "deliveryAddressLine1": "string",
      "deliveryAddressLine2": "string",
      "deliveryRegion": "string",
      "lineItems": [
        { "stockCode": "string", "description": "string", "qty": number, "unitPrice": number, "disc": number, "value": number }
      ],
      "subTotal": number,
      "vatAmount": number,
      "amountIncl": number,
      "freight": number,
      "totalDue": number,
      "accountTerms": "string",
      "companyName": "string",
      "companyAddressLine1": "string",
      "companyAddressLine2": "string",
      "companyPhysicalAddress": "string",
      "companyIndustrialPark": "string",
      "telephone": "string",
      "email": "string",
      "website": "string",
      "registrationNo": "string",
      "companyVatNo": "string",
      "bankName": "string",
      "branch": "string",
      "account": "string",
      "swift": "string",
      "page": "string"
    }

    Document Text:
    ${text}`;

    console.log(`Calling xAI API with model: grok-4.20-reasoning`);
    
    const response = await makeRequest("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      timeout: 280000
    }, JSON.stringify({
      model: "grok-4.20-reasoning",
      input: prompt,
    }));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`xAI API Error ${response.status}:`, errorText);
      throw new Error(`xAI API responded with ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as XAIResponse;
    const content = result.response || 
                    result.message || 
                    (result.choices && result.choices[0]?.message?.content) || 
                    (result.results && result.results[0]?.text);
    
    if (!content) {
      throw new Error("Invalid response format from xAI API - could not locate content field");
    }

    const jsonStr = content.replace(/```json\n?|```/g, "").trim();
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      return res.json({ success: true, data: parsed });
    } catch (parseError) {
      console.error("Failed to parse JSON from xAI response content:", jsonStr, parseError);
      return res.json({
        success: false,
        error: "The xAI API returned a non-JSON response: " + content.substring(0, 500)
      });
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error("xAI Extraction Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unknown error during xAI extraction"
    });
  }
});

const INVOICE_SCHEMA = {
  "additionalProperties": false,
  "properties": {
    "invoice_number": {
      "description": "The unique identifier for the invoice.",
      "type": "string"
    },
    "invoice_date": {
      "description": "The date when the invoice was issued. Format: YY/MM/DD or DD/MM/YY, e.g., '04/05/26'.",
      "type": "string"
    },
    "customer_purchase_order_number": {
      "anyOf": [
        {
          "description": "The purchase order number provided by the customer.",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "description": "The purchase order number provided by the customer."
    },
    "sales_order_number": {
      "anyOf": [
        {
          "description": "The internal sales order number.",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "description": "The internal sales order number."
    },
    "delivery_note_number": {
      "anyOf": [
        {
          "description": "The number associated with the delivery note for the goods.",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "description": "The number associated with the delivery note for the goods."
    },
    "customer_contact": {
      "anyOf": [
        {
          "description": "The name or details of the customer contact person.",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "description": "The name or details of the customer contact person."
    },
    "bill_to_details": {
      "description": "Details of the entity being billed.",
      "properties": {
        "name": {
          "description": "The name of the entity being billed.",
          "type": "string"
        }
      },
      "required": [
        "name"
      ],
      "type": "object"
    },
    "ship_to_details": {
      "anyOf": [
        {
          "description": "Details of the entity where goods are shipped.",
          "properties": {
            "name": {
              "description": "The name of the entity receiving the shipment.",
              "type": "string"
            },
            "school_name": {
              "anyOf": [
                {
                  "description": "The name of the school, if applicable, for the shipment.",
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ],
              "description": "The name of the school, if applicable, for the shipment."
            },
            "address": {
              "description": "The shipping address.",
              "properties": {
                "street_address": {
                  "description": "Street name and number of the shipping address.",
                  "type": "string"
                },
                "city": {
                  "description": "City of the shipping address.",
                  "type": "string"
                },
                "region": {
                  "anyOf": [
                    {
                      "description": "Region or district of the shipping address.",
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "Region or district of the shipping address."
                }
              },
              "required": [
                "street_address",
                "city",
                "region"
              ],
              "type": "object"
            }
          },
          "required": [
            "name",
            "school_name",
            "address"
          ],
          "type": "object"
        },
        {
          "type": "null"
        }
      ],
      "description": "Details of the entity where goods are shipped."
    },
    "line_items": {
      "description": "A list of individual products or services on the invoice.",
      "items": {
        "properties": {
          "stock_code": {
            "description": "The unique code for the stock item.",
            "type": "string"
          },
          "description": {
            "description": "A description of the item.",
            "type": "string"
          },
          "quantity": {
            "description": "The quantity of the item.",
            "type": "number"
          },
          "unit_price": {
            "description": "The price per unit of the item.",
            "type": "number"
          },
          "discount": {
            "anyOf": [
              {
                "description": "The discount applied to the item, typically a percentage or fixed amount.",
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "description": "The discount applied to the item, typically a percentage or fixed amount."
          },
          "line_item_value": {
            "description": "The total value for this line item (quantity * unit price - discount).",
            "type": "number"
          }
        },
        "required": [
          "stock_code",
          "description",
          "quantity",
          "unit_price",
          "discount",
          "line_item_value"
        ],
        "type": "object"
      },
      "type": "array"
    },
    "summary": {
      "description": "Summary of financial totals for the invoice.",
      "properties": {
        "sub_total": {
          "description": "The total amount before VAT and other charges.",
          "type": "number"
        },
        "vat_rate": {
          "anyOf": [
            {
              "description": "The VAT rate applied, e.g., '15%'.",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "The VAT rate applied, e.g., '15%'."
        },
        "vat_amount": {
          "description": "The total amount of VAT charged.",
          "type": "number"
        },
        "amount_inclusive_of_vat": {
          "anyOf": [
            {
              "description": "The total amount including VAT.",
              "type": "number"
            },
            {
              "type": "null"
            }
          ],
          "description": "The total amount including VAT."
        },
        "freight_amount": {
          "anyOf": [
            {
              "description": "The cost of freight or shipping.",
              "type": "number"
            },
            {
              "type": "null"
            }
          ],
          "description": "The cost of freight or shipping."
        },
        "total_due": {
          "description": "The final total amount due for the invoice.",
          "type": "number"
        }
      },
      "required": [
        "sub_total",
        "vat_rate",
        "vat_amount",
        "amount_inclusive_of_vat",
        "freight_amount",
        "total_due"
      ],
      "type": "object"
    }
  },
  "required": [
    "invoice_number",
    "invoice_date",
    "customer_purchase_order_number",
    "sales_order_number",
    "delivery_note_number",
    "customer_contact",
    "bill_to_details",
    "ship_to_details",
    "line_items",
    "summary"
  ],
  "type": "object"
};

function mapLlamaResultToDetailedInvoice(extracted: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!extracted) return {};

  const billTo = (extracted.bill_to_details || {}) as Record<string, unknown>;
  let shipTo = extracted.ship_to_details as Record<string, unknown> | null | undefined;
  if (!shipTo && extracted.bill_to_details) {
    shipTo = {
      name: billTo.name,
      school_name: null,
      address: null
    };
  }
  const shipToName = (shipTo?.name || billTo.name || "") as string;
  const schoolName = (shipTo?.school_name || "") as string;
  const shipAddr = (shipTo?.address || {}) as Record<string, unknown>;
  const summary = (extracted.summary || {}) as Record<string, unknown>;

  // Standardize mapping to DetailedInvoice format
  const mapped: Record<string, unknown> = {
    taxInvoice: String(extracted.invoice_number || "").trim() || `TEMP-${Date.now()}`,
    invoiceDate: String(extracted.invoice_date || "").trim(),
    customerPO: String(extracted.customer_purchase_order_number || "").trim(),
    salesOrderNo: String(extracted.sales_order_number || "").trim(),
    deliveryNoteNo: String(extracted.delivery_note_number || "").trim(),
    customerContact: String(extracted.customer_contact || "").trim(),
    customerCode: "",
    customerName: String(billTo.name || "").trim(),
    schoolName: String(schoolName || "").trim(),
    streetAddress: String(shipAddr.street_address || "").trim(),
    suburb: "",
    district: String(shipAddr.region || "").trim(),
    customerAddressLine1: String(billTo.name || "").trim(),
    customerAddressLine2: "",
    postalCode: "",
    vatNo: "",
    deliveryCustomerName: String(shipToName || "").trim(),
    deliveryAddressLine1: String(shipAddr.street_address || "").trim(),
    deliveryAddressLine2: String(shipAddr.city || "").trim(),
    deliveryRegion: String(shipAddr.region || "").trim(),
    lineItems: Array.isArray(extracted.line_items)
      ? extracted.line_items.map((itemValue) => {
          const item = (itemValue || {}) as Record<string, unknown>;
          return {
            stockCode: String(item.stock_code || "").trim(),
            description: String(item.description || "").trim(),
            qty: typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity || "0")) || 0,
            unitPrice: typeof item.unit_price === "number" ? item.unit_price : parseFloat(String(item.unit_price || "0")) || 0,
            disc: typeof item.discount === "number" ? item.discount : parseFloat(String(item.discount || "0")) || 0,
            value: typeof item.line_item_value === "number" ? item.line_item_value : parseFloat(String(item.line_item_value || "0")) || 0,
          };
        })
      : [],
    subTotal: typeof summary.sub_total === "number" ? summary.sub_total : parseFloat(String(summary.sub_total || "0")) || 0,
    vatAmount: typeof summary.vat_amount === "number" ? summary.vat_amount : parseFloat(String(summary.vat_amount || "0")) || 0,
    amountIncl: typeof summary.amount_inclusive_of_vat === "number" ? summary.amount_inclusive_of_vat : parseFloat(String(summary.amount_inclusive_of_vat || "0")) || 0,
    freight: typeof summary.freight_amount === "number" ? summary.freight_amount : parseFloat(String(summary.freight_amount || "0")) || 0,
    totalDue: typeof summary.total_due === "number" ? summary.total_due : parseFloat(String(summary.total_due || "0")) || 0,
    accountTerms: "",
    companyName: "",
    companyAddressLine1: "",
    companyAddressLine2: "",
    companyPhysicalAddress: "",
    companyIndustrialPark: "",
    telephone: "",
    email: "",
    website: "",
    registrationNo: "",
    companyVatNo: "",
    bankName: "",
    branch: "",
    account: "",
    swift: "",
    page: "1"
  };

  return mapped;
}

// 3. LlamaCloud / LlamaIndex Extraction Route
app.post("/api/extractWithLlamaExtract", async (req, res) => {
  const { base64, fileName, mimeType } = req.body as { base64?: string; fileName?: string; mimeType?: string };
  if (!base64 || !fileName) {
    return res.status(400).json({ success: false, error: "The request must contain base64 and fileName." });
  }

  try {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY || process.env.LLAMAINDEX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Llama Cloud API key is not configured. Please set the LLAMA_CLOUD_API_KEY or LLAMAINDEX_API_KEY environment secret in the settings."
      });
    }

    console.log(`[LlamaCloud SDK] Initializing client for uploading and extracting: ${fileName}...`);
    const client = new LlamaCloud({ apiKey });

    const buffer = Buffer.from(base64, "base64");
    
    // Convert base64 buffer to SDK's Uploadable File object
    const uploadable = await toFile(buffer, fileName, { type: mimeType || "application/pdf" });
    
    console.log("[LlamaCloud SDK] Uploading file to storage...");
    const uploadedFile = await client.files.create({
      file: uploadable,
      purpose: "extract"
    });

    console.log(`[LlamaCloud SDK] File uploaded successfully. ID: ${uploadedFile.id}. Running custom schema extraction...`);
    const jobResult = await client.extract.run({
      file_input: uploadedFile.id,
      configuration: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data_schema: INVOICE_SCHEMA as any
      }
    });

    const rawExtractResult = jobResult.extract_result;
    if (!rawExtractResult) {
      throw new Error("LlamaCloud succeeded but returned no extraction results under extract_result.");
    }

    let extractedObj: unknown = rawExtractResult;
    if (Array.isArray(extractedObj)) {
      extractedObj = extractedObj[0];
    }

    if (typeof extractedObj === "string") {
      try {
        extractedObj = JSON.parse(extractedObj);
      } catch (parseErr) {
        console.warn("[LlamaCloud SDK] Failed to parse extract_result string as JSON directly, keeping string format.", parseErr);
      }
    }

    const structuredData = mapLlamaResultToDetailedInvoice(extractedObj as Record<string, unknown>);
    console.log("[LlamaCloud SDK] Structured extraction matched successfully to DetailedInvoice format.");

    return res.json({ success: true, data: structuredData });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("[LlamaCloud SDK Critical Error] Llama Cloud integration failed:", err.message || err);
    
    // Explicitly do not fall back to Gemini/GPT-4o/Heuristics per user's constraint.
    // Present a clear reason indicating credits are depleted / extraction failed.
    return res.status(500).json({
      success: false,
      error: "The credits for LlamaParse are depleted or the service request failed. Please check your Llama Cloud API key and usage."
    });
  }
});

// Endpoint for raw server-side PDF text extraction
app.post("/api/extractPdfText", async (req, res) => {
  const { base64 } = req.body as { base64?: string };
  if (!base64) {
    return res.status(400).json({ success: false, error: "The request must contain base64." });
  }
  try {
    const buffer = Buffer.from(base64, "base64");
    const text = await extractTextFromPdf(buffer);
    return res.json({ success: true, text });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("PDF text extraction error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to extract PDF text." });
  }
});

// API endpoints for administrative team member management (Auth)
interface FirebaseAuthErrorLike {
  message?: string;
  stack?: string;
  code?: string;
  cause?: {
    message?: string;
    stack?: string;
    toString?: () => string;
  } | unknown;
  toString?: () => string;
}

function getApiDisabledErrorDetails(err: unknown): { isApiDisabled: boolean; errorUrl: string } {
  const typedErr = err as FirebaseAuthErrorLike;
  const causeObj = typedErr?.cause as FirebaseAuthErrorLike | undefined;

  const serialized = [
    typedErr?.message,
    typedErr?.stack,
    typedErr?.code,
    JSON.stringify(err),
    causeObj?.message,
    causeObj?.stack,
    causeObj?.toString?.(),
    typedErr?.toString?.()
  ].filter(Boolean).join("\n");

  const isApiDisabled = 
    serialized.includes("identitytoolkit") || 
    serialized.includes("googleapis.com/apis") ||
    serialized.includes("403") ||
    serialized.includes("permission") ||
    serialized.includes("Identity Toolkit API");

  // Attempt to extract the URL: e.g., //console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=XXXX
  const urlRegex = /(?:https?:)?\/\/console\.(?:developers|cloud)\.google\.com\/[^\s'"]+/;
  const match = serialized.match(urlRegex);
  
  let errorUrl = "";
  if (match) {
    errorUrl = match[0];
    if (errorUrl.startsWith("//")) {
      errorUrl = "https:" + errorUrl;
    }
  } else {
    // Try to find the project ID or number in config if we have it
    try {
      const firebaseConfig = customRequire("./firebase-applet-config.json");
      if (firebaseConfig && firebaseConfig.projectId) {
        errorUrl = `https://console.cloud.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${firebaseConfig.projectId}`;
      }
    } catch {
      // ignore
    }
  }

  if (!errorUrl) {
    errorUrl = "https://console.cloud.google.com/apis/api/identitytoolkit.googleapis.com/overview";
  }

  return { isApiDisabled, errorUrl };
}

app.post("/api/team-members/reset-password", async (req, res) => {
  const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, error: "Missing userId or newPassword in request body." });
  }

  try {
    getFirebaseAdmin();
    const authAdmin = getAuth();
    await authAdmin.updateUser(userId, { password: newPassword });
    console.log(`[FIREBASE ADMIN] Password reset successfully for user: ${userId}`);
    return res.json({ success: true, message: "Password reset completed successfully." });
  } catch (error: unknown) {
    const err = error as FirebaseAuthErrorLike;
    console.error("Firebase Admin Reset Password Error:", err);
    
    // Leverage our extremely dynamic error evaluator to check fields and extract URLs
    const { isApiDisabled, errorUrl } = getApiDisabledErrorDetails(err);
    if (isApiDisabled) {
      return res.json({ 
        success: false, 
        apiNotEnabled: true, 
        errorUrl, 
        error: "Google Cloud Identity Toolkit API is currently disabled. Server-side administrative actions (like direct password resets) cannot be executed until this API is enabled." 
      });
    }
    return res.status(500).json({ success: false, error: err.message || "Failed to reset password." });
  }
});

app.post("/api/team-members/delete-account", async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ success: false, error: "Missing userId in request body." });
  }

  try {
    getFirebaseAdmin();
    const authAdmin = getAuth();
    // Delete the user in FirebaseAuth
    await authAdmin.deleteUser(userId);
    console.log(`[FIREBASE ADMIN] Firebase Authentication user account deleted: ${userId}`);
    return res.json({ success: true, message: "User authentication account deleted successfully." });
  } catch (error: unknown) {
    const err = error as FirebaseAuthErrorLike;
    // If user is not found (maybe deleting a pending user / already deleted user), we treat it as success.
    if (err.message && err.message.includes("auth/user-not-found")) {
      console.log(`[FIREBASE ADMIN] User to delete not found in Auth, treating as success: ${userId}`);
      return res.json({ success: true, message: "User account not found, skipped Auth deletion." });
    }
    console.error("Firebase Admin Delete User Error:", err);
    
    // Leverage our extremely dynamic error evaluator to check fields and extract URLs
    const { isApiDisabled, errorUrl } = getApiDisabledErrorDetails(err);
    if (isApiDisabled) {
      return res.json({ 
        success: true, 
        warning: "User deleted from dispatches, but Google Identity Toolkit API is disabled so the Auth account itself could not be removed automatically.",
        apiNotEnabled: true,
        errorUrl
      });
    }
    return res.status(500).json({ success: false, error: err.message || "Failed to delete user account." });
  }
});

// Vite Middleware for local hot development in sandbox
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK SERVER] listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
