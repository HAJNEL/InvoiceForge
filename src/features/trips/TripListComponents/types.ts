/// <reference types="google.maps" />

export interface GeocodedInvoice {
  id: string;
  number: string;
  client: string;
  address: string;
  status: string;
  position: google.maps.LatLngLiteral;
  district?: string;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}
