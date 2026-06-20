import { cn } from '../../../lib/utils';
import { motion } from 'motion/react';

export function CapacityProgressBar({ current, max, height = "h-2", showLabel = false }: { current: number, max: number, height?: string, showLabel?: boolean }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOver = percentage > 100;

  // Professional color calculation
  const getBarColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 90) return "bg-orange-500";
    if (pct > 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", height)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn("h-full transition-all duration-500", getBarColor(percentage))}
        />
      </div>
      {(showLabel || isOver) && (
        <div className="flex justify-between items-center">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-tighter",
            isOver ? "text-red-500" : "text-zinc-400"
          )}>
            {isOver ? "⚠️ OVER LIMIT" : `${Math.round(percentage)}% CAPACITY`}
          </span>
          {isOver && (
            <span className="text-[9px] font-mono text-red-500 font-bold">
              + R {(current - max).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
