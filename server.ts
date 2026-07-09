import express from "express";
import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import https from "https";
import http from "http";
import net from "net";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { LlamaCloud, toFile } from "@llamaindex/llama-cloud";
import { createRequire } from "module";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";


// Create a require function that is compatible with both ESM (tsx dev) and CJS (production)
const customRequire = typeof require !== "undefined"
  ? require
  : createRequire(import.meta.url);

let firebaseAdminApp: App | null = null;
function getFirebaseAdmin(): App {
  if (!firebaseAdminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      firebaseAdminApp = apps[0];
    } else {
      // In Cloud Functions / Cloud Run the project id and credentials are
      // auto-detected from the runtime environment. Locally we fall back to the
      // project id declared in firebase-applet-config.json.
      let projectId =
        process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        try {
          const firebaseConfig = customRequire("./firebase-applet-config.json");
          projectId = firebaseConfig?.projectId;
        } catch {
          // config file is optional in deployed environments
        }
      }
      firebaseAdminApp = projectId
        ? initializeApp({ projectId })
        : initializeApp();
    }
  }
  return firebaseAdminApp;
}

// Admin Firestore handle. The configured database is "(default)"
// (firebase-applet-config.json), so no named-database argument is needed.
function getAdminFirestore() {
  return getFirestore(getFirebaseAdmin());
}

// ---------------------------------------------------------------------------
// Auth & authorization for privileged admin endpoints
// ---------------------------------------------------------------------------

// Request augmented with the verified caller uid by requireAuth.
interface AuthedRequest extends Request {
  authUid: string;
}

// Strict limiter for privileged admin routes: 10 requests / 15 min per IP.
// NOTE: if this is ever deployed behind a proxy/load balancer, also set
// app.set("trust proxy", 1) so req.ip reflects the real client.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

// More permissive limiter for on-demand notifications, which are triggered by
// normal app actions rather than rare privileged operations: 60 / 15 min per IP.
const notifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many notifications. Please try again later." },
});

// Verify the Firebase ID token in the Authorization header and attach the
// caller uid to the request. Rejects revoked/disabled sessions (checkRevoked).
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ success: false, error: "Missing or malformed Authorization header." });
  }

  try {
    getFirebaseAdmin();
    // checkRevoked makes a backend call that needs admin credentials. Use it in
    // the deployed Functions runtime (or whenever a service account is wired via
    // GOOGLE_APPLICATION_CREDENTIALS). Without credentials (typical local dev) we
    // fall back to signature/expiry/audience verification, which needs none.
    const useRevocationCheck = !!(
      process.env.K_SERVICE ||
      process.env.FUNCTION_TARGET ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    const decoded = await getAuth().verifyIdToken(match[1], useRevocationCheck);
    (req as AuthedRequest).authUid = decoded.uid;
    return next();
  } catch (err) {
    console.error("[AUTH] ID token verification failed:", err instanceof Error ? err.message : err);
    return res.status(401).json({ success: false, error: "Invalid or expired authentication token." });
  }
}

// Resolve the target team member and confirm the caller owns it. Returns the
// member data only when it exists, is active, and ownerId === callerUid.
async function authorizeTeamMemberOwner(
  callerUid: string,
  targetUserId: string
): Promise<{ ownerId?: string; userId?: string; status?: string } | null> {
  const db = getAdminFirestore();
  const col = db.collection("team_members");

  // Primary: locate by the userId field.
  let data: FirebaseFirestore.DocumentData | undefined;
  const byField = await col.where("userId", "==", targetUserId).limit(1).get();
  if (!byField.empty) {
    data = byField.docs[0].data();
  } else {
    // Fallback: active members are keyed by uid, so the doc id may equal it.
    const byId = await col.doc(targetUserId).get();
    if (byId.exists) data = byId.data();
  }

  if (!data) return null;
  if (data.status !== "active") return null;
  if (data.ownerId !== callerUid) return null;
  return data;
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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Allow Firebase signInWithPopup to communicate with the auth popup.
// A default COOP of "same-origin" blocks Firebase from polling window.closed,
// which makes popups fail with auth/popup-closed-by-user. This relaxes it just
// enough to permit popups opened by our own page.
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

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
    // Try to find the project id from the runtime env (Cloud Functions) or,
    // failing that, the local config file.
    let projectId =
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
    if (!projectId) {
      try {
        const firebaseConfig = customRequire("./firebase-applet-config.json");
        projectId = firebaseConfig?.projectId || "";
      } catch {
        // ignore
      }
    }
    if (projectId) {
      errorUrl = `https://console.cloud.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`;
    }
  }

  if (!errorUrl) {
    errorUrl = "https://console.cloud.google.com/apis/api/identitytoolkit.googleapis.com/overview";
  }

  return { isApiDisabled, errorUrl };
}

