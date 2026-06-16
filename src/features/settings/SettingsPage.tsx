import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Save, Loader2, Warehouse, Navigation, Image as ImageIcon, Upload, Trash2, Check, AlertCircle } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useSettings } from './hooks/useSettings';
import { Settings } from '../../types';
import { NRLogo } from '../../components/Logo';
import { TeamMembersSection } from './components/TeamMembersSection';

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

        {/* Team Members Management Section */}
        <TeamMembersSection />
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
          <input
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
