import { Trip, TripStatus } from '../types';

// Public OAuth 2.0 Web Client ID, injected by Vite (see vite.config.ts).
export const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Trip statuses that belong on a team member's calendar: "proposed and above,
// not completed". Pending (still being planned) and the terminal/done states
// (completed, delivered, invoiced) are excluded.
const CALENDAR_ELIGIBLE_STATUSES = new Set<string>([
  TripStatus.PROPOSED,
  TripStatus.ASSEMBLED,
  TripStatus.ON_ROUTE,
  TripStatus.PARTIALLY_COMPLETED,
]);

// Local "YYYY-MM-DD" for today, matching how Trip.date is stored (avoids the
// toISOString() UTC-shift bug).
export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The day after a "YYYY-MM-DD" date — Google all-day events use an exclusive end date.
function nextDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// A trip should appear on the calendar when its status is eligible AND its
// scheduled date is today or later (never sync past trips).
export function isTripCalendarEligible(trip: Trip): boolean {
  if (!trip.date) return false;
  if (!CALENDAR_ELIGIBLE_STATUSES.has(trip.status)) return false;
  return trip.date >= todayDateKey();
}

// --- Google Identity Services token client -------------------------------

interface TokenResponse { access_token?: string; error?: string }
interface TokenError { type?: string; message?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
        error_callback?: (err: TokenError) => void;
      }) => TokenClient;
    };
  };
}

// `window.google` may already exist by the time this runs (e.g. the Google
// Maps JS API, loaded elsewhere in the app, sets `window.google.maps`), so a
// bare truthy check on `window.google` isn't enough to know GIS itself has
// loaded — it must specifically expose `accounts.oauth2`.
function getGisReady(): GoogleGsi | undefined {
  const g = (window as unknown as { google?: GoogleGsi }).google;
  return g?.accounts?.oauth2 ? g : undefined;
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (getGisReady()) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
  return gisLoading;
}

// Request a short-lived Google Calendar access token via the GIS token client.
// `prompt: 'consent'` forces the consent screen (used the first time a member
// enables sync); afterwards we pass '' to reuse the existing grant silently.
export async function requestCalendarToken(forceConsent = false): Promise<string> {
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Google Calendar is not configured (missing OAuth client ID).');
  }
  await loadGis();
  const google = getGisReady();
  if (!google) throw new Error('Google Identity Services unavailable.');

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Could not obtain Google Calendar permission.'));
        } else {
          resolve(resp.access_token);
        }
      },
      // Fires when the consent popup is closed/blocked, so the promise never hangs.
      error_callback: (err) => {
        reject(new Error(err?.type === 'popup_closed'
          ? 'Google Calendar permission was cancelled.'
          : (err?.message || 'Could not open Google authorization.')));
      },
    });
    client.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
  });
}

// --- Calendar event upsert ------------------------------------------------

function buildEventBody(trip: Trip) {
  const lines = [
    `Truck: ${trip.truckName || '—'}`,
    `Invoices: ${trip.invoiceIds?.length || 0}`,
    `Status: ${trip.status}`,
  ];
  return {
    summary: `Trip: ${trip.name}`,
    description: lines.join('\n'),
    start: { date: trip.date },
    end: { date: nextDay(trip.date) },
    // Traceability back to the InvoiceForge trip, in case events need reconciling.
    extendedProperties: { private: { invoiceForgeTripId: trip.id } },
  };
}

// Create the event for a trip, or update the existing one (moving it when the
// scheduled date changed). If a previously-synced event was deleted by the user
// in Google Calendar (404), we transparently create a fresh one. Returns the
// Google event id to persist.
export async function upsertTripEvent(
  token: string,
  trip: Trip,
  existingEventId?: string
): Promise<string> {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const body = JSON.stringify(buildEventBody(trip));
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (existingEventId) {
    const res = await fetch(`${base}/${encodeURIComponent(existingEventId)}`, {
      method: 'PATCH',
      headers,
      body,
    });
    if (res.ok) {
      const data = await res.json();
      return data.id as string;
    }
    if (res.status !== 404) {
      throw new Error(`Calendar update failed (${res.status}).`);
    }
    // 404 → event no longer exists; fall through to create a new one.
  }

  const res = await fetch(base, { method: 'POST', headers, body });
  if (!res.ok) {
    throw new Error(`Calendar event creation failed (${res.status}).`);
  }
  const data = await res.json();
  return data.id as string;
}
