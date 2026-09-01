import { MapPinOff, Package, CheckCircle2 } from 'lucide-react';
import { StatCard } from '../../dashboard/components/StatCard';

export function OrdersKpiRow({
  locationIssueCount, activeCount, completeCount,
  onLocationIssuesClick, onActiveClick, onCompleteClick
}: {
  locationIssueCount: number;
  activeCount: number;
  completeCount: number;
  onLocationIssuesClick: () => void;
  onActiveClick: () => void;
  onCompleteClick: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <StatCard
        title="Location Issues"
        value={String(locationIssueCount)}
        icon={MapPinOff}
        color="bg-red-50 text-red-600"
        subtitle="Click to view all"
        onClick={onLocationIssuesClick}
      />
      <StatCard
        title="Active Orders"
        value={String(activeCount)}
        icon={Package}
        color="bg-amber-50 text-amber-600"
        subtitle="Click to view all"
        onClick={onActiveClick}
      />
      <StatCard
        title="Complete Orders"
        value={String(completeCount)}
        icon={CheckCircle2}
        color="bg-emerald-50 text-emerald-600"
        subtitle="Click to view all"
        onClick={onCompleteClick}
      />
    </div>
  );
}
