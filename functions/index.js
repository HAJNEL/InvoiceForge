const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");

// Manually parse local .env file inside functions subdirectory if exists
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      if (line.trim().startsWith("#") || !line.trim()) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val.trim();
      }
    });
  }
} catch (e) {
  console.error("Failed to parse local .env file manually:", e);
}

admin.initializeApp();

// Access the API key from environment configuration or Secret Manager lazily
// firebase functions:secrets:set OPENAI_API_KEY
let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || (functions.config().openai && functions.config().openai.key);
    if (!apiKey) {
      throw new Error("OpenAI API key is missing. Please set the OPENAI_API_KEY environment variable in Firebase Settings.");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const https = require("https");

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    
    if (body) {
      if (Buffer.isBuffer(body)) {
        headers["Content-Length"] = body.length;
      } else if (typeof body === "string") {
        headers["Content-Length"] = Buffer.byteLength(body, "utf-8");
      }
    }

    const reqOptions = {
      method: options.method || "GET",
      headers: headers,
      timeout: options.timeout || 300000,
    };

    const req = https.request(url, reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf-8");
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: async () => responseBody,
          json: async () => JSON.parse(responseBody)
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

exports.extractWithXAI = functions.runWith({ 
  timeoutSeconds: 300,
  memory: "512MB"
}).https.onCall(async (data, context) => {
  if (!context.auth) {
    return {
      success: false,
      error: "The function must be called while authenticated."
    };
  }

  const { text } = data;
  if (!text) {
    return {
      success: false,
      error: "The function must be called with 'text'."
    };
  }

  try {
    // Check env, then config
    const apiKey = process.env.XAI_API_KEY || 
                   (functions.config().xai && functions.config().xai.key);

    if (!apiKey) {
      console.error("XAI_API_KEY is missing in all sources");
      return {
        success: false,
        error: "xAI API key is not configured. Please set XAI_API_KEY or xai.key config."
      };
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
    
    try {
      const response = await makeRequest("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        timeout: 280000 // 280 seconds
      }, JSON.stringify({
        model: "grok-4.20-reasoning",
        input: prompt,
      }));

      console.log("xAI API Raw Response Status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`xAI API Error ${response.status}:`, errorText);
        throw new Error(`xAI API responded with ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("xAI API Raw Response data found:", !!result);
      
      // Try multiple possible paths for the content based on typical LLM API evolutions
      const content = result.response || 
                      result.message || 
                      (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || 
                      (result.results && result.results[0] && result.results[0].text);
      
      if (!content) {
        console.error("No content found in xAI response data:", JSON.stringify(result));
        throw new Error("Invalid response format from xAI API - could not locate content field");
      }
      
      // Clean potential markdown and parse
      const jsonStr = content.replace(/```json\n?|```/g, "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        return { success: true, data: parsed };
      } catch (parseError) {
        console.error("Failed to parse JSON from xAI response content:", jsonStr);
        return {
          success: false,
          error: "The xAI API returned a non-JSON response: " + content.substring(0, 500)
        };
      }

    } catch (fetchError) {
      console.error("xAI fetch error:", fetchError);
      return {
        success: false,
        error: `Failed to communicate with xAI API: ${fetchError.message}`
      };
    }

  } catch (error) {
    console.error("Final catch in extractWithXAI:", error);
    return {
      success: false,
      error: error.message || "Unknown error during xAI extraction"
    };
  }
});

exports.extractInvoiceData = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    return {
      success: false,
      error: "The function must be called while authenticated."
    };
  }

  const { fileUrl } = data;
  if (!fileUrl) {
    return {
      success: false,
      error: "The function must be called with a fileUrl."
    };
  }

  try {
    // Ensure OpenAI API key is present
    let openaiApiInstance;
    try {
      openaiApiInstance = getOpenAI();
    } catch (apiKeyErr) {
      return {
        success: false,
        error: apiKeyErr.message || "OpenAI API key is missing. Please set OPENAI_API_KEY as an environment secret."
      };
    }

    // 1. Download the file from Firebase Storage or provided URL
    const bucket = admin.storage().bucket();
    // Assuming fileUrl is a path in storage if it doesn't start with http
    const filePath = fileUrl.includes("http") 
      ? fileUrl.split("/o/")[1].split("?")[0].replace(/%2F/g, "/") 
      : fileUrl;
    
    const file = bucket.file(filePath);
    const [buffer] = await file.download();

    // 2. Extract text from PDF
    const pdfData = await pdf(buffer);
    const textContent = pdfData.text;

    // 3. Call OpenAI for structured extraction
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

    const extractedData = JSON.parse(response.choices[0].message.content);
    
    // Add confidence score (simulated or derived from OpenAI if possible)
    extractedData.confidenceScore = 0.95; 

    return {
      success: true,
      data: extractedData
    };

  } catch (error) {
    console.error("Extraction error:", error);
    return {
      success: false,
      error: "Failed to extract info from invoice: " + error.message
    };
  }
});

let cachedLlamaAgentId = null;

const invoiceDataSchema = {
  type: "object",
  properties: {
    taxInvoice: { type: "string" },
    invoiceDate: { type: "string" },
    customerPO: { type: "string" },
    salesOrderNo: { type: "string" },
    deliveryNoteNo: { type: "string" },
    customerContact: { type: "string" },
    customerCode: { type: "string" },
    customerName: { type: "string" },
    schoolName: { type: "string" },
    streetAddress: { type: "string" },
    suburb: { type: "string" },
    district: { type: "string" },
    customerAddressLine1: { type: "string" },
    customerAddressLine2: { type: "string" },
    postalCode: { type: "string" },
    vatNo: { type: "string" },
    deliveryCustomerName: { type: "string" },
    deliveryAddressLine1: { type: "string" },
    deliveryAddressLine2: { type: "string" },
    deliveryRegion: { type: "string" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stockCode: { type: "string" },
          description: { type: "string" },
          qty: { type: "number" },
          unitPrice: { type: "number" },
          disc: { type: "number" },
          value: { type: "number" }
        }
      }
    },
    subTotal: { type: "number" },
    vatAmount: { type: "number" },
    amountIncl: { type: "number" },
    freight: { type: "number" },
    totalDue: { type: "number" },
    accountTerms: { type: "string" },
    companyName: { type: "string" },
    companyAddressLine1: { type: "string" },
    companyAddressLine2: { type: "string" },
    companyPhysicalAddress: { type: "string" },
    companyIndustrialPark: { type: "string" },
    telephone: { type: "string" },
    email: { type: "string" },
    website: { type: "string" },
    registrationNo: { type: "string" },
    companyVatNo: { type: "string" },
    bankName: { type: "string" },
    branch: { type: "string" },
    account: { type: "string" },
    swift: { type: "string" },
    page: { type: "string" }
  }
};

exports.extractWithLlamaExtract = functions.runWith({
  timeoutSeconds: 300,
  memory: "512MB"
}).https.onCall(async (data, context) => {
  if (!context.auth) {
    return {
      success: false,
      error: "The function must be called while authenticated."
    };
  }

  const { base64, fileName, mimeType } = data;
  if (!base64 || !fileName) {
    return {
      success: false,
      error: "The function must be called with base64 and fileName."
    };
  }

  try {
    const apiKey = process.env.LLAMAINDEX_API_KEY || 
                   process.env.LLAMA_CLOUD_API_KEY ||
                   (functions.config().llamaindex && functions.config().llamaindex.key) ||
                   (functions.config().llamacloud && functions.config().llamacloud.key);

    if (!apiKey) {
      console.error("LlamaIndex/LlamaCloud API key is missing");
      return {
        success: false,
        error: "LlamaIndex API key is not configured. Please set the LLAMAINDEX_API_KEY environment secret in Firebase Settings."
      };
    }

    // 1. Upload file to LlamaCloud using manual multipart/form-data assembly
    console.log(`Uploading ${fileName} to LlamaCloud...`);
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const headerPurpose = `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nextract\r\n`;
    const headerFile = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType || "application/pdf"}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const buffer = Buffer.concat([
      Buffer.from(headerPurpose, "utf-8"),
      Buffer.from(headerFile, "utf-8"),
      Buffer.from(base64, "base64"),
      Buffer.from(footer, "utf-8")
    ]);

    const uploadResponse = await makeRequest("https://api.llamaindex.ai/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      }
    }, buffer);

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error("LlamaCloud file upload response error:", errText);
      throw new Error(`LlamaCloud file upload failed with status ${uploadResponse.status}: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;
    console.log("File uploaded successfully to LlamaCloud, file ID:", fileId);

    // 2. Trigger saved configuration extraction
    const configurationId = "cfg-gv42rnwnuvawp75vd758c2g8pxpj";
    console.log(`Triggering LlamaCloud extraction run for file ${fileId} with configuration ID ${configurationId}...`);
    
    const runResponse = await makeRequest("https://api.llamaindex.ai/v1/extracts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }, JSON.stringify({
      file_input: fileId,
      configuration_id: configurationId
    }));

    if (!runResponse.ok) {
      const errText = await runResponse.text();
      console.error("LlamaCloud extraction trigger error:", errText);
      throw new Error(`LlamaCloud extraction trigger failed with status ${runResponse.status}: ${errText}`);
    }

    const extractJobData = await runResponse.json();
    const extractId = extractJobData.id;
    if (!extractId) {
      throw new Error("Could not locate LlamaCloud Extract ID from response: " + JSON.stringify(extractJobData));
    }
    console.log("Extraction triggered successfully, Extract ID:", extractId);

    // 3. Poll extraction status until COMPLETED/SUCCESS or timeout (120 seconds limit)
    let status = "pending";
    const startPoll = Date.now();
    const PAGE_TIMEOUT = 120000;
    let pollResponseData = null;

    while (
      (status === "pending" || status === "running" || status === "PENDING" || status === "RUNNING") && 
      (Date.now() - startPoll < PAGE_TIMEOUT)
    ) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`Polling LlamaCloud extract ${extractId} status...`);
      const pollResp = await makeRequest(`https://api.llamaindex.ai/v1/extracts/${extractId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });

      if (!pollResp.ok) {
        console.warn(`Polling failed with status ${pollResp.status}, will retry`);
        continue;
      }

      pollResponseData = await pollResp.json();
      status = pollResponseData.status || "pending";
      console.log(`LlamaCloud extract status: ${status}`);
    }

    const lowerStatus = status.toLowerCase();
    if (lowerStatus !== "completed" && lowerStatus !== "success" && lowerStatus !== "done") {
      throw new Error(`LlamaCloud extraction did not complete, ended with status: ${status}`);
    }

    // 4. Extract result and parse
    console.log("LlamaCloud extraction completed successfully, retrieving results...");
    const extractResultField = pollResponseData.extract_result || pollResponseData.extractResult;
    
    if (!extractResultField) {
      throw new Error("LlamaCloud extraction succeeded but extract_result was not found in response: " + JSON.stringify(pollResponseData));
    }

    let structuredData = null;
    if (typeof extractResultField === "string") {
      try {
        structuredData = JSON.parse(extractResultField);
      } catch (e) {
        console.warn("Failed to parse extract_result as JSON string directly, returning raw string:", e);
        structuredData = extractResultField;
      }
    } else {
      structuredData = extractResultField;
    }

    console.log("Structured extraction complete with LlamaCloud:", JSON.stringify(structuredData));
    return { success: true, data: structuredData };

  } catch (error) {
    console.error("Failed LlamaCloud extraction:", error);
    return {
      success: false,
      error: error.message || "Unknown error during LlamaCloud extraction",
      stack: error.stack
    };
  }
});
