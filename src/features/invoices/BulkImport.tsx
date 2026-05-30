import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  BrainCircuit,
  Eye,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { extractTextFromPdf } from '../../services/pdfService';
import { parseInvoiceWithRegex } from '../../services/ruleBasedParser';
import { extractDetailedInvoiceLlamaIndex } from '../../services/llamaIndexService';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { DetailedInvoice } from '../../services/xaiService';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  extractedData?: string;
  error?: string;
  isDuplicate?: boolean;
}

export function BulkImport() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [useAI, setUseAI] = useState(false);
  const navigate = useNavigate();

  const processFile = useCallback(async (uploadFile: { id: string, file: File }) => {
    const { id, file } = uploadFile;
    
    // Simulate initial upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 50) {
        clearInterval(interval);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 50, status: 'processing' } : f));
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
      }
    }, 100);

    try {
      const isPdf = file.type === 'application/pdf';
      
      if (isPdf || useAI) {
        let detailedData: Partial<DetailedInvoice> = {};
        
        if (useAI) {
          // Use LlamaIndex (via LlamaExtract) for Advanced AI extraction
          detailedData = await extractDetailedInvoiceLlamaIndex(file);
          console.log(`[DEBUG] LlamaIndex AI Extraction Result:`, detailedData);
        } else {
          // Step 1: Extract Text from PDF
          const text = await extractTextFromPdf(file);
          console.log(`[DEBUG] Extracted text for ${file.name}:`, text);
          
          // Default: Non-AI deterministic extraction
          detailedData = parseInvoiceWithRegex(text);
          console.log(`[DEBUG] Regex Extraction Result:`, detailedData);
          
          // Step 2.1: Post-process extraction with specific district regex
          const districtRegex = /(?<=\s{2,})([A-Z]+(?:\s[A-Z]+)*)(?=\s{2,}WC\b)/i;
          const districtMatch = text.match(districtRegex);
          if (districtMatch && districtMatch[1]) {
            const district = districtMatch[1].trim();
            console.log(`[DEBUG] District Regex matched: "${district}"`);
            detailedData.district = district;
          }
        }

        // Final summary log of populated fields
        console.log(`--- [${file.name}] FIELDS FOUND & POPULATED ---`);
        const foundFields: Record<string, unknown> = {};
        Object.entries(detailedData).forEach(([key, val]) => {
          if (val && (Array.isArray(val) ? val.length > 0 : true)) {
            foundFields[key] = val;
          }
        });
        console.table(foundFields);
        console.log(`-------------------------------------------`);
        
        // Normalization block to adhere strictly to rules schema (isValidInvoice)
        const normalizedData: Partial<DetailedInvoice> = {
          ...detailedData,
          taxInvoice: String(detailedData.taxInvoice || '').trim() || `TEMP-${Date.now()}`,
          totalDue: typeof detailedData.totalDue === 'number' 
            ? detailedData.totalDue 
            : parseFloat(String(detailedData.totalDue || 0).replace(/[^0-9.]/g, '')) || 0
        };

        if (normalizedData.district) normalizedData.district = String(normalizedData.district).substring(0, 190);
        if (normalizedData.schoolName) normalizedData.schoolName = String(normalizedData.schoolName).substring(0, 190);
        if (normalizedData.streetAddress) normalizedData.streetAddress = String(normalizedData.streetAddress).substring(0, 490);
        if (normalizedData.suburb) normalizedData.suburb = String(normalizedData.suburb).substring(0, 190);

        // Ensure optional arrays/lists match structure
        if (normalizedData.lineItems && !Array.isArray(normalizedData.lineItems)) {
          delete normalizedData.lineItems;
        }

        // Step 2.5: Check for duplicates
        let isDuplicate = false;
        if (normalizedData.taxInvoice) {
          try {
            const q = query(
              collection(db, 'invoices'),
              where('userId', '==', auth.currentUser?.uid),
              where('taxInvoice', '==', normalizedData.taxInvoice)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              isDuplicate = true;
            }
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.LIST, 'invoices');
          }
        }

        // Step 3: Save to Firestore as Draft
        let invoiceRef;
        try {
          invoiceRef = await addDoc(collection(db, 'invoices'), {
            ...normalizedData,
            status: 'draft',
            userId: auth.currentUser?.uid,
            createdAt: serverTimestamp(),
            originalFileName: file.name,
            isDuplicate
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'invoices');
        }

        if (!invoiceRef) {
          throw new Error("Unable to save draft invoice to collection.");
        }

        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          progress: 100, 
          status: 'ready', 
          extractedData: invoiceRef.id,
          isDuplicate: isDuplicate
        } : f));
      } else {
        // For non-PDFs (fallback)
        setTimeout(() => {
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 100, status: 'ready' } : f));
        }, 1000);
      }
    } catch (err) {
      console.error('Processing error:', err);
      let errorMsg = 'Extraction failed';
      if (err instanceof Error) {
        errorMsg = err.message;
        // Check if stringified JSON from Firestore Error
        if (err.message.startsWith('{') && err.message.endsWith('}')) {
          try {
            const parsed = JSON.parse(err.message);
            errorMsg = parsed.error || errorMsg;
          } catch {
            // Keep original
          }
        }
      }
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: errorMsg
      } : f));
    }
  }, [useAI]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Process each file
    newFiles.forEach(f => processFile(f));
  }, [processFile]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // @ts-expect-error - Dropzone typing mismatch in this environment
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.png', '.jpg']
    }
  });

  const allReady = files.length > 0 && files.every(f => f.status === 'ready');

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice Extraction</h1>
            <p className="text-zinc-500 text-sm mt-1">Upload multiple PDFs or images to extract structured data.</p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
            <button 
              onClick={() => setUseAI(false)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                !useAI ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              Standard (Regex)
            </button>
            <button 
              onClick={() => setUseAI(true)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                useAI ? "bg-white text-brand-accent shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <BrainCircuit className="w-3 h-3" />
              Advanced (AI)
            </button>
          </div>
        </div>
      </div>

      <div 
        {...getRootProps()} 
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer group",
          isDragActive ? "border-brand-accent bg-brand-accent/5 ring-4 ring-brand-accent/10" : "border-zinc-200 hover:border-brand-accent hover:bg-zinc-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8 text-zinc-400 group-hover:text-brand-accent transition-colors" />
        </div>
        <p className="text-lg font-semibold mb-1 uppercase tracking-wider">Drag & drop invoices</p>
        <p className="text-zinc-500 text-sm">or click to browse from your computer</p>
        <div className="mt-6 flex gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <span className="px-2 py-1 bg-zinc-100 rounded">PDF</span>
          <span className="px-2 py-1 bg-zinc-100 rounded">JPG/PNG</span>
          <span className="px-2 py-1 bg-zinc-100 rounded">Max 10MB</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Processing Queue ({files.length})</h3>
          {files.length > 0 && (
            <button 
              onClick={() => setFiles([])}
              className="text-xs text-red-500 font-bold hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {files.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center bg-zinc-50 rounded-2xl border border-zinc-100"
            >
              <File className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500 text-sm">No files uploaded yet.</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {files.map((f) => (
                <motion.div 
                  layout
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="saas-card p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                    <File className="w-5 h-5 text-zinc-500" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold truncate pr-4">{f.file.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {(f.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-brand-accent transition-all duration-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${f.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 min-w-[100px] justify-end">
                        {f.status === 'uploading' && (
                          <span className="text-[10px] font-bold text-zinc-500 animate-pulse uppercase tracking-wider">Uploading...</span>
                        )}
                        {f.status === 'processing' && (
                          <div className="flex items-center gap-1.5 text-brand-accent">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {useAI ? 'AI Extracting...' : 'Pattern Matching...'}
                            </span>
                          </div>
                        )}
                        {f.status === 'ready' && (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Extracted</span>
                            </div>
                            {f.isDuplicate && (
                              <div className="flex items-center gap-1 text-amber-500 mt-0.5">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span className="text-[8px] font-bold uppercase tracking-wider">Potential Duplicate</span>
                              </div>
                            )}
                          </div>
                        )}
                        {f.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-500" title={f.error}>
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Error</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.status === 'ready' && (
                      <button 
                        onClick={() => navigate(`/invoices/${f.extractedData}/review`)}
                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors"
                        title="Review extraction"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => removeFile(f.id)}
                      className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-zinc-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className="pt-6">
            <button 
              disabled={!allReady}
              onClick={() => navigate('/invoices')}
              className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold tracking-widest uppercase hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-zinc-200 disabled:opacity-50 group"
            >
              <CheckCircle2 className="w-5 h-5" />
              Complete Batch
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            {!allReady && (
              <p className="text-center text-[10px] text-zinc-400 mt-3 font-bold uppercase tracking-widest">
                Waiting for extraction to complete...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
