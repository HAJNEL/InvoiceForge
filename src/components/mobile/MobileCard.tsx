import { ReactNode, useState } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileCardProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

function MobileCardRoot({ onClick, children, className }: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-4 space-y-2',
        onClick && 'cursor-pointer active:bg-zinc-50 transition-colors',
        className
      )}
    >
      {children}
    </div>
  );
}

function Primary({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between gap-3', className)}>{children}</div>;
}

function Secondary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400 font-medium', className)}>
      {children}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export const MobileCard = Object.assign(MobileCardRoot, { Primary, Secondary, Actions });

export interface MobileCardMenuAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

/** Kebab-menu popover — the touch replacement for hover-revealed row actions. */
export function MobileCardActionsMenu({ actions }: { actions: MobileCardMenuAction[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Actions"
        onClick={() => setOpen((o) => !o)}
        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors mobile-tap-target"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-zinc-200 shadow-xl py-1 min-w-[170px] overflow-hidden">
            {actions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                title={action.label}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left hover:bg-zinc-50 transition-colors mobile-tap-target',
                  action.destructive ? 'text-red-600' : 'text-zinc-700'
                )}
              >
                {action.icon && <action.icon className="w-4 h-4 shrink-0" />}
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
