import { PackagePlus } from 'lucide-react';

// Landing screen placeholder - full builds list lands in a later Order Builder issue.
export function OrderBuilderList() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
      <PackagePlus className="w-10 h-10" />
      <h1 className="text-lg font-bold text-zinc-600">Order Builder</h1>
      <p className="text-sm">Coming soon.</p>
    </div>
  );
}
