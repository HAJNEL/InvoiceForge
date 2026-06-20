import { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { GoogleMapsAutocomplete } from '../../../components/GoogleMapsAutocomplete';
import { TripStop } from '../../../types';

interface CustomStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  stop: TripStop | null;
  onSave: (data: { location: string; type: string; startTime: string; endTime: string }) => void;
}

export function CustomStopModal({ isOpen, onClose, stop, onSave }: CustomStopModalProps) {
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Refuel');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (stop) {
      setLocation(stop.location || '');
      setType(stop.type || 'Refuel');
      setStartTime(stop.startTime || '');
      setEndTime(stop.endTime || '');
    } else {
      setLocation('');
      setType('Refuel');
      setStartTime('');
      setEndTime('');
    }
  }, [stop, isOpen]);

  const getStopDurationString = (start: string, end: string) => {
    if (!start || !end) return '';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diff) || diff < 0) return '0 mins';
    const totalMinutes = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins} mins`;
    if (mins === 0) return `${hrs} hours`;
    return `${hrs}h ${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-zinc-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary">
              {stop ? 'Edit Custom Stop' : 'Add Custom Stop'}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">Specify waypoint parameters</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-4 text-xs text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">Stop Location Name</label>
            <GoogleMapsAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Search location (fuel stop, address, etc.)..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">Stop Category / Type</label>
            <select aria-label="Stop Category / Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900 cursor-pointer"
            >
              <option value="Refuel">Refuel</option>
              <option value="Sleep">Sleep</option>
              <option value="Rest">Rest</option>
              <option value="Pickup">Pickup</option>
              <option value="Delivery">Delivery</option>
              <option value="Service">Service</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">Start Date & Time</label>
              <input aria-label="Start Date and Time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">End Date & Time</label>
              <input aria-label="End Date and Time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
              />
            </div>
          </div>

          {startTime && endTime && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5 self-start">
              <Clock className="w-3.5 h-3.5 text-emerald-650" />
              Calculated Duration: {getStopDurationString(startTime, endTime)}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-250 rounded-xl text-zinc-700 font-bold transition-all cursor-pointer text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!location.trim()}
            onClick={() => {
              onSave({
                location,
                type,
                startTime,
                endTime
              });
              onClose();
            }}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl font-black transition-all cursor-pointer text-xs disabled:opacity-50"
          >
            Save Stop
          </button>
        </div>
      </div>
    </div>
  );
}
