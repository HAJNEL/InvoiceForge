import { useState } from 'react';
import { Users, Truck, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useProducts } from '../products/hooks/useProducts';
import { useKpiTemplates } from './hooks/useKpiTemplates';
import { EmployeesTab } from './components/EmployeesTab';
import { TrucksTab } from './components/TrucksTab';
import { KpiPageMobile } from './KpiPageMobile';

export type KpiTab = 'employees' | 'trucks';

export function KpiPage() {
  const [activeTab, setActiveTab] = useState<KpiTab>('employees');
  const { products, loading: productsLoading } = useProducts();
  const { templates, loading: templatesLoading, saveTemplate } = useKpiTemplates();
  const isMobile = useIsMobile();

  const loading = productsLoading || templatesLoading;

  if (isMobile) {
    return (
      <KpiPageMobile
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        loading={loading}
        products={products}
        employeeProductIds={templates?.employeeProductIds ?? []}
        truckProductIds={templates?.truckProductIds ?? []}
        saveTemplate={saveTemplate}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-primary tracking-tight uppercase">KPI</h1>
          <p className="text-zinc-500 text-sm">Track production rates and truck capacities per product.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-2xl p-1">
          <TabButton
            active={activeTab === 'employees'}
            onClick={() => setActiveTab('employees')}
            icon={Users}
            label="Employees"
          />
          <TabButton
            active={activeTab === 'trucks'}
            onClick={() => setActiveTab('trucks')}
            icon={Truck}
            label="Trucks"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        </div>
      ) : activeTab === 'employees' ? (
        <EmployeesTab
          products={products}
          templateProductIds={templates?.employeeProductIds ?? []}
          onSaveTemplate={saveTemplate}
        />
      ) : (
        <TrucksTab
          products={products}
          templateProductIds={templates?.truckProductIds ?? []}
          onSaveTemplate={saveTemplate}
        />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Show the ${label} tab`}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer',
        active ? 'bg-white text-brand-primary shadow-sm border border-zinc-200' : 'text-zinc-400 hover:text-zinc-600'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
