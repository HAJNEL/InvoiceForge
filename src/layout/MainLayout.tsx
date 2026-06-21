import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  LogOut, 
  Bell,
  Search,
  Menu,
  X,
  Truck,
  Calendar,
  Boxes,
  Package
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { NRLogo } from '../components/Logo';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSettings } from '../features/settings/hooks/useSettings';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trips', href: '/trips', icon: Calendar },
  { name: 'Stock', href: '/stock', icon: Boxes },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Trucks', href: '/trucks', icon: Truck },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const isInvoicePage = location.pathname.startsWith('/invoices');

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? '280px' : '80px' }}
        className="relative bg-brand-primary text-white flex flex-col z-50 shrink-0"
      >
        <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {settings?.sidebarLogoBase64 ? (
              <img 
                src={settings.sidebarLogoBase64} 
                alt="Brand Logo" 
                className="w-10 h-10 rounded-xl object-contain bg-zinc-900 p-0.5 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <NRLogo className="w-8 h-8 shrink-0" variant="light" />
            )}
            {isSidebarOpen && (
              <span className="font-bold text-lg tracking-tight truncate">InvoiceForge</span>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {isSidebarOpen && (
                <span className="font-medium text-sm">{item.name}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
        
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-brand-accent rounded-full flex items-center justify-center border-2 border-zinc-50 text-white"
        >
          {isSidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center max-w-xl w-full">
            {!isInvoicePage && (
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Search invoices, clients..." 
                  className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button title='ok' className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-zinc-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-medium text-xs">
                {auth.currentUser?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-zinc-700 hidden sm:block">
                {auth.currentUser?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary variant="page" key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
