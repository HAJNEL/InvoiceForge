import React from 'react';
import { cn } from '../../../lib/utils';

export function StatCard({ title, value, icon: Icon, color, subtitle, onClick, topRightActions, filterRow }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  onClick?: () => void;
  // Small icon-button controls overlaid top-right (e.g. metric toggles). Rendered in
  // its own stacking context so clicks on them don't also trigger the card's onClick.
  topRightActions?: React.ReactNode;
  // Optional control (e.g. a period select) rendered below the subtitle. Consumers
  // are responsible for stopping click propagation so it doesn't also fire onClick.
  filterRow?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "saas-card p-6 group transition-all relative overflow-hidden",
        onClick
          ? "cursor-pointer hover:border-brand-primary hover:shadow-xl hover:shadow-zinc-100 active:scale-[0.98]"
          : "hover:translate-y-[-2px] hover:shadow-xl hover:shadow-zinc-100"
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110", color)}>
          <Icon className="w-5 h-5" />
        </div>
        {topRightActions || <div className="h-1 w-8 bg-zinc-100 rounded-full" />}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{title}</p>
        <p className="text-3xl font-black mt-1 tracking-tight tabular-nums text-zinc-900">{value}</p>
        {subtitle && (
          <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-tight">{subtitle}</p>
        )}
        {filterRow && <div className="mt-3">{filterRow}</div>}
      </div>
    </div>
  );
}
