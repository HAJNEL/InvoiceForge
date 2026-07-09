import { auth } from './firebase';

export interface ZohoLineItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface SendZohoInvoiceInput {
  customerId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  lineItems: ZohoLineItem[];
}

export type SendZohoInvoiceResult =
  | { success: true; zohoInvoiceId: string; zohoInvoiceUrl: string }
  | { success: false; error: string };

export interface ZohoContactSummary {
  id: string;
  name: string;
}

export type ListZohoContactsResult =
  | { success: true; contacts: ZohoContactSummary[] }
  | { success: false; error: string };

// Lists the caller's Zoho Books customers, for the "who is this invoice
// linked to" picker shown on Complete - see GET /api/zoho/contacts.
export async function listZohoContacts(): Promise<ListZohoContactsResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to load Zoho Books customers.' };
    }

    const response = await fetch('/api/zoho/contacts', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return { success: true, contacts: data.contacts || [] };
    }
    return { success: false, error: data.error || 'Failed to load customers from Zoho Books.' };
  } catch (err) {
    console.error('listZohoContacts error:', err);
    return { success: false, error: 'Failed to load customers from Zoho Books.' };
  }
}

export interface ZohoConnectionInput {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  region: string;
}

export type TestZohoConnectionResult =
  | { success: true; organizationName: string | null }
  | { success: false; error: string };

// Verifies a candidate Zoho Books connection works before it's saved (or to
// re-check an already-saved one) - see POST /api/zoho/test-connection.
export async function testZohoConnection(input: ZohoConnectionInput): Promise<TestZohoConnectionResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to test the Zoho connection.' };
    }

    const response = await fetch('/api/zoho/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return { success: true, organizationName: data.organizationName ?? null };
    }
    return { success: false, error: data.error || 'Could not connect to Zoho Books with these credentials.' };
  } catch (err) {
    console.error('testZohoConnection error:', err);
    return { success: false, error: 'Could not connect to Zoho Books with these credentials.' };
  }
}

// Pushes a completed Client Invoice bundle to Zoho Books. The Zoho client
// id/secret/refresh token stay server-side (see POST /api/zoho/create-invoice
// in server.ts) - this only carries what to bill and who to, authenticated
// with the current user's Firebase ID token, same pattern as sendNotification.
export async function sendZohoInvoice(input: SendZohoInvoiceInput): Promise<SendZohoInvoiceResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to send invoices to Zoho.' };
    }

    const response = await fetch('/api/zoho/create-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return { success: true, zohoInvoiceId: data.zohoInvoiceId, zohoInvoiceUrl: data.zohoInvoiceUrl };
    }
    return { success: false, error: data.error || 'Failed to send invoice to Zoho.' };
  } catch (err) {
    console.error('sendZohoInvoice error:', err);
    return { success: false, error: 'Failed to send invoice to Zoho.' };
  }
}
