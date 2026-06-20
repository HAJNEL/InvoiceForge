import { cn } from '../../../lib/utils';
import { motion } from 'motion/react';

// Capacity bar helper
export function CapacityProgressBar({ current, max, height = "h-2", showLabel = false }: { current: number, max: number, height?: string, showLabel?: boolean }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOver = percentage > 100;

  const getBarColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 90) return "bg-orange-500";
    if (pct > 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-1 w-full">
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", height)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn("h-full transition-all duration-300", getBarColor(percentage))}
        />
      </div>
      {(showLabel || isOver) && (
        <div className="flex justify-between items-center text-[9px] mt-1 font-bold">
          <span className={cn(
            "uppercase tracking-tighter",
            isOver ? "text-red-500 animate-pulse" : "text-zinc-400"
          )}>
            {isOver ? "⚠️ OVER VEHICLE CAPACITY" : `${Math.round(percentage)}% Space Utilized`}
          </span>
          {isOver && (
            <span className="font-mono text-red-500 font-extrabold pr-0.5">
              + R {(current - max).toLocaleString()} OVER
            </span>
          )}
        </div>
      )}
    </div>
  );
}
