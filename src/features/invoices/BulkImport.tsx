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
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { extractTextFromPdf } from '../../services/pdfService';
import { parseInvoiceWithRegex } from '../../services/ruleBasedParser';
import { extractDetailedInvoiceLlamaIndex } from '../../services/llamaIndexService';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { DetailedInvoice } from '../../services/xaiService';
import { useProducts } from '../products/hooks/useProducts';
import { useSettings } from '../settings/hooks/useSettings';
import { normalizeSchoolName, resolveInvoicePin, upsertCachedPin } from '../../lib/geocoding';
import { useIsMobile } from '../../hooks/useIsMobile';
import { BulkImportMobile } from './BulkImportMobile';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  processingStep?: string;
  extractedData?: string;
  error?: string;
  isDuplicate?: boolean;
  missingSchoolName?: boolean;
}

export function BulkImport() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [useAI, setUseAI] = useState(true);
  const navigate = useNavigate();
  const { syncLineItemsAsProducts } = useProducts();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  // Biases geocoding toward the warehouse's region so a same-named school in
  // another province doesn't outrank the real, nearby one (see geocoding.ts).
  const warehouseBias = settings?.warehouseLat !== undefined && settings?.warehouseLng !== undefined
    ? { lat: settings.warehouseLat, lng: settings.warehouseLng }
    : undefined;

  const processFile = useCallback(async (uploadFile: { id: string, file: File }) => {
    const { id, file } = uploadFile;
    
    // Simulate initial upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 50) {
        clearInterval(interval);
        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          progress: 50, 
          status: 'processing',
          processingStep: useAI ? 'AI Extracting...' : 'Pattern Matching...'
        } : f));
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
      }
    }, 100);

    try {
      const isPdf = file.type === 'application/pdf';
      
      if (isPdf || useAI) {
        let detailedData: Partial<DetailedInvoice> = {};
        let isDuplicate = false;
        let existingDocId = "";
        let text = "";

        if (isPdf) {
          try {
            text = await extractTextFromPdf(file);
            console.log(`[DEBUG] Extracted text for precheck / regex:`, text ? text.substring(0, 500) + '...' : '(empty)');
          } catch (textErr) {
            console.error('[DEBUG] Failed to extract text from PDF:', textErr);
          }
        }
        
        if (useAI) {
          let preTaxInvoice = "";
          let preRegexData: Partial<DetailedInvoice> = {};

          if (text) {
            preRegexData = parseInvoiceWithRegex(text);
            preTaxInvoice = String(preRegexData.taxInvoice || '').trim();
          }

          if (preTaxInvoice) {
            setFiles(prev => prev.map(f => f.id === id ? { 
              ...f, 
              processingStep: 'Prechecking Duplicates...' 
            } : f));

            try {
              const q = query(
                collection(db, 'invoices'),
                where('userId', '==', auth.currentUser?.uid),
                where('taxInvoice', '==', preTaxInvoice)
              );
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                isDuplicate = true;
                existingDocId = querySnapshot.docs[0].id;
                detailedData = preRegexData;
                console.log(`[DEBUG] Regex duplicate precheck matched: ${preTaxInvoice}. Skipping LlamaIndex extraction to save credits!`);
              }
            } catch (dbErr) {
              console.error('[DEBUG] Duplicate precheck query failed:', dbErr);
            }
          }

          if (!isDuplicate) {
            // Use LlamaIndex (via LlamaExtract) for Advanced AI extraction
            detailedData = await extractDetailedInvoiceLlamaIndex(file);
            console.log(`[DEBUG] LlamaIndex AI Extraction Result:`, detailedData);
          }
        } else {
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
        if (normalizedData.schoolName) normalizedData.schoolName = normalizeSchoolName(String(normalizedData.schoolName)).substring(0, 190);
        if (normalizedData.streetAddress) normalizedData.streetAddress = String(normalizedData.streetAddress).substring(0, 490);
        if (normalizedData.suburb) normalizedData.suburb = String(normalizedData.suburb).substring(0, 190);

        // Ensure optional arrays/lists match structure
        if (normalizedData.lineItems && !Array.isArray(normalizedData.lineItems)) {
          delete normalizedData.lineItems;
        }

        // The school name drives the map pin lookup - flag it so the user is
        // told extraction missed it and can retry instead of silently
        // importing an invoice that will never resolve a delivery pin.
        const missingSchoolName = !String(normalizedData.schoolName || '').trim();

        // Step 2.5: Check for duplicates
        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          progress: 80, 
          processingStep: 'Verifying Duplicates...' 
        } : f));

        if (!isDuplicate && normalizedData.taxInvoice) {
          try {
            const q = query(
              collection(db, 'invoices'),
              where('userId', '==', auth.currentUser?.uid),
              where('taxInvoice', '==', normalizedData.taxInvoice)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              isDuplicate = true;
              existingDocId = querySnapshot.docs[0].id;
            }
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.LIST, 'invoices');
          }
        }

        let finalInvoiceId = "";
        if (isDuplicate) {
          // If a duplicate is found, we do NOT save it to Firestore (do not call addDoc).
          // We set finalInvoiceId to the existing document ID so the user can easily view/review it.
          finalInvoiceId = existingDocId;
        } else {
          // Step 3: Save to Firestore as Draft
          let invoiceRef;
          try {
            invoiceRef = await addDoc(collection(db, 'invoices'), {
              ...normalizedData,
              status: 'draft',
              userId: auth.currentUser?.uid,
              createdAt: serverTimestamp(),
              originalFileName: file.name,
              isDuplicate: false
            });
            if (invoiceRef) {
              finalInvoiceId = invoiceRef.id;
              if (normalizedData.lineItems && normalizedData.lineItems.length > 0) {
                await syncLineItemsAsProducts(normalizedData.lineItems);
              }
            }
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.CREATE, 'invoices');
          }
        }

        if (!finalInvoiceId) {
          throw new Error("Unable to save or resolve existing invoice document.");
        }

        // Auto-geocode and cache coordinates in localStorage to load markers instantly on /trips.
        // Look up the school name on Google Maps first (source of truth for the pin), then
        // fall back to the extracted street address / client name. The resolved address is
        // saved onto the invoice as `deliveryAddress` so the pin and invoice stay in sync.
        try {
          const pinSource = {
            client: normalizedData.schoolName || normalizedData.customerName || 'Unknown Client',
            schoolName: normalizedData.schoolName,
            district: normalizedData.district,
            deliveryAddressLine1: normalizedData.deliveryAddressLine1,
            deliveryAddressLine2: normalizedData.deliveryAddressLine2,
          };

          const geo = await resolveInvoicePin(pinSource, warehouseBias);

          if (geo) {
            // Persist the resolved address onto the invoice (skip for duplicates, which
            // we intentionally never write), then cache the pin.
            if (!isDuplicate) {
              await updateDoc(doc(db, 'invoices', finalInvoiceId), { deliveryAddress: geo.formattedAddress, deliveryAddressManual: false });
            }

            upsertCachedPin({
              id: finalInvoiceId,
              number: normalizedData.taxInvoice || `TEMP-${Date.now()}`,
              client: pinSource.client,
              status: 'draft',
              address: geo.formattedAddress,
              searchAddress: geo.formattedAddress,
              position: geo.position,
              district: normalizedData.district,
              lineItems: normalizedData.lineItems || [],
            });
            console.log(`[DEBUG] Geocoded and stored pin for imported invoice: ${normalizedData.taxInvoice}`);
          }
        } catch (geocodeErr) {
          console.error('Error auto-geocoding newly uploaded invoice:', geocodeErr);
        }

        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          progress: 100,
          status: 'ready',
          extractedData: finalInvoiceId,
          isDuplicate: isDuplicate,
          missingSchoolName: !isDuplicate && missingSchoolName,
          processingStep: isDuplicate ? 'Duplicate (Skipped)' : (missingSchoolName ? 'No School Name Found' : 'Extracted')
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
      let isDupError = false;
      if (err instanceof Error) {
        errorMsg = err.message;
        if (errorMsg.includes('Duplicate')) {
          isDupError = true;
        }
        // Check if stringified JSON from Firestore Error
        if (err.message.startsWith('{') && err.message.endsWith('}')) {
          try {
            const parsed = JSON.parse(err.message);
            errorMsg = parsed.error || errorMsg;
            if (errorMsg.includes('Duplicate')) {
              isDupError = true;
            }
          } catch {
            // Keep original
          }
        }
      }
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: errorMsg,
        isDuplicate: isDupError || f.isDuplicate
      } : f));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAI, settings?.warehouseLat, settings?.warehouseLng]);

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

  const retryFile = (id: string) => {
    const target = files.find(f => f.id === id);
    if (!target) return;
    setFiles(prev => prev.map(f => f.id === id ? {
      ...f,
      progress: 0,
      status: 'uploading',
      missingSchoolName: false,
      error: undefined
    } : f));
    processFile({ id, file: target.file });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.png', '.jpg']
    }
  });

  const allReady = files.length > 0 && files.every(f => f.status === 'ready');

  if (isMobile) {
    return (
      <BulkImportMobile
        files={files}
        useAI={useAI}
        setUseAI={setUseAI}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        removeFile={removeFile}
        retryFile={retryFile}
        setFiles={setFiles}
        navigateToReview={(invoiceId) => navigate(`/invoices/${invoiceId}/review`)}
        navigateToList={() => navigate('/invoices')}
        allReady={allReady}
      />
    );
  }

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
              onClick={() => setUseAI(true)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                useAI ? "bg-white text-brand-accent shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <BrainCircuit className="w-3 h-3" />
              Advanced (AI)
            </button>
            <button 
              onClick={() => setUseAI(false)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                !useAI ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              Standard (Regex)
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
        <input {...getInputProps()} aria-label="Upload files" />
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

        {files.some(f => (f.status === 'ready' && f.isDuplicate) || (f.status === 'error' && f.isDuplicate)) && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600 shrink-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-950">Duplicate Invoice Identified</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                An invoice with this number has already been imported. To prevent duplicated entries, this upload has been marked as a duplicate and was not re-inserted into the database. You can still inspect and view the existing invoice utilizing the Review icon on the right.
              </p>
            </div>
          </div>
        )}

        {files.some(f => f.status === 'ready' && f.missingSchoolName) && (
          <div className="p-4 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
            <div className="p-2.5 bg-orange-100 rounded-xl text-orange-600 shrink-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-orange-950">School Name Not Found</h4>
              <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                One or more invoices were extracted without a school name, which is needed to place them on the map. Use the retry icon to run extraction again, or open Review to enter it manually.
              </p>
            </div>
          </div>
        )}

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
                              {f.processingStep || (useAI ? 'AI Extracting...' : 'Pattern Matching...')}
                            </span>
                          </div>
                        )}
                        {f.status === 'ready' && (
                          <div className="flex flex-col items-end">
                            {f.isDuplicate ? (
                              <>
                                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                                  <span className="text-[9px] font-black uppercase tracking-wider">Duplicate (Skipped)</span>
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 mt-0.5">Not added again</span>
                              </>
                            ) : f.missingSchoolName ? (
                              <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                <AlertCircle className="w-3 h-3 text-orange-500" />
                                <span className="text-[9px] font-black uppercase tracking-wider">No School Name</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Extracted</span>
                              </div>
                            )}
                          </div>
                        )}
                        {f.status === 'error' && (
                          <div className="flex flex-col items-end">
                            {f.isDuplicate || f.error?.includes('Duplicate') ? (
                              <>
                                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                                  <span className="text-[9px] font-black uppercase tracking-wider">Duplicate (Skipped)</span>
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 mt-0.5">Not added again</span>
                              </>
                            ) : (
                              <div className="flex flex-col items-end text-red-500" title={f.error}>
                                <div className="flex items-center gap-1 text-red-600">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Error</span>
                                </div>
                                <span className="text-[8px] font-semibold text-red-400 mt-0.5 max-w-[150px] text-right truncate">
                                  {f.error || 'Extraction failed'}
                                </span>
                              </div>
                            )}
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
                        title={f.isDuplicate ? "View existing invoice" : "Review extraction"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {f.status === 'ready' && f.missingSchoolName && (
                      <button
                        onClick={() => retryFile(f.id)}
                        className="p-2 hover:bg-orange-50 hover:text-orange-600 rounded-lg text-zinc-500 transition-colors"
                        title="Retry extraction to find the school name"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(f.id)}
                      className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-zinc-400 transition-colors"
                      title="Remove file"
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
