import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { GoogleMapsAutocomplete } from '../../../components/GoogleMapsAutocomplete';
import { TripStop } from '../../../types';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

interface CustomStopModalMobileProps {
  isOpen: boolean;
  onClose: () => void;
  stop: TripStop | null;
  onSave: (data: { location: string; type: string; startTime: string; endTime: string }) => void;
}

export function CustomStopModalMobile({ isOpen, onClose, stop, onSave }: CustomStopModalMobileProps) {
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
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={stop ? 'Edit Custom Stop' : 'Add Custom Stop'}
      subtitle="Specify waypoint parameters"
      fullHeight={false}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-zinc-200 text-zinc-650 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save Stop"
            disabled={!location.trim()}
            onClick={() => {
              onSave({ location, type, startTime, endTime });
              onClose();
            }}
            className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 mobile-tap-target"
          >
            Save Stop
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
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
          <select
            title="Stop Category / Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900"
          >
            <option value="Refuel">Refuel</option>
            <option value="Sleep">Sleep</option>
            <option value="Rest">Rest</option>
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
            <option value="Service">Service</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">Start Date & Time</label>
            <input
              title="Start Date and Time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">End Date & Time</label>
            <input
              title="End Date and Time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
            />
          </div>
        </div>

        {startTime && endTime && (
          <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-650" />
            Calculated Duration: {getStopDurationString(startTime, endTime)}
          </div>
        )}
      </div>
    </MobileSheet>
  );
}
