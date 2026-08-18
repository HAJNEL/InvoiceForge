import { ReactNode } from 'react';
import { X, LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function PhaseDrawer({
  open, onClose, title, subtitle, icon: Icon, children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[200] bg-zinc-950/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed top-0 right-0 z-[200] h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <header className="px-5 py-4 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className="w-5 h-5 text-brand-accent shrink-0" />
            <div className="min-w-0">
              <h3 className="font-black text-xs uppercase tracking-wider text-brand-primary truncate">{title}</h3>
              {subtitle && <p className="text-[10px] text-zinc-400 font-mono uppercase mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button title="Close" onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>
      </aside>
    </>
  );
}