app.post("/api/team-members/delete-account", adminLimiter, requireAuth, async (req, res) => {
  const callerUid = (req as AuthedRequest).authUid;
  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ success: false, error: "Missing userId in request body." });
  }

  // Authorization: caller must be the owner of the active team member being deleted.
  const member = await authorizeTeamMemberOwner(callerUid, userId);
  if (!member) {
    console.warn(`[AUDIT] DENIED delete-account by caller=${callerUid} target=${userId} (not an active member they own)`);
    return res.status(403).json({ success: false, error: "Not authorized to delete this account." });
  }

  try {
    getFirebaseAdmin();
    const authAdmin = getAuth();
    // Delete the user in FirebaseAuth
    await authAdmin.deleteUser(userId);
    console.log(`[AUDIT] delete-account OK caller=${callerUid} target=${userId}`);
    return res.json({ success: true, message: "User authentication account deleted successfully." });
  } catch (error: unknown) {
    const err = error as FirebaseAuthErrorLike;
    // If user is not found (maybe deleting a pending user / already deleted user), we treat it as success.
    if (err.message && err.message.includes("auth/user-not-found")) {
      console.log(`[AUDIT] delete-account OK (auth user already absent) caller=${callerUid} target=${userId}`);
      return res.json({ success: true, message: "User account not found, skipped Auth deletion." });
    }
    console.error(`[AUDIT] delete-account FAILED caller=${callerUid} target=${userId}:`, err);
    
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

interface PushoverResponse {
  status?: number;
  errors?: string[];
  request?: string;
}

type PushoverSendResult =
  | { ok: true }
  | { ok: false; httpStatus: number; error: string };

interface PushoverMessage {
  message: string;
  title?: string;
  url?: string;
  priority?: number;
}

// Send a Pushover notification to a single user key. The app token is read
// server-side from PUSHOVER_APP_TOKEN and is NEVER returned to the client. Maps
// Pushover/transport failures to the HTTP status the caller should surface.
async function sendPushoverNotification(userKey: string, msg: PushoverMessage): Promise<PushoverSendResult> {
  const appToken = process.env.PUSHOVER_APP_TOKEN;
  if (!appToken) {
    console.error("[AUDIT] notify: PUSHOVER_APP_TOKEN is not configured.");
    return { ok: false, httpStatus: 500, error: "Pushover app token is not configured on the server." };
  }

  try {
    // Pushover caps message at 1024 chars and title at 250.
    const params: Record<string, string> = {
      token: appToken,
      user: userKey,
      message: msg.message.slice(0, 1024),
    };
    if (msg.title) params.title = msg.title.slice(0, 250);
    if (msg.url) params.url = msg.url.slice(0, 512);
    if (typeof msg.priority === "number") params.priority = String(msg.priority);

    const pushoverRes = await makeRequest(
      "https://api.pushover.net/1/messages.json",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      },
      new URLSearchParams(params).toString()
    );

    const result = (await pushoverRes.json()) as PushoverResponse;
    if (result.status !== 1) {
      return { ok: false, httpStatus: 400, error: result.errors?.[0] || "Pushover rejected the request." };
    }
    return { ok: true };
  } catch (error: unknown) {
    const err = error as Error;
    return { ok: false, httpStatus: 500, error: err.message || "Failed to send notification." };
  }
}

type ResolvedRecipient =
  | { ok: true; userKey: string; label: string }
  | { ok: false; httpStatus: number; error: string };

