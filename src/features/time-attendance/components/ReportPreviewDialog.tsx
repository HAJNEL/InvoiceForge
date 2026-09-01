import { useRef } from 'react';
import { X, Printer, Eye } from 'lucide-react';

// Shows a report (built by buildPayrollReportHtml / buildAttendanceRegisterReportHtml) in
// an iframe so the user can look it over before committing to paper — printing only
// happens if they click Print here, unlike the Export flow which prints immediately.
export function ReportPreviewDialog({ title, html, onClose }: {
  title: string;
  html: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    win?.focus();
    win?.print();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-6xl h-[88vh] relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200 shrink-0">
              <Eye className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              title="Print this report"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button type="button" onClick={onClose} title="Close preview" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-200 overflow-hidden">
          <iframe ref={iframeRef} srcDoc={html} title={title} className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}
