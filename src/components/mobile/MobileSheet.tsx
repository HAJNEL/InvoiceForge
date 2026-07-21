import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerLeft?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  fullHeight?: boolean;
}

/**
 * Full-screen slide-up sheet — the mobile replacement for every centered
 * desktop dialog. Keeps a `.fixed.inset-0` + scrim wrapper so App.tsx's
 * viewport-reset MutationObserver (keyed on that class pattern) still fires.
 */
export function MobileSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerLeft,
  footer,
  children,
  fullHeight = true,
}: MobileSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div
        className={`relative z-10 bg-white w-full flex flex-col shadow-2xl animate-slide-in-up ${
          fullHeight ? 'h-[100dvh]' : 'max-h-[92dvh] rounded-t-3xl'
        }`}
      >
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {headerLeft}
            <div className="min-w-0">
              <h3 className="text-base font-black text-brand-primary uppercase tracking-tight truncate">{title}</h3>
              {subtitle && (
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200 shrink-0 mobile-tap-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <div
            className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