// Resolve a notification recipient to a Pushover user key, enforcing the same
// ownership model as the rest of the app: a caller may notify their own account
// ({type:'self'}, key from settings/{uid}) or a team member they own
// ({type:'member', id}, key from team_members/{id} where ownerId === callerUid).
async function resolveRecipientKey(callerUid: string, to: unknown): Promise<ResolvedRecipient> {
  const target = (to ?? {}) as { type?: string; id?: string };
  const db = getAdminFirestore();

  if (target.type === "self") {
    const snap = await db.collection("settings").doc(callerUid).get();
    const data = snap.exists ? snap.data() : undefined;
    const userKey = typeof data?.pushoverUserKey === "string" ? data.pushoverUserKey.trim() : "";
    if (!userKey) {
      return { ok: false, httpStatus: 400, error: "No Pushover user key saved for your account." };
    }
    return { ok: true, userKey, label: "self" };
  }

  if (target.type === "member" && typeof target.id === "string" && target.id) {
    const snap = await db.collection("team_members").doc(target.id).get();
    if (!snap.exists) {
      return { ok: false, httpStatus: 404, error: "Team member not found." };
    }
    const member = snap.data();
    if (!member || member.ownerId !== callerUid) {
      console.warn(`[AUDIT] DENIED notify by caller=${callerUid} target=member:${target.id} (not owner)`);
      return { ok: false, httpStatus: 403, error: "Not authorized to notify this member." };
    }
    const userKey = typeof member.pushoverUserKey === "string" ? member.pushoverUserKey.trim() : "";
    if (!userKey) {
      return { ok: false, httpStatus: 400, error: "No Pushover user key saved for this member." };
    }
    return { ok: true, userKey, label: `member:${target.id}` };
  }

  return { ok: false, httpStatus: 400, error: "Invalid recipient." };
}

// Generic notification endpoint usable from anywhere in the app. Keeps the
// Pushover app token server-side; the caller only specifies who and what.
// Body: { to: {type:'self'} | {type:'member', id}, message, title?, url?, priority? }
app.post("/api/notify", notifyLimiter, requireAuth, async (req, res) => {
  const callerUid = (req as AuthedRequest).authUid;
  const { to, message, title, url, priority } = (req.body ?? {}) as {
    to?: unknown; message?: unknown; title?: unknown; url?: unknown; priority?: unknown;
  };

  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return res.status(400).json({ success: false, error: "A message is required." });
  }

  let recipient: ResolvedRecipient;
  try {
    recipient = await resolveRecipientKey(callerUid, to);
  } catch (err) {
    console.error(`[AUDIT] notify recipient lookup FAILED caller=${callerUid}:`, err);
    return res.status(500).json({ success: false, error: "Failed to resolve recipient." });
  }
  if (!recipient.ok) {
    return res.status(recipient.httpStatus).json({ success: false, error: recipient.error });
  }

  const result = await sendPushoverNotification(recipient.userKey, {
    message: text,
    title: typeof title === "string" && title.trim() ? title.trim() : "NR Portal",
    url: typeof url === "string" && url.trim() ? url.trim() : undefined,
    priority: typeof priority === "number" ? priority : undefined,
  });

  if (!result.ok) {
    console.warn(`[AUDIT] notify FAILED caller=${callerUid} to=${recipient.label}: ${result.error}`);
    return res.status(result.httpStatus).json({ success: false, error: result.error });
  }
  console.log(`[AUDIT] notify OK caller=${callerUid} to=${recipient.label}`);
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Zoho Books integration - push completed Client Invoices to Zoho Books.
// Each user connects their own Zoho org from Settings; credentials live in the
// owner-only `zoho_credentials/{uid}` Firestore collection (never the public
// `settings` doc) and are only ever read server-side via the Admin SDK.
// ---------------------------------------------------------------------------

interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  region: string;
}

async function getZohoCredentialsForUser(uid: string): Promise<ZohoCredentials> {
  const snap = await getAdminFirestore().collection("zoho_credentials").doc(uid).get();
  const data = snap.exists ? snap.data() : undefined;
  const clientId = typeof data?.clientId === "string" ? data.clientId.trim() : "";
  const clientSecret = typeof data?.clientSecret === "string" ? data.clientSecret.trim() : "";
  const refreshToken = typeof data?.refreshToken === "string" ? data.refreshToken.trim() : "";
  const organizationId = typeof data?.organizationId === "string" ? data.organizationId.trim() : "";
  const region = typeof data?.region === "string" && data.region.trim() ? data.region.trim() : "com";
  if (!clientId || !clientSecret || !refreshToken || !organizationId) {
    throw new Error("Zoho Books is not connected. Configure it in Settings first.");
  }
  return { clientId, clientSecret, refreshToken, organizationId, region };
}

