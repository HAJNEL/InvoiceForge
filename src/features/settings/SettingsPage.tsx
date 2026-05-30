import { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, Warehouse, Navigation } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useSettings } from './hooks/useSettings';
import { Settings } from '../../types';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export function SettingsPage() {
  const { settings, loading, saveSettings } = useSettings();
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
      </div>
    </APIProvider>
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
        alert('Could not find location for this address.');
      }
    } catch (err) {
      console.error(err);
      alert('Geocoding failed.');
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
