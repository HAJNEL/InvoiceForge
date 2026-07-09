import { useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { sanitizeDistrict } from '../../../lib/geocoding';

const CACHE_KEY = 'school_phone_numbers';
// Phone numbers essentially never change and each lookup costs a Places API
// call, so cache resolved (and "not found") results for a week.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  phone: string | null;
  fetchedAt: number;
}

function loadCache(): Record<string, CacheEntry> {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('[useSchoolPhone] Error loading phone cache:', e);
  }
  return {};
}

function saveCacheEntry(query: string, entry: CacheEntry): void {
  const cache = loadCache();
  cache[query] = entry;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[useSchoolPhone] Error saving phone cache:', e);
  }
}

function getCached(query: string): CacheEntry | undefined {
  const entry = loadCache()[query];
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS ? entry : undefined;
}

// Looks up a school's phone number via the Places JS SDK's AutocompleteService +
// PlacesService (same channel GoogleMapsAutocomplete.tsx / SelfInvoiceModal.tsx
// already use) - the REST Places API doesn't support browser CORS, but the JS
// SDK's own channel does. Returns undefined while loading, null once resolved
// with no match, or the formatted phone number string.
export function useSchoolPhone(schoolName: string | undefined, district: string | undefined): string | null | undefined {
  const placesLib = useMapsLibrary('places');
  const query = schoolName?.trim()
    ? [schoolName.trim(), sanitizeDistrict(district), 'South Africa'].filter(Boolean).join(', ')
    : '';

  const [phone, setPhone] = useState<string | null | undefined>(() => getCached(query)?.phone);

  useEffect(() => {
    if (!query) {
      setPhone(null);
      return;
    }
    const cached = getCached(query);
    if (cached) {
      setPhone(cached.phone);
      return;
    }
    if (!placesLib) return; // wait for the Maps SDK to finish loading

    let cancelled = false;
    setPhone(undefined);

    const autocompleteService = new placesLib.AutocompleteService();
    autocompleteService.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'za' } },
      (preds, status) => {
        if (cancelled) return;
        const placeId = status === 'OK' && preds && preds[0] ? preds[0].place_id : null;
        if (!placeId) {
          setPhone(null);
          saveCacheEntry(query, { phone: null, fetchedAt: Date.now() });
          return;
        }
        const placesService = new placesLib.PlacesService(document.createElement('div'));
        placesService.getDetails(
          { placeId, fields: ['formatted_phone_number', 'international_phone_number'] },
          (place, detailStatus) => {
            if (cancelled) return;
            const resolved = detailStatus === 'OK' && place
              ? place.formatted_phone_number || place.international_phone_number || null
              : null;
            setPhone(resolved);
            saveCacheEntry(query, { phone: resolved, fetchedAt: Date.now() });
          }
        );
      }
    );

    return () => { cancelled = true; };
  }, [placesLib, query]);

  return phone;
}
