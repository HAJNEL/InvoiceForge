import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MapPin, Save, Loader2, Warehouse, Navigation, Image as ImageIcon, Upload, Trash2, Check, AlertCircle, Bell, Send, Link2, Eye, EyeOff, PlugZap, Info, Copy } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useSettings } from './hooks/useSettings';
import { useZohoCredentials } from './hooks/useZohoCredentials';
import { sendNotification, TEST_NOTIFICATION } from '../../lib/notifications';
import { testZohoConnection } from '../../lib/zoho';
import { Settings, ZohoCredentials } from '../../types';
import { NRLogo } from '../../components/Logo';
import { TeamMembersSection } from './components/TeamMembersSection';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

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

export function SettingsPage() {
  const { settings, loading, saveSettings } = useSettings();
  const { credentials: zohoCredentials, loading: zohoLoading, saveCredentials: saveZohoCredentials } = useZohoCredentials();
  const [address, setAddress] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (settings?.warehouseAddress) {
      setAddress(settings.warehouseAddress);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="p-8 text-center text-red-500">
        Google Maps API Key is missing. Please add it to secrets.
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-black text-brand-primary tracking-tight uppercase">Settings</h1>
          <p className="text-zinc-500 text-sm">Configure your application preferences.</p>
        </div>

        {/* Warehouse Location Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-accent/10 rounded-2xl">
                <Warehouse className="w-6 h-6 text-brand-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Warehouse Location</h3>
                <p className="text-sm text-zinc-500 mb-6">Set the starting point for all your delivery trips.</p>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Warehouse Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter warehouse street address, city, and province"
                        className="w-full pl-11 pr-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-zinc-50/50"
                      />
                    </div>
                  </div>

                  <div className="h-[300px] rounded-2xl border border-zinc-200 overflow-hidden relative bg-zinc-50">
                    <GeocodePreview address={address} settings={settings} />
                  </div>

                  <div className="flex justify-end gap-4 items-center">
                    {saveStatus === 'success' && (
                      <span className="text-emerald-500 text-sm font-bold flex items-center gap-2">
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
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Logo Configuration Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-primary/10 rounded-2xl animate-fade-in flex-shrink-0">
                <ImageIcon className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Sidebar Brand Identity</h3>
                <p className="text-sm text-zinc-500 mb-6">Customize the logo displayed in the upper sidebar of the application. Reverts to default NR Logo if cleared.</p>
                
                <SidebarLogoCustomizer settings={settings} onSave={saveSettings} />
              </div>
            </div>
          </div>
        </div>

        {/* Push Notifications Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-accent/10 rounded-2xl flex-shrink-0">
                <Bell className="w-6 h-6 text-brand-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Push Notifications</h3>
                <p className="text-sm text-zinc-500 mb-6">Add your personal Pushover user key to receive push notifications on your own devices.</p>

                <PushoverKeyCard settings={settings} onSave={saveSettings} />
              </div>
            </div>
          </div>
        </div>

        {/* Zoho Books Integration Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-primary/10 rounded-2xl flex-shrink-0">
                <Link2 className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Zoho Books Integration</h3>
                <p className="text-sm text-zinc-500 mb-6">Connect your own Zoho Books account so completed Client Invoices are pushed there automatically.</p>

                {zohoLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                  </div>
                ) : (
                  <ZohoIntegrationCard credentials={zohoCredentials} onSave={saveZohoCredentials} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Management Section */}
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

  useEffect(() => {
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
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Bell className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
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
            className="flex shrink-0 items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Test
          </button>
        </div>
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Key
        </button>
      </div>
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

  useEffect(() => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
              className={`text-zinc-400 hover:text-brand-primary transition-colors ${showScopeInfo ? 'text-brand-primary' : ''}`}
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
                className="shrink-0 p-1.5 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
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

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={!isComplete || isTesting}
          title={isComplete ? 'Test this Zoho Books connection' : 'Fill in all fields to test the connection'}
          className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          Test Connection
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
      onClick={handleSave}
      disabled={isGeocoding || !address}
      className="flex items-center gap-2 bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg disabled:opacity-50"
    >
      {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Warehouse Settings
    </button>
  );
}

function GeocodePreview({ address, settings }: { address: string, settings: Settings | null }) {
  const geocodingLib = useMapsLibrary('geocoding');
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if (settings?.warehouseLat && settings?.warehouseLng) {
      setPosition({ lat: settings.warehouseLat, lng: settings.warehouseLng });
    }
  }, [settings]);

  useEffect(() => {
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
      mapId="SETTINGS_PREVIEW"
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

  useEffect(() => {
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all h-[200px] text-center ${
            dragActive
              ? 'border-brand-primary bg-brand-primary/5 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 bg-zinc-50/20'
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

          <div className="p-3 bg-zinc-100 rounded-full text-zinc-500 mb-3 group-hover:scale-105 transition-transform duration-200">
            <Upload className="w-5 h-5" />
          </div>
          <p className="font-bold text-sm text-zinc-700">Drag & drop your brand logo</p>
          <p className="text-xs text-zinc-400 mt-1">or click to browse your files (Max 250KB)</p>
        </div>

        {/* Live Preview Area */}
        <div className="border border-zinc-200 rounded-2xl p-6 h-[200px] flex flex-col items-center justify-center bg-zinc-50/30 relative">
          <span className="absolute top-4 left-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Live Preview</span>
          
          {preview ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <img
                  src={preview}
                  alt="Custom Sidebar Logo"
                  className="w-16 h-16 rounded-xl object-contain bg-zinc-900 p-2 shadow-md border border-zinc-200"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 p-1.5 rounded-full transition-all shadow-sm"
                  title="Remove Logo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs font-semibold text-zinc-600">Custom Brand Image Loaded</span>
            </div>
          ) : (
            <div className="text-center text-zinc-400 flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-zinc-900 rounded-xl flex items-center justify-center p-2 shadow-md">
                <NRLogo className="w-10 h-10" variant="light" />
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

      <div className="flex justify-end gap-3 pt-2">
        {preview !== settings?.sidebarLogoBase64 && (
          <button
            onClick={handleClear}
            className="px-5 py-2.5 text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl font-semibold text-sm transition-all"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || preview === settings?.sidebarLogoBase64}
          className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Apply Brand Logo
        </button>
      </div>
    </div>
  );
}
