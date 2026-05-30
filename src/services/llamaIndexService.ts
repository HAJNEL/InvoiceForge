import { DetailedInvoice } from './xaiService';

// Helper function to convert File object to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Strip out the data:*;base64, prefix
      const base64Str = result.split(',')[1];
      resolve(base64Str);
    };
    reader.onerror = error => reject(error);
  });
};

export async function extractDetailedInvoiceLlamaIndex(file: File): Promise<DetailedInvoice> {
  try {
    const base64 = await fileToBase64(file);
    const response = await fetch('/api/extractWithLlamaExtract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Server error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg = parsed.error || errorMsg;
      } catch (e) {
        console.warn("Failed to parse LlamaIndex server error text:", e);
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    console.log('[DEBUG] LlamaIndex API Response:', result);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to extract structured data using LlamaIndex.");
    }
    if (!result.data) {
      throw new Error("LlamaIndex response did not contain data.");
    }
    return result.data;
  } catch (error: unknown) {
    console.error("Failed to extract with LlamaIndex:", error);
    if (error instanceof Error) {
      throw new Error(error.message || "Failed to extract structured data using LlamaIndex.", { cause: error });
    }
    throw new Error("Failed to extract structured data using LlamaIndex.", { cause: error });
  }
}
