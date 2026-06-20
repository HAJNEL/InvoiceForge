import { cn } from '../../../lib/utils';
import { STATUS_DISPLAY_MAP } from '../constants';

export function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
    complete: "bg-indigo-50 text-indigo-600 border-indigo-100",
    'partially_complete': "bg-amber-50 text-amber-600 border-amber-100",
    assembled: "bg-blue-50 text-blue-600 border-blue-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  const label = STATUS_DISPLAY_MAP[norm] || status;

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
      styles[norm] || styles.draft
    )}>
      {label}
    </span>
  );
}
