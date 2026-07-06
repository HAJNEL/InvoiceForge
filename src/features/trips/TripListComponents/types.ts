/// <reference types="google.maps" />

export interface GeocodedInvoice {
  id: string;
  number: string;
  client: string;
  address: string;
  status: string;
  position: google.maps.LatLngLiteral;
  district?: string;
  // The address string that was actually geocoded to produce `position`. Used to
  // detect when an invoice's address has changed since it was cached, so the pin
  // is re-geocoded instead of staying stuck at a stale (possibly wrong) location.
  searchAddress?: string;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}
