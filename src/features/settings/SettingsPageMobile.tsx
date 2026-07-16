import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  MapPin, Save, Loader2, Warehouse, Navigation, Image as ImageIcon, Upload, Trash2,
  Check, AlertCircle, Bell, Send, Link2, Eye, EyeOff, PlugZap, Info, Copy, ChevronDown, CalendarCheck
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { sendNotification, TEST_NOTIFICATION } from '../../lib/notifications';
import { testZohoConnection } from '../../lib/zoho';
import { Settings, ZohoCredentials } from '../../types';
import { NRLogo } from '../../components/Logo';
import { TeamMembersSection } from './components/TeamMembersSection';
import { CalendarSyncCard } from './components/CalendarSyncCard';
import { cn } from '../../lib/utils';

// Pushover user keys are typically 30 alphanumeric characters. Used for a soft
// (non-blocking) format warning — Pushover's API remains the source of truth.
const PUSHOVER_KEY_PATTERN = /^[a-zA-Z0-9]{30}$/;

// Scope required when generating the refresh token in the Zoho API Console's
// Self Client "Generate Code" step - must match what POST /api/zoho/create-invoice
// and /api/zoho/test-connection (server.ts) actually call: contacts + invoices
// CRUD, plus settings.READ for the organization lookup in Test Connection.
const ZOHO_REQUIRED_SCOPE = 'ZohoBooks.invoices.CREATE,ZohoBooks.invoices.READ,ZohoBooks.contacts.CREATE,ZohoBooks.contacts.READ,ZohoBooks.settings.READ';

const ZOHO_REGIONS = [
  { value: 'com', label: 'United States (.com)' },
  { value: 'eu', label: 'Europe (.eu)' },
  { value: 'in', label: 'India (.in)' },
  { value: 'com.au', label: 'Australia (.com.au)' },
  { value: 'com.cn', label: 'China (.com.cn)' },
  { value: 'jp', label: 'Japan (.jp)' },
  { value: 'ca', label: 'Canada (.ca)' },
  { value: 'sa', label: 'Saudi Arabia (.sa)' },
];

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

interface SettingsPageMobileProps {
  settings: Settings | null;
  saveSettings: (data: Partial<Settings>) => Promise<boolean>;
  zohoCredentials: ZohoCredentials | null;
  zohoLoading: boolean;
  saveZohoCredentials: (data: Partial<ZohoCredentials>) => Promise<boolean>;
  address: string;
  setAddress: (v: string) => void;
  saveStatus: 'idle' | 'success' | 'error';
  setSaveStatus: (v: 'idle' | 'success' | 'error') => void;
}

