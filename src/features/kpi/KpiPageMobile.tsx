import { Users, Truck, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Product } from '../products/hooks/useProducts';
import { KpiTemplateKind } from './hooks/useKpiTemplates';
import { EmployeesTab } from './components/EmployeesTab';
import { TrucksTab } from './components/TrucksTab';
import type { KpiTab } from './KpiPage';

interface Props {
  activeTab: KpiTab;
  setActiveTab: (tab: KpiTab) => void;
  loading: boolean;
  products: Product[];
  employeeProductIds: string[];
  truckProductIds: string[];
  saveTemplate: (kind: KpiTemplateKind, productIds: string[]) => Promise<boolean>;
}

export function KpiPageMobile({
  activeTab, setActiveTab, loading, products,
  employeeProductIds, truckProductIds, saveTemplate
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-brand-primary tracking-tight uppercase">KPI</h1>
        <p className="text-zinc-500 text-xs">Production rates and truck capacities per product.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-2xl p-1">
        {([
          { tab: 'employees' as const, icon: Users, label: 'Employees' },
          { tab: 'trucks' as const, icon: Truck, label: 'Trucks' },
        ]).map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            title={`Show the ${label} tab`}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all mobile-tap-target',
              activeTab === tab
                ? 'bg-white text-brand-primary shadow-sm border border-zinc-200'
                : 'text-zinc-400'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-7 h-7 text-brand-accent animate-spin" />
        </div>
      ) : activeTab === 'employees' ? (
        <EmployeesTab
          products={products}
          templateProductIds={employeeProductIds}
          onSaveTemplate={saveTemplate}
          isMobile
        />
      ) : (
        <TrucksTab
          products={products}
          templateProductIds={truckProductIds}
          onSaveTemplate={saveTemplate}
          isMobile
        />
      )}
    </div>
  );
}
