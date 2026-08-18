import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface PhaseColumnProps {
  index: number;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: 'indigo' | 'amber' | 'sky' | 'emerald';
  countLabel: string;
  children: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  headerAction?: ReactNode;
}

const ACCENTS = {
  indigo: {
    badge: 'bg-brand-accent/10 text-brand-accent border-brand-accent/20',
    icon: 'bg-brand-accent/10 text-brand-accent',
    bar: 'bg-brand-accent'
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-500'
  },
  sky: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: 'bg-sky-50 text-sky-600',
    bar: 'bg-sky-500'
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500'
  }
} as const;

export function PhaseColumn({
  index, title, subtitle, icon: Icon, accent, countLabel, children,
  isEmpty, emptyTitle, emptyDescription, emptyAction, headerAction
}: PhaseColumnProps) {
  const colors = ACCENTS[accent];

  return (
    <div className="flex flex-col bg-white border border-zinc-200 rounded-3xl shadow-sm min-w-[320px] shrink-0 max-h-[calc(100vh-360px)] min-h-[420px]">
      <div className="p-4 border-b border-zinc-100 shrink-0 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs', colors.icon)}>
            {index}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wider text-brand-primary flex items-center gap-1.5 truncate">
              <Icon className="w-4 h-4 shrink-0" />
              {title}
            </h3>
            <p className="text-xs text-zinc-400 font-mono uppercase truncate">{subtitle}</p>
          </div>
        </div>
        {headerAction}
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-black font-mono uppercase tracking-wide', colors.badge)}>
          {countLabel}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isEmpty ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-4 space-y-3">
            <Icon className="w-10 h-10 text-zinc-200 stroke-[1.5]" />
            <div>
              <p className="text-sm font-black text-zinc-600 uppercase tracking-wide">{emptyTitle}</p>
              {emptyDescription && (
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-[220px] mx-auto">{emptyDescription}</p>
              )}
            </div>
            {emptyAction}
          </div>
        ) : children}
      </div>
    </div>
  );
}

export function PhaseProgressBar({ pct, accent }: { pct: number; accent: 'indigo' | 'amber' | 'sky' | 'emerald' }) {
  const colors = ACCENTS[accent];
  return (
    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
