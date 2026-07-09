import { X, Phone, PhoneCall } from 'lucide-react';

export function SchoolPhoneDialog({ schoolName, phone, onClose }: {
  schoolName: string;
  phone: string;
  onClose: () => void;
}) {
  const dialHref = `tel:${phone.replace(/\s+/g, '')}`;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 shrink-0">
              <Phone className="w-4 h-4 text-brand-primary" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight truncate">{schoolName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center gap-5">
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
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-sm"
          >
            <PhoneCall className="w-4 h-4" />
            Call
          </a>
        </div>
      </div>
    </div>
  );
}
