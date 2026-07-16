import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPin, FileText, CalendarDays, MoreHorizontal, Bell, CalendarCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { NRLogo } from '../components/Logo';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSettings } from '../features/settings/hooks/useSettings';
import { useTrips } from '../features/trips/hooks/useTrips';
import { useCalendarSync } from '../features/team-dashboard/useCalendarSync';
import { CalendarSyncModal } from '../features/team-dashboard/CalendarSyncModal';
import { MobileMoreSheet } from './MobileMoreSheet';

const tabs = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trips', href: '/trips', icon: MapPin },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Planner', href: '/daily-planner', icon: CalendarDays },
];

export function MobileLayout() {
  const [isMoreOpen, setMoreOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const { settings } = useSettings();
  const { trips } = useTrips();
  const calSync = useCalendarSync(trips, Boolean(settings?.calendarSyncEnabled), 'settings');
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden">
      <header className="h-14 bg-white border-b border-zinc-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {settings?.sidebarLogoBase64 ? (
            <img
              src={settings.sidebarLogoBase64}
              alt="Brand Logo"
              className="w-8 h-8 rounded-lg object-contain bg-zinc-900 p-0.5 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <NRLogo className="w-7 h-7 shrink-0" variant="dark" />
          )}
          <span className="font-bold text-sm tracking-tight truncate">InvoiceForge</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {calSync.enabled && (
            <button
              type="button"
              title={calSync.unsyncedCount > 0 ? `${calSync.unsyncedCount} trip(s) to sync to Google Calendar` : 'Sync trips to Google Calendar'}
              onClick={() => setIsSyncOpen(true)}
              className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors relative mobile-tap-target"
            >
              <CalendarCheck className="w-5 h-5" />
              {calSync.unsyncedCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {calSync.unsyncedCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            title="Notifications"
            className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors relative mobile-tap-target"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-medium text-xs shrink-0">
            {auth.currentUser?.email?.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <ErrorBoundary variant="page" key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 flex items-stretch shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.name}
            to={tab.href}
            title={tab.name}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-16 transition-colors',
                isActive ? 'text-brand-accent' : 'text-zinc-400'
              )
            }
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold">{tab.name}</span>
          </NavLink>
        ))}
        <button
          type="button"
          title="More"
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-16 text-zinc-400 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-bold">More</span>
        </button>
      </nav>

      <MobileMoreSheet isOpen={isMoreOpen} onClose={() => setMoreOpen(false)} />

      <CalendarSyncModal
        open={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        unsyncedTrips={calSync.unsyncedTrips}
        syncedTrips={calSync.syncedTrips}
        syncedMap={calSync.syncedMap}
        syncing={calSync.syncing}
        onSync={calSync.syncTrips}
      />
    </div>
  );
}
