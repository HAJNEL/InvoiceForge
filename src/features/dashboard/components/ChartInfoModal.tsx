import { X, Info } from 'lucide-react';

export type ChartInfoKey =
  | 'invoice_totals'
  | 'weekly_totals'
  | 'top_customers'
  | 'delivery_pipeline'
  | 'truck_utilization'
  | 'district_distribution'
  | 'top_products'
  | 'fuel_efficiency'
  | 'utilization_rate'
  | 'load_efficiency'
  | 'shortage_analysis'
  | 'route_profitability';

export const CHART_INFO: Record<ChartInfoKey, { title: string; description: string; example: string }> = {
  invoice_totals: {
    title: 'Financial Performance History',
    description: 'Adds up the total value of every invoice raised in the selected time window, then plots one point per day (or month) so you can see whether revenue is trending up or down.',
    example: 'Example: on "Last 7 Days", if you raised invoices worth R2,000 on Monday and R3,500 on Tuesday, the chart shows a point at R2,000 then a point at R3,500 for those two days.'
  },
  weekly_totals: {
    title: 'Weekly Revenue Breakdown',
    description: 'Splits the selected month into its calendar weeks (Monday–Sunday, labeled by ISO week number) and, for each day, sums the value of invoices linked to trips scheduled that day — the same "Week Total" calculation shown on the Weekly Dispatch Schedule — then plots one bar per week.',
    example: 'Example: if Week 32 has R4,000 billed across trips scheduled that week and Week 33 has R6,500, the chart shows a shorter bar for Week 32 and a taller bar for Week 33.'
  },
  top_customers: {
    title: 'Client Spend Analysis',
    description: 'Groups all invoices by customer and ranks them either by total Rand value billed (VALUE) or by number of invoices raised (VOLUME), then shows the top N customers you choose with the Limit filter.',
    example: 'Example: Customer A has 3 invoices totaling R9,000 and Customer B has 10 invoices totaling R4,000. Sorted by VALUE, A appears first (R9,000); sorted by VOLUME, B appears first (10 invoices).'
  },
  delivery_pipeline: {
    title: 'Operations Delivery Pipeline',
    description: 'Counts how many invoices/deliveries currently sit in each status (e.g. Pending, Dispatched, Delivered), shown either as the number of items (COUNTS) or their combined Rand value (VALUE).',
    example: 'Example: if 5 invoices are "Dispatched" worth R12,000 combined, the COUNTS view shows a bar of 5 for that status, while the VALUE view shows a bar of R12,000.'
  },
  truck_utilization: {
    title: 'Fleet Trip Frequencies',
    description: 'For each truck, stacks the number of completed trips against pending/scheduled trips, so you can compare how busy each truck has been.',
    example: 'Example: Truck A has done 8 completed trips and has 2 scheduled — its bar shows a green segment of 8 stacked on a yellow segment of 2, for a total height of 10.'
  },
  district_distribution: {
    title: 'Geographic Market Footprint',
    description: 'Groups deliveries by the district/area they were delivered to, showing either total revenue earned there (REVENUE) or the number of deliveries made (DELIVERIES).',
    example: 'Example: if District X received 4 deliveries worth R6,000 total, the REVENUE view shows R6,000 for District X while the DELIVERIES view shows 4.'
  },
  top_products: {
    title: 'Best Selling Inventory Analytics',
    description: 'Groups invoice line items by product code and ranks them by units sold (UNITS SOLD) or revenue generated (REVENUE VALUE), showing the top N products you choose.',
    example: 'Example: Product "COKE-330" sold 500 units for R2,500, while "FANTA-330" sold 100 units for R3,000 (higher price per unit). By UNITS SOLD, COKE-330 ranks first; by REVENUE VALUE, FANTA-330 ranks first.'
  },
  fuel_efficiency: {
    title: 'Fleet Fuel Cost & Efficiency',
    description: 'Uses odometer readings and fuel purchases between refuels to calculate, per truck, either the cost per kilometer driven (COST/KM = fuel cost ÷ distance driven) or the distance covered per liter of fuel (KM/LITER = distance driven ÷ liters used).',
    example: 'Example: a truck drives 340km between two refuels and the fuel logged in that period cost R850 and totaled 68 liters. COST/KM = R850 ÷ 340km = R2.50/km. KM/LITER = 340km ÷ 68L = 5.0 km/L.'
  },
  utilization_rate: {
    title: 'Truck Utilization Rate',
    description: 'For each truck, counts how many days out of the last 30 or 90 it was actually used on a trip, expressed as a percentage of the window.',
    example: 'Example: over the LAST 30 DAYS window, a truck that was used on 21 of those days shows 21 / 30 = 70% utilization.'
  },
  load_efficiency: {
    title: 'Truck Load Capacity Efficiency',
    description: 'Compares the quantity actually loaded on each trip against the truck\'s configured max capacity (set on the KPI page), averaged across ALL TRIPS or only COMPLETED ones, to show how fully trucks are being loaded.',
    example: 'Example: a truck with a 10-ton max capacity that averages 8 tons per trip shows 8 / 10 = 80% average capacity used (shown in green since it\'s ≥80%; amber if 50-79%, red if below 50%).'
  },
  shortage_analysis: {
    title: 'Delivery Shortage & Damage Analysis',
    description: 'Looks at deliveries marked as partial or short, then groups the shortfalls either BY REASON (e.g. damaged, rejected, out of stock) or BY PRODUCT to show which products are short most often.',
    example: 'Example: if 6 short deliveries were logged as "Damaged in transit" and 2 as "Customer rejected", the BY REASON view shows a bar of 6 for Damaged and 2 for Rejected.'
  },
  route_profitability: {
    title: 'Client Route Profitability (Revenue/KM)',
    description: 'Divides the total revenue billed to each client by the total delivery distance (km) driven to reach them, to show which routes earn the most (or least) per kilometer driven. Sort WORST VALUE to spot routes that may be underpriced relative to distance.',
    example: 'Example: Client A generates R6,000 in revenue over 300km of deliveries → R20/km. Client B generates R4,000 over 800km → R5/km. Client B ranks worse even though it billed less distance-adjusted revenue.'
  }
};

export function ChartInfoModal({ chartKey, onClose }: {
  chartKey: ChartInfoKey;
  onClose: () => void;
}) {
  const info = CHART_INFO[chartKey];

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-xl border border-sky-200">
              <Info className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">{info.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">How it works</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{info.description}</p>
          </div>
          <div className="space-y-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Example</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{info.example}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
