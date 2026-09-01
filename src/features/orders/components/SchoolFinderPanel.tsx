import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Check } from 'lucide-react';
import { buildSchoolPinSearchAddress, extractAdminAreas, haversineDistanceKm } from '../../../lib/geocoding';

export interface SchoolFinderResult {
  placeId: string;
  name: string;
  address: string;
  area: string;
  position: { lat: number; lng: number };
  distanceKm: number | null;
}

interface Props {
  schoolName: string;
  // When set (the order's Address field), this overrides the school-name search
  // below - the pin is resolved from this address instead of the school name.
  address?: string;
  warehousePosition: { lat: number; lng: number } | null;
  selectedPosition?: { lat: number; lng: number };
  onSelect: (result: SchoolFinderResult) => void;
}

// Predictions from AutocompleteService carry no coordinates, so each one is
// resolved to a position/address via a placeId geocode - the same two-step
// lookup getTopPlaceMatch (SelfInvoiceModal.tsx) uses for a single best match,
// generalized here to every candidate so they can be listed and compared.
function geocodeByPlaceId(geocoder: google.maps.Geocoder, placeId: string): Promise<google.maps.GeocoderResult | null> {
  return new Promise((resolve) => {
    geocoder.geocode({ placeId }, (results, status) => {
      resolve(status === 'OK' && results && results[0] ? results[0] : null);
    });
  });
}

// Lists every Google Maps place matching the typed school name, closest to the
// warehouse first, so an ambiguous/duplicate school name (several towns sharing
// one school name) can be disambiguated by hand instead of trusting whichever
// result a single geocode happens to resolve to.
export function SchoolFinderPanel({ schoolName, address, warehousePosition, selectedPosition, onSelect }: Props) {
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const [results, setResults] = useState<SchoolFinderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!placesLib || !geocodingLib) return;

    const query = buildSchoolPinSearchAddress(schoolName, address);
    if (!query) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const autocompleteService = new placesLib.AutocompleteService();
        const geocoder = new geocodingLib.Geocoder();

        const request: google.maps.places.AutocompletionRequest = {
          input: query,
          componentRestrictions: { country: 'za' }
        };
        if (warehousePosition) {
          request.location = new google.maps.LatLng(warehousePosition.lat, warehousePosition.lng);
          request.radius = 75000; // 75km, same bias radius as the Auto Distance button
        }

        const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
          autocompleteService.getPlacePredictions(request, (preds, status) => {
            resolve(status === 'OK' && preds ? preds : []);
          });
        });

        if (seq !== requestSeq.current) return; // superseded by a newer search

        const geocoded = await Promise.all(predictions.map(p => geocodeByPlaceId(geocoder, p.place_id)));

        if (seq !== requestSeq.current) return;

        const mapped: SchoolFinderResult[] = predictions
          .map((p, i) => {
            const geo = geocoded[i];
            if (!geo) return null;
            const position = { lat: geo.geometry.location.lat(), lng: geo.geometry.location.lng() };
            const adminAreas = extractAdminAreas(geo.address_components);
            return {
              placeId: p.place_id,
              name: p.structured_formatting?.main_text || p.description,
              address: geo.formatted_address,
              area: adminAreas[0] || geo.formatted_address,
              position,
              distanceKm: warehousePosition ? haversineDistanceKm(warehousePosition, position) : null
            };
          })
          .filter((r): r is SchoolFinderResult => r !== null)
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

        setResults(mapped);
        if (mapped.length === 0) setError('No matching places found.');
      } catch (err) {
        if (seq !== requestSeq.current) return;
        console.error('[SchoolFinder] Place lookup failed:', err);
        setError('Search failed. Try again.');
        setResults([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [placesLib, geocodingLib, schoolName, address, warehousePosition?.lat, warehousePosition?.lng]);

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-zinc-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Searching Google Maps…
        </div>
      ) : error ? (
        <div className="px-3 py-3 text-[11px] text-zinc-400">{error}</div>
      ) : (
        <div className="max-h-44 overflow-y-auto divide-y divide-zinc-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/70">
                <th className="px-2.5 py-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Place</th>
                <th className="px-2.5 py-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-wider">Area</th>
                <th className="px-2.5 py-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-wider text-right">Distance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {results.map((r) => {
                const isSelected = !!selectedPosition && selectedPosition.lat === r.position.lat && selectedPosition.lng === r.position.lng;
                return (
                  <tr
                    key={r.placeId}
                    onClick={() => onSelect(r)}
                    title={r.address}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-brand-accent/10' : 'hover:bg-zinc-50'}`}
                  >
                    <td className="px-2.5 py-2 text-[11px] font-semibold text-zinc-800">
                      <div className="flex items-center gap-1.5">
                        {isSelected ? (
                          <Check className="w-3 h-3 text-brand-accent shrink-0" />
                        ) : (
                          <MapPin className="w-3 h-3 text-zinc-300 shrink-0" />
                        )}
                        <span className="truncate max-w-[160px]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-[11px] text-zinc-500">
                      <span className="truncate block max-w-[140px]">{r.area}</span>
                    </td>
                    <td className="px-2.5 py-2 text-[11px] text-zinc-600 text-right font-mono">
                      {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
