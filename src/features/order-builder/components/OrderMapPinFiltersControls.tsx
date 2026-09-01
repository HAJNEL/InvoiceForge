import { Search } from 'lucide-react';

export type OrderMapStatusFilter = 'All' | 'Active' | 'Complete' | 'LocationIssues';

// Order Builder's equivalent of Trip's inline "Map Pin Filters" bar - one shared
// set of controls that filters both the overview map's pins and the Orders tab
// table (see OrderBuilderList.tsx's filteredSortedOrders), reused verbatim in
// both the standard bar and the fullscreen map's top bar.
export function OrderMapPinFiltersControls({
  search, setSearch,
  selectedArea, setSelectedArea,
  orderStatusFilter, setOrderStatusFilter,
  areasList
}: {
  search: string; setSearch: (v: string) => void;
  selectedArea: string; setSelectedArea: (v: string) => void;
  orderStatusFilter: OrderMapStatusFilter; setOrderStatusFilter: (v: OrderMapStatusFilter) => void;
  areasList: string[];
}) {
  const hasActiveFilters = Boolean(search || selectedArea !== 'all' || orderStatusFilter !== 'All');

  return (
    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
      <div className="relative w-full md:w-60">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          title="Search orders"
          placeholder="Search school, order no., area, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
        />
      </div>

      <select
        title="Filter by area"
        value={selectedArea}
        onChange={(e) => setSelectedArea(e.target.value)}
        className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
      >
        <option value="all">All Areas</option>
        {areasList.map(area => (
          <option key={area} value={area}>{area}</option>
        ))}
      </select>

      <select
        title="Filter by status"
        value={orderStatusFilter}
        onChange={(e) => setOrderStatusFilter(e.target.value as OrderMapStatusFilter)}
        className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
      >
        <option value="All">All Statuses</option>
        <option value="Active">Active</option>
        <option value="Complete">Complete</option>
        <option value="LocationIssues">Location Issues</option>
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          title="Reset map pin filters"
          onClick={() => {
            setSearch('');
            setSelectedArea('all');
            setOrderStatusFilter('All');
          }}
          className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 tracking-wider hover:underline shrink-0"
        >
          Reset
        </button>
      )}
    </div>
  );
}