/** Collapsible section shell used to reflow the desktop's stacked cards into an accordion. */
function AccordionSection({
  icon: Icon,
  iconWrapClassName,
  iconClassName,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconWrapClassName: string;
  iconClassName: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <button
        type="button"
        title={open ? `Collapse ${title}` : `Expand ${title}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left mobile-tap-target"
      >
        <div className={cn('p-2.5 rounded-2xl shrink-0', iconWrapClassName)}>
          <Icon className={cn('w-5 h-5', iconClassName)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 shrink-0 mt-1 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function SettingsPageMobile({
  settings,
  saveSettings,
  zohoCredentials,
  zohoLoading,
  saveZohoCredentials,
  address,
  setAddress,
  saveStatus,
  setSaveStatus,
}: SettingsPageMobileProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="p-6 text-center text-red-500 text-sm">
        Google Maps API Key is missing. Please add it to secrets.
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-black text-brand-primary tracking-tight uppercase">Settings</h1>
          <p className="text-zinc-500 text-xs">Configure your application preferences.</p>
        </div>

        <AccordionSection
          icon={Warehouse}
          iconWrapClassName="bg-brand-accent/10"
          iconClassName="text-brand-accent"
          title="Warehouse Location"
          description="Starting point for all your delivery trips."
          defaultOpen
        >
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Warehouse Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  title="Warehouse Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter warehouse street address, city, and province"
                  className="w-full pl-11 pr-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50 text-sm"
                />
              </div>
            </div>

            <div className="h-[220px] rounded-2xl border border-zinc-200 overflow-hidden relative bg-zinc-50">
              <GeocodePreview address={address} settings={settings} />
            </div>

            <div className="flex flex-col gap-3 items-stretch">
              {saveStatus === 'success' && (
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-2 justify-center">
                  <Navigation className="w-4 h-4" />
                  Settings saved!
                </span>
              )}

              <SaveButton
                address={address}
                onSave={async (lat, lng) => {
                  setSaveStatus('idle');
                  const success = await saveSettings({
                    warehouseAddress: address,
                    warehouseLat: lat,
                    warehouseLng: lng
                  });
                  setSaveStatus(success ? 'success' : 'error');
                  if (success) {
                    setTimeout(() => setSaveStatus('idle'), 3000);
                  }
                }}
              />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          icon={ImageIcon}
          iconWrapClassName="bg-brand-primary/10"
          iconClassName="text-brand-primary"
          title="Sidebar Brand Identity"
          description="Logo shown in the sidebar. Reverts to NR Logo if cleared."
        >
          <div className="pt-1">
            <SidebarLogoCustomizer settings={settings} onSave={saveSettings} />
          </div>
        </AccordionSection>

        <AccordionSection
          icon={Bell}
          iconWrapClassName="bg-brand-accent/10"
          iconClassName="text-brand-accent"
          title="Push Notifications"
          description="Add your Pushover key for push notifications."
        >
          <div className="pt-1">
            <PushoverKeyCard settings={settings} onSave={saveSettings} />
          </div>
        </AccordionSection>

        <AccordionSection
          icon={Link2}
          iconWrapClassName="bg-brand-primary/10"
          iconClassName="text-brand-primary"
          title="Zoho Books Integration"
          description="Push completed Client Invoices to Zoho Books."
        >
          <div className="pt-1">
            {zohoLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
              </div>
            ) : (
              <ZohoIntegrationCard credentials={zohoCredentials} onSave={saveZohoCredentials} />
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          icon={CalendarCheck}
          iconWrapClassName="bg-brand-primary/10"
          iconClassName="text-brand-primary"
          title="Google Calendar Sync"
          description="Add your trips to your own Google Calendar."
        >
          <div className="pt-1">
            <CalendarSyncCard settings={settings} onSave={saveSettings} />
          </div>
        </AccordionSection>

        {/* Team Members Management Section (already reflows itself via useIsMobile) */}
        <TeamMembersSection />
      </div>
    </APIProvider>
  );
}

function PushoverKeyCard({
  settings,
  onSave
}: {
  settings: Settings | null;
  onSave: (data: Partial<Settings>) => Promise<boolean>;
}) {
  const [keyValue, setKeyValue] = useState(settings?.pushoverUserKey || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    setKeyValue(settings?.pushoverUserKey || '');
  }, [settings]);

  const trimmed = keyValue.trim();
  const savedKey = (settings?.pushoverUserKey || '').trim();
  const isDirty = trimmed !== savedKey;
  const looksInvalid = trimmed.length > 0 && !PUSHOVER_KEY_PATTERN.test(trimmed);
  const canTest = trimmed.length > 0 && !isDirty;

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    const success = await onSave({ pushoverUserKey: trimmed });
    setIsSaving(false);
    setStatus(success
      ? { type: 'success', message: 'Notification key saved.' }
      : { type: 'error', message: 'Failed to save your key.' });
    if (success) setTimeout(() => setStatus(null), 3000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setStatus(null);
    const result = await sendNotification({ to: { type: 'self' }, ...TEST_NOTIFICATION });
    setIsTesting(false);
    setStatus(result.success
      ? { type: 'success', message: 'Test notification sent!' }
      : { type: 'error', message: result.error || 'Failed to send test notification.' });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Your Pushover User Key</label>
        <div className="relative">
          <Bell className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            title="Pushover User Key"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="30-character key from pushover.net"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full pl-11 pr-4 py-3 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50 ${
              looksInvalid ? 'border-amber-400 bg-amber-50/20' : 'border-zinc-200'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={!canTest || isTesting}
          title={isDirty && trimmed.length > 0 ? 'Save changes before sending a test' : 'Send a test notification'}
          className="flex w-full items-center justify-center gap-2 bg-zinc-100 text-zinc-700 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Test
        </button>
        {looksInvalid ? (
          <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> This doesn't look like a standard 30-character Pushover key. You can still save it.
          </p>
        ) : (
          <p className="text-xs text-zinc-400">
            {isDirty && trimmed.length > 0
              ? 'Save your key before sending a test notification.'
              : 'Find your user key on the pushover.net dashboard. Save, then send a test to verify.'}
          </p>
        )}
      </div>

      {status && (
        <div className={`flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border ${
          status.type === 'success'
            ? 'text-emerald-600 bg-emerald-50/50 border-emerald-100'
            : 'text-red-500 bg-red-50/50 border-red-100'
        }`}>
          {status.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{status.message}</span>
        </div>
      )}

      <button
        type="button"
        title="Save Key"
        onClick={handleSave}
        disabled={isSaving || !isDirty}
        className="flex w-full items-center justify-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Key
      </button>
    </div>
  );
}

function ZohoIntegrationCard({
  credentials,
  onSave
}: {
  credentials: ZohoCredentials | null;
  onSave: (data: Partial<ZohoCredentials>) => Promise<boolean>;
}) {
  const [clientId, setClientId] = useState(credentials?.clientId || '');
  const [clientSecret, setClientSecret] = useState(credentials?.clientSecret || '');
  const [refreshToken, setRefreshToken] = useState(credentials?.refreshToken || '');
  const [organizationId, setOrganizationId] = useState(credentials?.organizationId || '');
  const [region, setRegion] = useState(credentials?.region || 'com');
  const [showSecret, setShowSecret] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [showScopeInfo, setShowScopeInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCopyScope = async () => {
    try {
      await navigator.clipboard.writeText(ZOHO_REQUIRED_SCOPE);
      toast.success('Scope copied to clipboard');
    } catch (err) {
      console.error('Clipboard write failed:', err);
      toast.error('Could not copy to clipboard');
    }
  };

  React.useEffect(() => {
    setClientId(credentials?.clientId || '');
    setClientSecret(credentials?.clientSecret || '');
    setRefreshToken(credentials?.refreshToken || '');
    setOrganizationId(credentials?.organizationId || '');
    setRegion(credentials?.region || 'com');
  }, [credentials]);

  const draft = {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: refreshToken.trim(),
    organizationId: organizationId.trim(),
    region: region.trim() || 'com',
  };
  const isDirty =
    draft.clientId !== (credentials?.clientId || '') ||
    draft.clientSecret !== (credentials?.clientSecret || '') ||
    draft.refreshToken !== (credentials?.refreshToken || '') ||
    draft.organizationId !== (credentials?.organizationId || '') ||
    draft.region !== (credentials?.region || 'com');
  const isComplete = !!(draft.clientId && draft.clientSecret && draft.refreshToken && draft.organizationId);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    const success = await onSave(draft);
    setIsSaving(false);
    setStatus(success
      ? { type: 'success', message: 'Zoho Books connection saved.' }
      : { type: 'error', message: 'Failed to save your Zoho Books connection.' });
    if (success) setTimeout(() => setStatus(null), 3000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setStatus(null);
    const result = await testZohoConnection(draft);
    setIsTesting(false);
    if (result.success) {
      setStatus({ type: 'success', message: result.organizationName ? `Connected to "${result.organizationName}".` : 'Connection successful.' });
      // Record the successful check on the saved doc without requiring the
      // user to hit Save again, but only when the tested values are already
      // what's persisted - otherwise Save is what actually stores them.
      if (!isDirty) await onSave({ connectedAt: new Date().toISOString() });
    } else {
      setStatus({ type: 'error', message: result.error });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client ID</label>
          <input
            type="text"
            title="Zoho Self Client ID from api-console.zoho.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Organization ID</label>
          <input
            type="text"
            title="Zoho Books Organization ID from Settings -> Organization Profile"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="e.g. 925627406"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client Secret</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              title="Zoho Self Client Secret from api-console.zoho.com"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Client Secret"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full pl-4 pr-11 py-3 border border-zinc-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
            />
            <button
              type="button"
              title={showSecret ? 'Hide Client Secret' : 'Show Client Secret'}
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 mobile-tap-target"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Refresh Token</label>
            <button
              type="button"
              title="Show the OAuth scope required to generate this token"
              onClick={() => setShowScopeInfo(v => !v)}
              className={`text-zinc-400 transition-colors mobile-tap-target ${showScopeInfo ? 'text-brand-primary' : ''}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <input
              type={showRefreshToken ? 'text' : 'password'}
              title="Zoho refresh token generated during the Self Client setup"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Refresh Token"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full pl-4 pr-11 py-3 border border-zinc-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
            />
            <button
              type="button"
              title={showRefreshToken ? 'Hide Refresh Token' : 'Show Refresh Token'}
              onClick={() => setShowRefreshToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 mobile-tap-target"
            >
              {showRefreshToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {showScopeInfo && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
              <code className="flex-1 text-[10px] font-mono text-zinc-600 break-all">{ZOHO_REQUIRED_SCOPE}</code>
              <button
                type="button"
                title="Copy scope to clipboard"
                onClick={handleCopyScope}
                className="shrink-0 p-1.5 text-zinc-400 rounded-lg border border-transparent mobile-tap-target"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {showScopeInfo && (
            <p className="text-[10px] text-zinc-400">
              Paste this into the "Scope" field on the Generate Code tab in the Zoho API Console when creating your Self Client's refresh token.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data Center</label>
          <select
            title="Zoho data center your organization is hosted on"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
          >
            {ZOHO_REGIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {credentials?.connectedAt && !status && (
        <p className="text-xs text-zinc-400">Last verified {new Date(credentials.connectedAt).toLocaleString()}.</p>
      )}

      {status && (
        <div className={`flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border ${
          status.type === 'success'
            ? 'text-emerald-600 bg-emerald-50/50 border-emerald-100'
            : 'text-red-500 bg-red-50/50 border-red-100'
        }`}>
          {status.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={!isComplete || isTesting}
          title={isComplete ? 'Test this Zoho Books connection' : 'Fill in all fields to test the connection'}
          className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-700 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          Test Connection
        </button>
        <button
          type="button"
          title="Save Connection"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center justify-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Connection
        </button>
      </div>
    </div>
  );
}

function SaveButton({ address, onSave }: { address: string, onSave: (lat: number, lng: number) => Promise<void> }) {
  const geocodingLib = useMapsLibrary('geocoding');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleSave = async () => {
    if (!geocodingLib || !address) return;
    setIsGeocoding(true);
    try {
      const { results } = await new geocodingLib.Geocoder().geocode({ address });
      if (results && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        await onSave(lat(), lng());
      } else {
        toast.error('Location Not Found', { description: 'Could not find coordinates for this address. Try a more specific address.' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Geocoding Failed', { description: 'An error occurred while looking up the address coordinates.' });
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <button
      type="button"
      title="Save Warehouse Settings"
      onClick={handleSave}
      disabled={isGeocoding || !address}
      className="flex items-center justify-center gap-2 w-full bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg disabled:opacity-50 mobile-tap-target"
    >
      {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Warehouse Settings
    </button>
  );
}

function GeocodePreview({ address, settings }: { address: string, settings: Settings | null }) {
  const geocodingLib = useMapsLibrary('geocoding');
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);

  React.useEffect(() => {
    if (settings?.warehouseLat && settings?.warehouseLng) {
      setPosition({ lat: settings.warehouseLat, lng: settings.warehouseLng });
    }
  }, [settings]);

  React.useEffect(() => {
    if (!geocodingLib || !address || address.length < 5) return;

    const timeoutId = setTimeout(async () => {
      try {
        const { results } = await new geocodingLib.Geocoder().geocode({ address });
        if (results && results[0]) {
          setPosition({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        }
      } catch {
        // Silent fail for preview
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [geocodingLib, address]);

  return (
    <Map
      center={position || { lat: -25.7479, lng: 28.2293 }}
      zoom={position ? 15 : 10}
      mapId="SETTINGS_PREVIEW_MOBILE"
      style={{ width: '100%', height: '100%' }}
      gestureHandling="none"
      disableDefaultUI
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
    >
      {position && (
        <AdvancedMarker position={position}>
          <Pin background="#f59e0b" glyphColor="#fff" borderColor="#b45309" scale={1.2}>
            <Warehouse className="w-4 h-4 text-white" />
          </Pin>
        </AdvancedMarker>
      )}
    </Map>
  );
}

function SidebarLogoCustomizer({
  settings,
  onSave
}: {
  settings: Settings | null;
  onSave: (data: Partial<Settings>) => Promise<boolean>
}) {
  const [preview, setPreview] = useState<string | null>(settings?.sidebarLogoBase64 || null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (settings?.sidebarLogoBase64) {
      setPreview(settings.sidebarLogoBase64);
    } else {
      setPreview(null);
    }
  }, [settings]);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(false);

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 250 * 1024) { // 250 KB
      setErrorMsg('Image size must be smaller than 250 KB to ensure proper storage.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        setPreview(base64);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading the image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const success = await onSave({
        sidebarLogoBase64: preview || ""
      });
      if (success) {
        setSuccessMsg(true);
        setTimeout(() => setSuccessMsg(false), 3000);
      } else {
        setErrorMsg('Failed to save to Firestore settings database.');
      }
    } catch {
      setErrorMsg('Unknown saving error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setErrorMsg(null);
    setSuccessMsg(false);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all h-[160px] text-center ${
            dragActive
              ? 'border-brand-primary bg-brand-primary/5 scale-[0.99]'
              : 'border-zinc-200 bg-zinc-50/20'
          }`}
        >
          <input aria-label="Upload logo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="p-3 bg-zinc-100 rounded-full text-zinc-500 mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-700">Tap to upload your brand logo</p>
          <p className="text-xs text-zinc-400 mt-1">Max 250KB</p>
        </div>

        {/* Live Preview Area */}
        <div className="border border-zinc-200 rounded-2xl p-6 h-[160px] flex flex-col items-center justify-center bg-zinc-50/30 relative">
          <span className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Live Preview</span>

          {preview ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  src={preview}
                  alt="Custom Sidebar Logo"
                  className="w-14 h-14 rounded-xl object-contain bg-zinc-900 p-2 shadow-md border border-zinc-200"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full transition-all shadow-sm mobile-tap-target"
                  title="Remove Logo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs font-semibold text-zinc-600">Custom Brand Image Loaded</span>
            </div>
          ) : (
            <div className="text-center text-zinc-400 flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-zinc-900 rounded-xl flex items-center justify-center p-2 shadow-md">
                <NRLogo className="w-8 h-8" variant="light" />
              </div>
              <span className="text-xs font-medium text-zinc-400">Rendering Default NR Logo</span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-red-500 text-xs font-medium bg-red-50/50 px-4 py-2.5 rounded-xl border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium bg-emerald-50/50 px-4 py-2.5 rounded-xl border border-emerald-100">
          <Check className="w-4 h-4 shrink-0" />
          <span>Brand settings updated successfully! Your sidebar has been synchronized.</span>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1">
        <button
          type="button"
          title="Apply Brand Logo"
          onClick={handleSave}
          disabled={isSaving || preview === settings?.sidebarLogoBase64}
          className="flex items-center justify-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Apply Brand Logo
        </button>
        {preview !== settings?.sidebarLogoBase64 && (
          <button
            type="button"
            title="Cancel"
            onClick={handleClear}
            className="px-5 py-2.5 text-zinc-500 bg-zinc-100 rounded-xl font-semibold text-sm transition-all mobile-tap-target"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
