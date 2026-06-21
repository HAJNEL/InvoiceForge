import React, { useState, useCallback } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { 
  FileText, 
  Upload, 
  X, 
  AlertCircle, 
  Loader2, 
  Copy, 
  CheckCircle2,
  FileSearch
} from 'lucide-react';
import { extractTextFromPdf } from '../../services/pdfService';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export function PdfExtractorTool() {
  const [extractedText, setExtractedText] = useState<string>('');
  const [extractedDistrict, setExtractedDistrict] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onDrop: DropzoneOptions['onDrop'] = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setExtractedText('');
    setExtractedDistrict(null);

    try {
      const text = await extractTextFromPdf(file);
      setExtractedText(text);
      
      // Extract district using user provided regex: (?<=\s{2})([A-Z]+(?:\s[A-Z]+)*)(?=\s{2}WC\b)
      const districtRegex = /(?<=\s{2,})([A-Z]+(?:\s[A-Z]+)*)(?=\s{2,}WC\b)/i;
      const districtMatch = text.match(districtRegex);
      if (districtMatch && districtMatch[1]) {
        const district = districtMatch[1].trim();
        setExtractedDistrict(district);
        console.log(`[PdfExtractor] District found: "${district}"`);
      } else {
        console.warn(`[PdfExtractor] District not found using regex: ${districtRegex.source}`);
      }

      if (!text.trim()) {
        setError('No text found in this PDF. Note: Scanned PDFs require OCR, which is not supported by this tool.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during extraction.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setExtractedText('');
    setExtractedDistrict(null);
    setFileName(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PDF Text Extractor</h1>
          <p className="text-zinc-500 text-sm mt-1">Extract text from any PDF document directly in your browser.</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent">
          <FileSearch className="w-6 h-6" />
        </div>
      </div>

      {extractedDistrict && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 opacity-60">Extracted District</p>
              <p className="text-xl font-black text-emerald-900 tracking-tight">{extractedDistrict}</p>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 opacity-60">Confidence</p>
             <p className="text-sm font-bold text-emerald-600">HIGH (REGEX MATCH)</p>
          </div>
        </motion.div>
      )}

      {!extractedText && !isProcessing && (
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center transition-all cursor-pointer group bg-white/50 backdrop-blur-sm",
            isDragActive ? "border-brand-accent bg-brand-accent/5 ring-8 ring-brand-accent/5" : "border-zinc-200 hover:border-brand-accent hover:bg-zinc-50/50"
          )}
        >
          <input {...getInputProps()} aria-label="Upload PDF" />
          <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Upload className="w-10 h-10 text-zinc-400 group-hover:text-brand-accent transition-colors" />
          </div>
          <Text className="text-xl font-bold mb-2 uppercase tracking-wider">Drop your PDF here</Text>
          <Text className="text-zinc-500 font-medium">Supports multi-page and large PDF documents</Text>
          
          <div className="mt-10 flex gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            <span className="px-3 py-1.5 bg-zinc-100/80 rounded-full border border-zinc-200">Free & Private</span>
            <span className="px-3 py-1.5 bg-zinc-100/80 rounded-full border border-zinc-200">No Server Upload</span>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="saas-card p-20 flex flex-col items-center justify-center space-y-6 text-center">
          <div className="relative">
             <Loader2 className="w-16 h-16 text-brand-accent animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-6 h-6 text-brand-accent/40" />
             </div>
          </div>
          <div className="space-y-1">
             <p className="text-lg font-bold tracking-tight">Extracting Text...</p>
             <p className="text-zinc-500 text-sm">Reading pages from {fileName} and processing markers.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 text-red-600 animate-in zoom-in-95 duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
             <p className="text-sm font-bold uppercase tracking-wider">Extraction Error</p>
             <p className="text-sm opacity-80">{error}</p>
             <button onClick={reset} className="text-xs font-bold underline mt-2 block">Try another file</button>
          </div>
        </div>
      )}

      {extractedText && !isProcessing && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-zinc-400" />
              <span className="text-sm font-bold truncate max-w-[200px]">{fileName}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Extraction Complete</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-100 rounded-lg text-xs font-bold text-zinc-600 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
              <button
                onClick={reset}
                aria-label="Clear"
                className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-zinc-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="saas-card overflow-hidden bg-white">
            <div className="p-1 bg-zinc-50 border-b border-zinc-100 flex items-center gap-1">
               <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-r border-zinc-200">Extracted Content</div>
               <div className="flex-1"></div>
               <div className="px-3 py-1.5 text-[10px] font-medium italic text-zinc-400">Total Length: {extractedText.length} characters</div>
            </div>
            <textarea
            placeholder='extracted text' 
              readOnly
              value={extractedText}
              className="w-full h-[500px] p-8 text-sm font-mono text-zinc-700 bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
             </div>
             <div>
                <p className="text-xs font-bold uppercase tracking-tight text-zinc-600">Limitations Notice</p>
                <p className="text-xs text-zinc-500 mt-1">This tool extracts encoded text from standard PDFs. Highly complex layouts or scanned images (OCR) are not supported in this browser implementation.</p>
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Text({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
