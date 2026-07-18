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

interface BulkImportMobileProps {
  files: UploadFile[];
  useAI: boolean;
  setUseAI: (v: boolean) => void;
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
  removeFile: (id: string) => void;
  retryFile: (id: string) => void;
  setFiles: (updater: (prev: UploadFile[]) => UploadFile[]) => void;
  navigateToReview: (invoiceId: string | undefined) => void;
  navigateToList: () => void;
  allReady: boolean;
}

export function BulkImportMobile({
  files,
  useAI,
  setUseAI,
  getRootProps,
  getInputProps,
  isDragActive,
  removeFile,
  retryFile,
  setFiles,
  navigateToReview,
  navigateToList,
  allReady
}: BulkImportMobileProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invoice Extraction</h1>
          <p className="text-zinc-500 text-xs mt-1">Upload PDFs or images to extract structured data.</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
          <button
            onClick={() => setUseAI(true)}
            title="Use advanced AI extraction"
            className={cn(
              "flex-1 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 mobile-tap-target",
              useAI ? "bg-white text-brand-accent shadow-sm" : "text-zinc-500"
            )}
          >
            <BrainCircuit className="w-3 h-3" />
            Advanced (AI)
          </button>
          <button
            onClick={() => setUseAI(false)}
            title="Use standard regex extraction"
            className={cn(
              "flex-1 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mobile-tap-target",
              !useAI ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            )}
          >
            Standard (Regex)
          </button>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[180px] mobile-tap-target",
          isDragActive ? "border-brand-accent bg-brand-accent/5 ring-4 ring-brand-accent/10" : "border-zinc-200"
        )}
      >
        <input {...getInputProps()} aria-label="Upload files" title="Upload invoice files" />
        <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-zinc-400" />
        </div>
        <p className="text-sm font-semibold mb-1 uppercase tracking-wider text-center">Tap to upload invoices</p>
        <p className="text-zinc-500 text-xs text-center">Choose files from your device</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
          <span className="px-2 py-1 bg-zinc-100 rounded">PDF</span>
          <span className="px-2 py-1 bg-zinc-100 rounded">JPG/PNG</span>
          <span className="px-2 py-1 bg-zinc-100 rounded">Max 10MB</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-500">Queue ({files.length})</h3>
          {files.length > 0 && (
            <button
              onClick={() => setFiles(() => [])}
              title="Clear all files"
              className="text-xs text-red-500 font-bold mobile-tap-target"
            >
              Clear all
            </button>
          )}
        </div>

        {files.some(f => (f.status === 'ready' && f.isDuplicate) || (f.status === 'error' && f.isDuplicate)) && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3 shadow-sm">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950">Duplicate Invoice Identified</h4>
              <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                An invoice with this number was already imported and was not re-inserted. Tap the eye icon to view the existing invoice.
              </p>
            </div>
          </div>
        )}

        {files.some(f => f.status === 'ready' && f.missingSchoolName) && (
          <div className="p-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl flex items-start gap-3 shadow-sm">
            <div className="p-2 bg-orange-100 rounded-xl text-orange-600 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-orange-950">School Name Not Found</h4>
              <p className="text-[10px] text-orange-700 mt-1 leading-relaxed">
                One or more invoices were extracted without a school name. Tap the retry icon to run extraction again, or open Review to enter it manually.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {files.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 text-center bg-zinc-50 rounded-2xl border border-zinc-100"
            >
              <File className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 text-xs">No files uploaded yet.</p>
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
                  className="saas-card p-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                      <File className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{f.file.name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 shrink-0">
                          {(f.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.status === 'ready' && (
                        <button
                          onClick={() => navigateToReview(f.extractedData)}
                          title={f.isDuplicate ? "View existing invoice" : "Review extraction"}
                          className="p-2 rounded-lg text-zinc-500 mobile-tap-target"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {f.status === 'ready' && f.missingSchoolName && (
                        <button
                          onClick={() => retryFile(f.id)}
                          title="Retry extraction to find the school name"
                          className="p-2 rounded-lg text-orange-600 mobile-tap-target"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(f.id)}
                        title="Remove file"
                        className="p-2 rounded-lg text-zinc-400 mobile-tap-target"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-brand-accent transition-all duration-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.status === 'uploading' && (
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Uploading...</span>
                      )}
                      {f.status === 'processing' && (
                        <div className="flex items-center gap-1.5 text-brand-accent">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {f.processingStep || (useAI ? 'AI Extracting...' : 'Pattern Matching...')}
                          </span>
                        </div>
                      )}
                      {f.status === 'ready' && (
                        f.isDuplicate ? (
                          <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Duplicate</span>
                          </div>
                        ) : f.missingSchoolName ? (
                          <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                            <AlertCircle className="w-3 h-3 text-orange-500" />
                            <span className="text-[9px] font-black uppercase tracking-wider">No School Name</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Extracted</span>
                          </div>
                        )
                      )}
                      {f.status === 'error' && (
                        f.isDuplicate || f.error?.includes('Duplicate') ? (
                          <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Duplicate</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600" title={f.error}>
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Error</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className="pt-2">
            <button
              disabled={!allReady}
              onClick={navigateToList}
              title="Complete batch"
              className="w-full bg-brand-primary text-white py-3.5 rounded-xl font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-zinc-200 disabled:opacity-50 mobile-tap-target"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete Batch
              <ArrowRight className="w-4 h-4" />
            </button>
            {!allReady && (
              <p className="text-center text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">
                Waiting for extraction to complete...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
