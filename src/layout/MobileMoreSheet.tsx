import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Package,
  Truck,
  BarChart3,
  Settings,
  Repeat,
  ListTodo,
  Gauge,
  Users,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { MobileSheet } from '../components/mobile/MobileSheet';

interface MoreItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const moreItems: MoreItem[] = [
  { name: 'Todo Lists', href: '/todos', icon: ListTodo },
  { name: 'Stock', href: '/stock', icon: Boxes },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Trucks', href: '/trucks', icon: Truck },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'KPI', href: '/kpi', icon: Gauge },
  { name: 'Recurring', href: '/recurring', icon: Repeat },
  { name: 'Team Dashboard', href: '/team-dashboard', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function MobileMoreSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  const handleLogout = async () => {
    onClose();
    await auth.signOut();
    navigate('/login');
  };

  return (
    <MobileSheet isOpen={isOpen} onClose={onClose} title="More" fullHeight={false}>
      <div className="space-y-1">
        {moreItems.map((item) => (
          <button
            key={item.name}
            type="button"
            title={item.name}
            onClick={() => go(item.href)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors mobile-tap-target"
          >
            <item.icon className="w-5 h-5 shrink-0 text-zinc-400" />
            <span className="flex-1 text-left font-bold text-sm">{item.name}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
          </button>
        ))}

        <div className="h-px bg-zinc-100 my-2" />

        <button
          type="button"
          title="Logout"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors mobile-tap-target"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left font-bold text-sm">Logout</span>
        </button>
      </div>
    </MobileSheet>
  );
}
