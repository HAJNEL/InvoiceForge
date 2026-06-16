import * as pdfjs from 'pdfjs-dist';

// Setting up the worker
// Using the minified worker bundled with the library
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
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

/**
 * Extracts all text from a PDF file using server-side service with a local fallback
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  // First, always try robust server-side extraction which is 100% reliable and doesn't freeze in frames
  try {
    const base64 = await fileToBase64(file);
    const response = await fetch('/api/extractPdfText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64 })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && typeof result.text === 'string') {
        console.log('[DEBUG] Server-side PDF text extraction succeeded!');
        return result.text;
      }
    }
    console.warn('[pdfService] Server-side extraction did not return success, trying client-side fallback...');
  } catch (serverErr) {
    console.warn('[pdfService] Server-side extraction failed or was unreachable, trying client-side fallback...', serverErr);
  }

  // Client-side fallback if server-side is unavailable
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument(arrayBuffer);
  
  try {
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return (item as { str: string }).str;
          }
          return '';
        })
        .join(' ');
      
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF client-side:', error);
    throw new Error('Failed to extract text from PDF. Ensure the file is not corrupted.', { cause: error });
  }
}

