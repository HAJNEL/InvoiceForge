import { ReactNode } from 'react';
import { X } from 'lucide-react';

export function PhaseModal({
  isOpen, onClose, title, subtitle, maxWidth = 'max-w-md', children, footer
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] text-zinc-900 animate-fade-in font-sans">
      <div className={`bg-white rounded-3xl w-full ${maxWidth} overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="p-5 border-b border-zinc-100 flex justify-between items-start bg-zinc-50/50 shrink-0">
          <div className="min-w-0">
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary">{title}</h3>
            {subtitle && <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 rounded-xl text-zinc-400 transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