// Maps a Zoho data-center region to its accounts/API/app domains.
// See https://www.zoho.com/books/api/v3/ - defaults to the US data center.
function getZohoDomains(region: string): { accountsDomain: string; apiDomain: string; appDomain: string } {
  const cleanRegion = (region || "com").trim().toLowerCase();
  return {
    accountsDomain: `accounts.zoho.${cleanRegion}`,
    apiDomain: `www.zohoapis.${cleanRegion}`,
    appDomain: `books.zoho.${cleanRegion}`,
  };
}

interface ZohoTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

// In-memory access token cache, keyed by uid - access tokens last ~1hr; a 60s
// safety buffer avoids using one that expires mid-request.
const zohoAccessTokens = new Map<string, { token: string; expiresAt: number }>();

async function getZohoAccessToken(uid: string, creds: ZohoCredentials): Promise<string> {
  const cached = zohoAccessTokens.get(uid);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const { accountsDomain } = getZohoDomains(creds.region);
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
  }).toString();

  const response = await makeRequest(
    `https://${accountsDomain}/oauth/v2/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 },
    params
  );
  const data = (await response.json()) as ZohoTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(`Failed to refresh Zoho access token: ${data.error || response.statusText || "unknown error"}`);
  }

  const token = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000),
  };
  zohoAccessTokens.set(uid, token);
  return token.token;
}

// Thin wrapper around a Zoho Books API call: attaches the access token,
// organization_id, and parses the JSON body (Zoho errors come back as 200 OK
// with a non-zero "code" field, so callers must check that too).
async function zohoRequest(
  uid: string,
  creds: ZohoCredentials,
  path: string,
  options: { method?: string; query?: Record<string, string>; body?: unknown } = {}
): Promise<{ ok: boolean; status?: number; data: Record<string, unknown> }> {
  const accessToken = await getZohoAccessToken(uid, creds);
  const { apiDomain } = getZohoDomains(creds.region);

  const query = new URLSearchParams({ organization_id: creds.organizationId, ...(options.query || {}) }).toString();
  const url = `https://${apiDomain}/books/v3${path}?${query}`;
  const bodyStr = options.body ? JSON.stringify(options.body) : null;

  const response = await makeRequest(
    url,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    },
    bodyStr
  );
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

interface ZohoContact {
  contact_id: string;
  contact_name: string;
}

// Lists every active contact in the org (paginated, 200/page) so the client
// can offer a picker at Complete time - invoices are linked to a customer the
// user explicitly chooses rather than one matched/created by name.
async function listZohoContacts(uid: string, creds: ZohoCredentials): Promise<{ id: string; name: string }[]> {
  const contacts: { id: string; name: string }[] = [];
  let page = 1;
  // Cap at 10 pages (2000 contacts) - far beyond what this app's customer
  // base needs, just a safety net against an unbounded loop.
  for (; page <= 10; page++) {
    const res = await zohoRequest(uid, creds, "/contacts", {
      query: { per_page: "200", page: String(page), sort_column: "contact_name" },
    });
    if (!res.ok || Number(res.data.code) !== 0) {
      throw new Error(`Zoho contact list failed: ${res.data.message || "unknown error"}`);
    }
    const pageContacts = (res.data.contacts as ZohoContact[] | undefined) || [];
    contacts.push(...pageContacts.map(c => ({ id: c.contact_id, name: c.contact_name })));
    const hasMore = (res.data.page_context as { has_more_page?: boolean } | undefined)?.has_more_page;
    if (!hasMore) break;
  }
  return contacts;
}

interface ZohoLineItemInput {
  description: string;
  quantity: number;
  rate: number;
}

interface ZohoInvoiceResult {
  invoiceId: string;
  invoiceUrl: string;
}

