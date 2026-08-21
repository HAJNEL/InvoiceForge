import { useParams } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';

// Build screen placeholder - the map/grouping/persistence UI lands in later Order
// Builder issues. `id` is unused for now but wired so the route signature (new
// build vs. re-opening an existing one) doesn't need to change later.
export function OrderBuilderScreen() {
  const { id } = useParams<{ id: string }>();
  void id;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
      <PackagePlus className="w-10 h-10" />
      <h1 className="text-lg font-bold text-zinc-600">Order Builder</h1>
      <p className="text-sm">Coming soon.</p>
    </div>
  );
}
