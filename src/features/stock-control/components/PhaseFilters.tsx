import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface StockControlFilterState {
  search: string;
  category: string;
  area: string;
  schoolType: string;
  orderStatus: string;
  assemblyStatus: 'all' | 'not-started' | 'in-progress' | 'ready';
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: StockControlFilterState = {
  search: '',
  category: '',
  area: '',
  schoolType: '',
  orderStatus: '',
  assemblyStatus: 'all',
  dateFrom: '',
  dateTo: ''
};

function Select({ label, title, value, onChange, options }: {
  label: string;
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all cursor-pointer"
    >
      <option value="">{label}: All</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export function PhaseFilters({
  filters,
  onChange,
  categoryOptions,
  areaOptions,
  schoolTypeOptions,
  orderStatusOptions
}: {
  filters: StockControlFilterState;
  onChange: (next: StockControlFilterState) => void;
  categoryOptions: string[];
  areaOptions: string[];
  schoolTypeOptions: string[];
  orderStatusOptions: string[];
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeCount = [
    filters.category, filters.area, filters.schoolType, filters.orderStatus,
    filters.assemblyStatus !== 'all' ? filters.assemblyStatus : '',
    filters.dateFrom, filters.dateTo
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            title="Search products, SKUs, schools, order numbers…"
            placeholder="Search products, SKUs, schools, order numbers…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-9 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all font-medium"
          />
          {filters.search && (
            <button
              type="button"
              title="Clear search"
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          title="Toggle advanced filters"
          onClick={() => setAdvancedOpen(v => !v)}
          className={cn(
            'px-3.5 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0',
            advancedOpen || activeCount > 0
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px]">{activeCount}</span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            title="Clear all filters"
            onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })}
            className="px-3 py-2 text-[10px] font-black uppercase text-zinc-500 hover:text-red-600 transition-all cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {advancedOpen && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100">
          <Select label="Category" title="Filter by product category" value={filters.category} onChange={(v) => onChange({ ...filters, category: v })} options={categoryOptions} />
          <Select label="Area" title="Filter by delivery area" value={filters.area} onChange={(v) => onChange({ ...filters, area: v })} options={areaOptions} />
          <Select label="School Type" title="Filter by school type" value={filters.schoolType} onChange={(v) => onChange({ ...filters, schoolType: v })} options={schoolTypeOptions} />
          <Select label="Order Status" title="Filter by order status" value={filters.orderStatus} onChange={(v) => onChange({ ...filters, orderStatus: v })} options={orderStatusOptions} />
          <select
            aria-label="Assembly Status"
            title="Filter by assembly status"
            value={filters.assemblyStatus}
            onChange={(e) => onChange({ ...filters, assemblyStatus: e.target.value as StockControlFilterState['assemblyStatus'] })}
            className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all cursor-pointer"
          >
            <option value="all">Assembly: All</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="ready">Ready</option>
          </select>
          <input
            type="date"
            title="Due date from"
            aria-label="Due date from"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
          <input
            type="date"
            title="Due date to"
            aria-label="Due date to"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>
      )}
    </div>
  );
}
