import { AlertCircle, CheckCircle2, Clock, FileText, Package, Send } from 'lucide-react';
import { Pin } from '@vis.gl/react-google-maps';
import { STATUS_COLORS } from './statusColors';

export function InvoicePin({
  status,
  number,
  isHighlighted,
  isTripStop,
  stopNumber
}: {
  status: string;
  number: string;
  isHighlighted?: boolean;
  isTripStop?: boolean;
  stopNumber?: number;
}) {
  const getStatusConfig = (statusName: string) => {
    if (isTripStop) {
      return {
        background: '#F59E0B', // Highlight/Selected Amber
        borderColor: '#B45309', // Dark Amber
        icon: (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#B45309] font-black text-[11px] font-mono shadow-sm">
            {stopNumber}
          </div>
        )
      };
    }
    if (isHighlighted) {
      return {
        background: '#EF4444', // Highlight Red
        borderColor: '#991B1B', // Dark Red
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />
      };
    }
    const norm = (statusName || '').toLowerCase();
    const config = STATUS_COLORS[norm] || { bg: '#71717a', border: '#3f3f46' };

    // Choose icon based on status
    let icon = <FileText className="w-3 h-3 text-white" />;
    if (norm === 'complete' || norm === 'completed' || norm === 'delivered' || norm === 'invoiced') {
      icon = <CheckCircle2 className="w-3 h-3 text-white" />;
    } else if (norm === 'on-route' || norm === 'on route' || norm === 'on_route') {
      icon = <Send className="w-3 h-3 text-white" />;
    } else if (norm === 'assembled' || norm === 'assembly') {
      icon = <Package className="w-3 h-3 text-white" />;
    } else if (norm === 'proposed') {
      icon = <Clock className="w-3.5 h-3.5 text-white" />;
    } else if (norm === 'partially_complete' || norm === 'partially complete' || norm === 'loaded') {
      icon = <AlertCircle className="w-3 h-3 text-white" />;
    }

    return {
      background: config.bg,
      borderColor: config.border,
      icon
    };
  };

  const config = getStatusConfig(status);

  return (
    <Pin background={config.background} glyphColor="#fff" borderColor={config.borderColor} scale={(isTripStop || isHighlighted) ? 1.4 : 1.2}>
      <div className="flex flex-col items-center gap-0.5">
        {config.icon}
        <span className="text-[7px] font-black text-white uppercase leading-none">{number.slice(-3)}</span>
      </div>
    </Pin>
  );
}
