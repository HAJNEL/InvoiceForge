import { useEffect, useState } from 'react';
import { X, Settings, MapPinOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_LOCATION_ISSUE_DISTANCE_KM } from '../../../lib/geocoding';

export function OrdersLocationSettingsDialog({ isOpen, onClose, maxDistanceKm, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  maxDistanceKm: number;
  onSave: (value: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(maxDistanceKm));
  const [saving, setSaving] = useState(false);

  // Re-sync from the saved value each time the dialog opens, so a cancelled edit
  // doesn't linger in the input the next time it's opened.
  useEffect(() => {
    if (isOpen) setValue(String(maxDistanceKm));
  }, [isOpen, maxDistanceKm]);

  if (!isOpen) return null;

  const parsed = parseFloat(value);
  const isValid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    const ok = await onSave(parsed);
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      toast.error('Failed to save setting');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-5 h-5 text-brand-accent shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">Location Issue Settings</h2>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wide flex items-center gap-1.5">
              <MapPinOff className="w-3.5 h-3.5 text-zinc-400" />
              Max Distance
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              A school is flagged as a location issue when its geocoded location is farther than this from its order's stated area. Default is {DEFAULT_LOCATION_ISSUE_DISTANCE_KM}km.
            </p>
          </div>

          <div className="relative">
            <input
              type="number"
              min={1}
              step="1"
              title="Max distance in kilometers"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full pl-3.5 pr-10 py-2.5 border border-zinc-200 rounded-xl text-sm font-mono text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">km</span>
          </div>
          {!isValid && (
            <p className="text-[11px] font-semibold text-red-600">Enter a distance greater than 0.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save max distance"
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-black text-[11px] uppercase tracking-wider rounded-xl hover:bg-brand-accent/95 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