async function createZohoInvoice(uid: string, creds: ZohoCredentials, params: {
  customerId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  lineItems: ZohoLineItemInput[];
}): Promise<ZohoInvoiceResult> {
  const { appDomain } = getZohoDomains(creds.region);
  const body: Record<string, unknown> = {
    customer_id: params.customerId,
    // Requires auto-numbering to be disabled in Zoho Books (Settings ->
    // Invoices -> Auto-generate Invoice Number), otherwise Zoho rejects a
    // custom invoice_number that doesn't match its own sequence.
    invoice_number: params.invoiceNumber,
    line_items: params.lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      rate: li.rate,
    })),
  };
  if (params.invoiceDate) body.date = params.invoiceDate;

  const res = await zohoRequest(uid, creds, "/invoices", { method: "POST", body });
  if (!res.ok || Number(res.data.code) !== 0) {
    throw new Error(`Zoho invoice creation failed: ${res.data.message || "unknown error"}`);
  }
  const invoice = res.data.invoice as { invoice_id: string };
  return {
    invoiceId: invoice.invoice_id,
    invoiceUrl: `https://${appDomain}/app#/invoices/${invoice.invoice_id}`,
  };
}

// POST /api/zoho/test-connection - verifies a set of Zoho credentials work,
// without requiring them to be saved first (so Settings can offer "Test" on
// an unsaved edit). Body carries the candidate credentials directly since
// they may not exist in Firestore yet.
app.post("/api/zoho/test-connection", adminLimiter, requireAuth, async (req, res) => {
  const callerUid = (req as AuthedRequest).authUid;
  const { clientId, clientSecret, refreshToken, organizationId, region } = (req.body ?? {}) as {
    clientId?: unknown; clientSecret?: unknown; refreshToken?: unknown; organizationId?: unknown; region?: unknown;
  };

  const creds: ZohoCredentials = {
    clientId: typeof clientId === "string" ? clientId.trim() : "",
    clientSecret: typeof clientSecret === "string" ? clientSecret.trim() : "",
    refreshToken: typeof refreshToken === "string" ? refreshToken.trim() : "",
    organizationId: typeof organizationId === "string" ? organizationId.trim() : "",
    region: typeof region === "string" && region.trim() ? region.trim() : "com",
  };
  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken || !creds.organizationId) {
    return res.status(400).json({ success: false, error: "Client ID, Client Secret, Refresh Token and Organization ID are all required." });
  }

  // Use a throwaway cache key so a failed test doesn't poison the real cache
  // entry (and a stale test-token can't leak into create-invoice calls).
  const testUid = `test:${callerUid}`;
  try {
    await getZohoAccessToken(testUid, creds);
    // Verify with /contacts, not /organizations - it only needs the same
    // ZohoBooks.contacts.READ scope create-invoice already requires, whereas
    // /organizations needs ZohoBooks.settings.READ, which a token generated
    // before that scope existed in our setup instructions won't have.
    const contactsRes = await zohoRequest(testUid, creds, "/contacts", { query: { per_page: "1" } });
    if (!contactsRes.ok || Number(contactsRes.data.code) !== 0) {
      throw new Error(`${contactsRes.data.message || "Could not read contacts from Zoho Books. Check the organization ID and that the token has the contacts/invoices scopes."}`);
    }

    // Org name is a nice-to-have for the success message, not a requirement -
    // a token without ZohoBooks.settings.READ still passes the test above.
    let organizationName: string | null = null;
    try {
      const orgRes = await zohoRequest(testUid, creds, `/organizations/${encodeURIComponent(creds.organizationId)}`);
      if (orgRes.ok && Number(orgRes.data.code) === 0) {
        organizationName = (orgRes.data.organization as { name?: string } | undefined)?.name || null;
      }
    } catch {
      // Ignore - organization name is optional.
    }

    console.log(`[AUDIT] zoho test-connection OK caller=${callerUid} org=${organizationName || creds.organizationId}`);
    return res.json({ success: true, organizationName });
  } catch (error: unknown) {
    const err = error as Error;
    console.warn(`[AUDIT] zoho test-connection FAILED caller=${callerUid}:`, err.message || err);
    return res.status(400).json({ success: false, error: err.message || "Could not connect to Zoho Books with these credentials." });
  } finally {
    zohoAccessTokens.delete(testUid);
  }
});

