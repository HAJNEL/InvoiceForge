import { useRef } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

// Mobile counterpart to ReportPreviewDialog — full-screen sheet with a back button
// (mobile's expected way back out of a full-screen view) and a Print button up top;
// printing only happens if the user taps Print, never automatically.
export function ReportPreviewDialogMobile({ title, html, onClose }: {
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
    <MobileSheet
      isOpen
      onClose={onClose}
      title={title}
      headerLeft={
        <button
          type="button"
          title="Back"
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-500 transition-all border border-transparent hover:border-zinc-200 shrink-0 mobile-tap-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      }
      headerRight={
        <button
          type="button"
          title="Print this report"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs shadow-sm mobile-tap-target"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
      }
    >
      <div className="w-full h-full bg-zinc-200 rounded-xl overflow-hidden">
        <iframe ref={iframeRef} srcDoc={html} title={title} className="w-full h-full border-0" />
      </div>
    </MobileSheet>
  );
}
