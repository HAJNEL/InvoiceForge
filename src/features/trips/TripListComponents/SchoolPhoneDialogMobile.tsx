import { Phone, PhoneCall } from 'lucide-react';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

export function SchoolPhoneDialogMobile({ schoolName, phone, onClose }: {
  schoolName: string;
  phone: string;
  onClose: () => void;
}) {
  const dialHref = `tel:${phone.replace(/\s+/g, '')}`;

  return (
    <MobileSheet
      isOpen={true}
      onClose={onClose}
      title={schoolName}
      fullHeight={false}
    >
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="p-3 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
          <Phone className="w-6 h-6 text-brand-primary" />
        </div>
        <a
          href={dialHref}
          title={`Call ${phone}`}
          className="text-3xl font-black text-zinc-900 tracking-tight hover:text-brand-primary transition-colors text-center"
        >
          {phone}
        </a>
        <a
          href={dialHref}
          title={`Call ${phone}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-sm mobile-tap-target"
        >
          <PhoneCall className="w-4 h-4" />
          Call
        </a>
      </div>
    </MobileSheet>
  );
}