// GET /api/zoho/contacts - lists the caller's Zoho Books customers, for the
// "choose who this invoice is linked to" picker shown on Complete.
app.get("/api/zoho/contacts", notifyLimiter, requireAuth, async (req, res) => {
  const callerUid = (req as AuthedRequest).authUid;
  try {
    const creds = await getZohoCredentialsForUser(callerUid);
    const contacts = await listZohoContacts(callerUid, creds);
    return res.json({ success: true, contacts });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[AUDIT] zoho list-contacts FAILED caller=${callerUid}:`, err.message || err);
    return res.status(500).json({ success: false, error: err.message || "Failed to load customers from Zoho Books." });
  }
});

// POST /api/zoho/create-invoice - pushes a completed Client Invoice bundle to
// Zoho Books as an invoice, linked to a customer the user explicitly picked
// (see GET /api/zoho/contacts), using the caller's own saved Zoho connection.
// Body: { customerId, invoiceNumber, invoiceDate?, lineItems }. Called from
// SelfInvoiceModal.handleComplete once the bundle is marked completed in
// Firestore; a Zoho failure here does not roll that back, it's surfaced to
// the user to retry.
app.post("/api/zoho/create-invoice", notifyLimiter, requireAuth, async (req, res) => {
  const callerUid = (req as AuthedRequest).authUid;
  const { customerId, invoiceNumber, invoiceDate, lineItems } = (req.body ?? {}) as {
    customerId?: unknown; invoiceNumber?: unknown; invoiceDate?: unknown; lineItems?: unknown;
  };

  const custId = typeof customerId === "string" ? customerId.trim() : "";
  const number = typeof invoiceNumber === "string" ? invoiceNumber.trim() : "";
  if (!custId) {
    return res.status(400).json({ success: false, error: "A Zoho customer must be selected." });
  }
  if (!number) {
    return res.status(400).json({ success: false, error: "An invoice number is required." });
  }
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ success: false, error: "At least one line item is required." });
  }
  const items: ZohoLineItemInput[] = lineItems.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      description: String(item.description || "").slice(0, 500),
      quantity: typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity || "1")) || 1,
      rate: typeof item.rate === "number" ? item.rate : parseFloat(String(item.rate || "0")) || 0,
    };
  });

  try {
    const creds = await getZohoCredentialsForUser(callerUid);
    const invoice = await createZohoInvoice(callerUid, creds, {
      customerId: custId,
      invoiceNumber: number,
      invoiceDate: typeof invoiceDate === "string" ? invoiceDate : undefined,
      lineItems: items,
    });
    console.log(`[AUDIT] zoho create-invoice OK caller=${callerUid} invoice=${number} zohoInvoiceId=${invoice.invoiceId}`);
    return res.json({ success: true, zohoInvoiceId: invoice.invoiceId, zohoInvoiceUrl: invoice.invoiceUrl });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[AUDIT] zoho create-invoice FAILED caller=${callerUid} invoice=${number}:`, err.message || err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create invoice in Zoho Books." });
  }
});

function findFreePort(startPort: number, maxAttempts = 100): Promise<number> {
  return new Promise((resolve, reject) => {
    if (maxAttempts <= 0) {
      reject(new Error("Could not find a free port after 100 attempts"));
      return;
    }
    const server = net.createServer();
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(findFreePort(startPort + 1, maxAttempts - 1));
      } else {
        reject(err);
      }
    });
    server.listen(startPort, "0.0.0.0", () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

// Vite Middleware for local hot development in sandbox
async function startServer() {
  // Keep the local dev server alive if an admin SDK call (e.g. Firestore without
  // credentials) rejects in a background task that escapes a request's try/catch.
  // The offending request still fails with a 500; the process must not die.
  process.on("unhandledRejection", (reason) => {
    console.error("[DEV] Unhandled promise rejection (server kept alive):", reason);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
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

  const startPort = PORT;
  try {
    const freePort = await findFreePort(startPort);
    if (freePort !== startPort) {
      console.warn(`[SERVER] Port ${startPort} is already in use. Falling back to free port ${freePort}.`);
    }
    httpServer.listen(freePort, "0.0.0.0", () => {
      console.log(`[FULLSTACK SERVER] listening on http://localhost:${freePort}`);
    });
  } catch (err) {
    console.error("[DEV] Failed to start server:", err);
    process.exit(1);
  }
}


// Export the Express app so it can be wrapped by a Cloud Function (see
// functions/index.js). The standalone listener only runs for local dev
// (`npm run dev`) and the `npm start` script -- never inside Cloud Functions,
// which sets K_SERVICE / FUNCTION_TARGET in the environment.
export { app };

if (
  !process.env.K_SERVICE &&
  !process.env.FUNCTION_TARGET &&
  !process.env.FUNCTIONS_EMULATOR
) {
  startServer();
}
