/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/utils';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Save, 
  BrainCircuit,
  FileText,
  User,
  Truck,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { DetailedInvoice } from '../../services/geminiService';
import { useProducts } from '../products/hooks/useProducts';
import { useSettings } from '../settings/hooks/useSettings';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GoogleMapsAutocomplete } from '../../components/GoogleMapsAutocomplete';
import { buildSchoolLookupAddress, buildPinSearchAddress, geocodeAddress, upsertCachedPin } from '../../lib/geocoding';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ExtractionReviewMobile } from './ExtractionReviewMobile';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY);

export function ExtractionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<DetailedInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = window.location.pathname.includes('/edit');
  const { syncLineItemsAsProducts } = useProducts();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  // The delivery address as loaded, used to detect whether the user edited it so
  // Refresh Pins can preserve hand-picked addresses. See src/lib/geocoding.ts.
  const initialDeliveryAddressRef = useRef('');

  useEffect(() => {
    async function fetchInvoice() {
      if (!id) return;
      try {
        const docRef = doc(db, 'invoices', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const rawData = docSnap.data() as any;
          
          // Fallback extraction from schema-structured keys if present
          const cleanData: any = { ...rawData };
          
          if (rawData.invoice_number && !cleanData.taxInvoice) {
            cleanData.taxInvoice = rawData.invoice_number;
          }
          if (rawData.invoice_date && !cleanData.invoiceDate) {
            cleanData.invoiceDate = rawData.invoice_date;
          }
          if (rawData.customer_purchase_order_number && !cleanData.customerPO) {
            cleanData.customerPO = rawData.customer_purchase_order_number;
          }
          if (rawData.sales_order_number && !cleanData.salesOrderNo) {
            cleanData.salesOrderNo = rawData.sales_order_number;
          }
          if (rawData.delivery_note_number && !cleanData.deliveryNoteNo) {
            cleanData.deliveryNoteNo = rawData.delivery_note_number;
          }
          if (rawData.customer_contact && !cleanData.customerContact) {
            cleanData.customerContact = rawData.customer_contact;
          }
          
          if (rawData.bill_to_details?.name && !cleanData.customerName) {
            cleanData.customerName = rawData.bill_to_details.name;
          }
          
          if (rawData.ship_to_details) {
            const ship = rawData.ship_to_details;
            if (ship.name && !cleanData.deliveryCustomerName) {
              cleanData.deliveryCustomerName = ship.name;
            }
            if (ship.school_name && !cleanData.schoolName) {
              cleanData.schoolName = ship.school_name;
            }
            if (ship.address) {
              const addr = ship.address;
              if (addr.street_address && !cleanData.deliveryAddressLine1) {
                cleanData.deliveryAddressLine1 = addr.street_address;
              }
              if (addr.city && !cleanData.deliveryAddressLine2) {
                cleanData.deliveryAddressLine2 = addr.city;
              }
              if (addr.region && !cleanData.deliveryRegion) {
                cleanData.deliveryRegion = addr.region;
              }
            }
          }
          
          if (rawData.summary) {
            const sum = rawData.summary;
            if (sum.sub_total !== undefined && cleanData.subTotal === undefined) {
              cleanData.subTotal = sum.sub_total;
            }
            if (sum.vat_rate !== undefined && cleanData.vatRate === undefined) {
              cleanData.vatRate = sum.vat_rate;
            }
            if (sum.vat_amount !== undefined && cleanData.vatAmount === undefined) {
              cleanData.vatAmount = sum.vat_amount;
            }
            if (sum.amount_inclusive_of_vat !== undefined && cleanData.amountIncl === undefined) {
              cleanData.amountIncl = sum.amount_inclusive_of_vat;
            }
            if (sum.freight_amount !== undefined && cleanData.freight === undefined) {
              cleanData.freight = sum.freight_amount;
            }
            if (sum.total_due !== undefined && cleanData.totalDue === undefined) {
              cleanData.totalDue = sum.total_due;
            }
          }

          // Ensure default/fallback values as required by the schema
          if (!cleanData.vatRate) {
            cleanData.vatRate = "15%";
          }
          if (cleanData.amountIncl === undefined) {
            cleanData.amountIncl = cleanData.totalDue !== undefined ? cleanData.totalDue - (cleanData.freight || 0) : 0;
          }
          
          if (rawData.line_items && !cleanData.lineItems) {
            cleanData.lineItems = rawData.line_items.map((it: any) => ({
              stockCode: it.stock_code || "",
              description: it.description || "",
              qty: it.quantity || 0,
              unitPrice: it.unit_price || 0,
              disc: it.discount || 0,
              value: it.line_item_value || 0
            }));
          } else if (cleanData.lineItems) {
            cleanData.lineItems = cleanData.lineItems.map((it: any) => ({
              ...it,
              disc: it.disc !== undefined ? it.disc : (it.discount || 0)
            }));
          }

          setInvoice(cleanData);
          initialDeliveryAddressRef.current = (cleanData.deliveryAddress || '').trim();
        } else {
          console.error("No such invoice!");
          navigate(isEditing ? '/invoices' : '/invoices/import');
        }
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError("Failed to load invoice data.");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id, navigate, isEditing]);

  const handleSave = async (status: 'pending' | 'draft' = 'pending') => {
    if (!id || !invoice) return;
    setSaving(true);
    setError(null);
    try {
      // Check for duplicates (excluding current document)
      if (invoice.taxInvoice) {
        const q = query(
          collection(db, 'invoices'),
          where('userId', '==', auth.currentUser?.uid),
          where('taxInvoice', '==', String(invoice.taxInvoice))
        );
        const querySnapshot = await getDocs(q);
        const isDuplicate = querySnapshot.docs.some(doc => doc.id !== id);
        
        if (isDuplicate) {
          setError(`Duplicate Error: An invoice with number ${invoice.taxInvoice} already exists.`);
          setSaving(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      // Structure final document according to the user's exact schema
      const docRef = doc(db, 'invoices', id);
      const currentStatus = (invoice as { status?: string }).status;

      const invoiceSchemaData = {
        invoice_number: String(invoice.taxInvoice || "").trim(),
        invoice_date: String(invoice.invoiceDate || "").trim(),
        customer_purchase_order_number: invoice.customerPO ? String(invoice.customerPO).trim() : null,
        sales_order_number: invoice.salesOrderNo ? String(invoice.salesOrderNo).trim() : null,
        delivery_note_number: invoice.deliveryNoteNo ? String(invoice.deliveryNoteNo).trim() : null,
        customer_contact: invoice.customerContact ? String(invoice.customerContact).trim() : null,
        bill_to_details: {
          name: String(invoice.customerName || "").trim()
        },
        ship_to_details: invoice.deliveryCustomerName || invoice.schoolName || invoice.deliveryAddressLine1 ? {
          name: String(invoice.deliveryCustomerName || invoice.customerName || "").trim(),
          school_name: invoice.schoolName ? String(invoice.schoolName).trim() : null,
          address: {
            street_address: String(invoice.deliveryAddressLine1 || "").trim(),
            city: String(invoice.deliveryAddressLine2 || "").trim(),
            region: invoice.deliveryRegion ? String(invoice.deliveryRegion).trim() : null
          }
        } : null,
        line_items: (invoice.lineItems || []).map(item => ({
          stock_code: String(item.stockCode || "").trim(),
          description: String(item.description || "").trim(),
          quantity: Number(item.qty) || 0,
          unit_price: Number(item.unitPrice) || 0,
          discount: item.disc !== undefined ? Number(item.disc) : null,
          line_item_value: Number(item.value) || 0
        })),
        summary: {
          sub_total: Number(invoice.subTotal) || 0,
          vat_rate: invoice.vatRate ? String(invoice.vatRate).trim() : null,
          vat_amount: Number(invoice.vatAmount) || 0,
          amount_inclusive_of_vat: invoice.amountIncl !== undefined ? Number(invoice.amountIncl) : null,
          freight_amount: invoice.freight !== undefined ? Number(invoice.freight) : null,
          total_due: Number(invoice.totalDue) || 0
        }
      };

      // Flag the delivery address as manual when the user edited it (or it was
      // already manual and left untouched), so Refresh Pins preserves it.
      const currentDelivery = (invoice.deliveryAddress || '').trim();
      const deliveryEdited = currentDelivery !== initialDeliveryAddressRef.current;
      const deliveryAddressManual = deliveryEdited ? currentDelivery.length > 0 : (invoice.deliveryAddressManual === true);

      await updateDoc(docRef, {
        ...invoice,
        ...invoiceSchemaData,
        deliveryAddressManual,
        status: isEditing ? currentStatus || status : status,
        updatedAt: new Date().toISOString()
      });

      if (invoice.lineItems && invoice.lineItems.length > 0) {
        await syncLineItemsAsProducts(invoice.lineItems);
      }

      // Auto-geocode and cache coordinates in localStorage to load markers instantly on /trips.
      // A manual delivery-address override wins; otherwise we look up the school name on
      // Google Maps first (source of truth for the pin), then fall back to the extracted
      // street address / client name. The resolved address is saved back onto the invoice
      // as `deliveryAddress` so the pin and the invoice stay in sync.
      try {
        const pinSource = {
          client: invoice.schoolName || invoice.deliveryCustomerName || invoice.customerName || 'Unknown Client',
          schoolName: invoice.schoolName,
          district: invoice.district,
          deliveryAddress: invoice.deliveryAddress,
          deliveryAddressLine1: invoice.deliveryAddressLine1,
          deliveryAddressLine2: invoice.deliveryAddressLine2,
        };

        // Manual override → geocode the user's chosen address. Otherwise force the
        // school-name lookup so editing the school moves the pin (the stored auto
        // deliveryAddress is ignored here and refreshed from the school).
        const fallbackAddress = buildPinSearchAddress({ ...pinSource, deliveryAddress: undefined });
        const primaryAddress = deliveryAddressManual
          ? (currentDelivery || buildSchoolLookupAddress(pinSource) || fallbackAddress)
          : (buildSchoolLookupAddress(pinSource) || fallbackAddress);

        // Biases geocoding toward the warehouse's region so a same-named school
        // in another province doesn't outrank the real, nearby one.
        const warehouseBias = settings?.warehouseLat !== undefined && settings?.warehouseLng !== undefined
          ? { lat: settings.warehouseLat, lng: settings.warehouseLng }
          : undefined;

        let geo = await geocodeAddress(primaryAddress, warehouseBias);
        if (!geo && primaryAddress !== fallbackAddress) {
          geo = await geocodeAddress(fallbackAddress, warehouseBias);
        }

        if (geo) {
          // Persist the resolved address onto the invoice, then cache the pin.
          await updateDoc(docRef, { deliveryAddress: geo.formattedAddress, deliveryAddressManual });

          upsertCachedPin({
            id,
            number: invoice.taxInvoice || `TEMP-${Date.now()}`,
            client: pinSource.client,
            status: isEditing ? currentStatus || status : status,
            address: geo.formattedAddress,
            searchAddress: geo.formattedAddress,
            position: geo.position,
            district: invoice.district,
            lineItems: invoice.lineItems || [],
          });
          console.log(`[DEBUG] Geocoded and stored pin for reviewed invoice: ${invoice.taxInvoice}`);
        }
      } catch (geocodeErr) {
        console.error('Error auto-geocoding single reviewed invoice:', geocodeErr);
      }

      navigate(isEditing ? `/invoices/${id}` : '/invoices');
    } catch (err) {
      console.error("Error updating invoice:", err);
      setError("Failed to save invoice. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof DetailedInvoice>(field: K, value: DetailedInvoice[K]) => {
    setInvoice((prev) => prev ? ({ ...prev, [field]: value }) : null);
  };

  const updateLineItems = (newItems: DetailedInvoice['lineItems']) => {
    if (!invoice) return;
    
    // Calculate new values for each item
    const itemsWithValues = newItems.map(item => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const disc = Number(item.disc) || 0;
      return {
        ...item,
        qty,
        unitPrice,
        disc,
        value: Number((qty * unitPrice - disc).toFixed(2))
      };
    });

    // Calculate totals
    const subTotal = Number(itemsWithValues.reduce((sum, item) => sum + item.value, 0).toFixed(2));
    
    // Calculate VAT using vatRate
    const vatRateStr = invoice.vatRate || "15%";
    const vatPercent = parseFloat(vatRateStr.replace(/%/g, '')) || 0;
    const vatAmount = Number((subTotal * (vatPercent / 100)).toFixed(2));
    
    const freight = Number(invoice.freight) || 0;
    const amountIncl = Number((subTotal + vatAmount).toFixed(2));
    const totalDue = Number((subTotal + vatAmount + freight).toFixed(2));

    setInvoice({
      ...invoice,
      lineItems: itemsWithValues,
      subTotal,
      vatAmount,
      amountIncl,
      totalDue
    });
  };

  const handleAddLineItem = () => {
    if (!invoice) return;
    const currentItems = invoice.lineItems || [];
    const newItem = {
      stockCode: '',
      description: '',
      qty: 1,
      unitPrice: 0,
      disc: 0,
      value: 0
    };
    updateLineItems([...currentItems, newItem]);
  };

  const handleDeleteLineItem = (indexToDelete: number) => {
    if (!invoice) return;
    const currentItems = invoice.lineItems || [];
    const newItems = currentItems.filter((_, idx) => idx !== indexToDelete);
    updateLineItems(newItems);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-pulse">
        <BrainCircuit className="w-12 h-12 text-brand-accent mb-4 animate-bounce" />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">{isEditing ? 'Loading Invoice...' : 'Loading AI Extraction...'}</p>
      </div>
    );
  }

  if (!invoice) return null;

  if (isMobile) {
    const mobileContent = (
      <ExtractionReviewMobile
        invoice={invoice}
        isEditing={isEditing}
        saving={saving}
        error={error}
        hasValidMapsKey={hasValidMapsKey}
        updateField={updateField}
        updateLineItems={updateLineItems}
        handleAddLineItem={handleAddLineItem}
        handleDeleteLineItem={handleDeleteLineItem}
        handleSave={handleSave}
        onBack={() => navigate(isEditing ? `/invoices/${id}` : '/invoices/import')}
      />
    );
    return hasValidMapsKey ? (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
        {mobileContent}
      </APIProvider>
    ) : mobileContent;
  }

  const content = (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(isEditing ? `/invoices/${id}` : '/invoices/import')}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Invoice' : 'Review Extraction'}</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{isEditing ? 'Saved Data' : 'AI Processed'}</span>
              </div>
            </div>
            <p className="text-zinc-500 text-sm mt-1">Invoice: <strong>{invoice.taxInvoice || invoice.originalFileName}</strong></p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button 
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
            >
              Save as Draft
            </button>
          )}
          <button 
            onClick={() => handleSave(isEditing ? 'pending' : 'pending')}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            {saving ? <BrainCircuit className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Update Invoice' : 'Confirm & Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Document Header */}
          <div className="saas-card bg-white p-8 space-y-8">
            <div className="flex items-center gap-3 text-brand-primary">
              <FileText className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Document Header</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <ReviewField label="TAX INVOICE #" value={invoice.taxInvoice} onChange={(v) => updateField('taxInvoice', v)} />
              <ReviewField label="Invoice Date" value={invoice.invoiceDate} onChange={(v) => updateField('invoiceDate', v)} />
              <ReviewField label="Customer P/O" value={invoice.customerPO} onChange={(v) => updateField('customerPO', v)} />
              <ReviewField label="Sales Order No" value={invoice.salesOrderNo} onChange={(v) => updateField('salesOrderNo', v)} />
              <ReviewField label="Delivery Note" value={invoice.deliveryNoteNo} onChange={(v) => updateField('deliveryNoteNo', v)} />
              <ReviewField label="Customer Contact" value={invoice.customerContact || ''} onChange={(v) => updateField('customerContact', v)} />
            </div>
          </div>

          {/* Shipping Details */}
          <div className="saas-card bg-white p-8 space-y-8">
            <div className="flex items-center gap-3 text-brand-primary">
              <Truck className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Shipping Details</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <ReviewField label="Shipping Name" value={invoice.deliveryCustomerName || ''} onChange={(v) => updateField('deliveryCustomerName', v)} />
              <ReviewField label="School Name" value={invoice.schoolName || ''} onChange={(v) => updateField('schoolName', v)} />
              {hasValidMapsKey ? (
                <div className="space-y-1.5 group">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-brand-accent transition-colors">Street Address</label>
                  <GoogleMapsAutocomplete
                    value={invoice.deliveryAddressLine1 || ''}
                    onChange={(v) => updateField('deliveryAddressLine1', v)}
                    placeholder="Search delivery address..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                  />
                </div>
              ) : (
                <ReviewField label="Street Address" value={invoice.deliveryAddressLine1 || ''} onChange={(v) => updateField('deliveryAddressLine1', v)} />
              )}
              <ReviewField label="City" value={invoice.deliveryAddressLine2 || ''} onChange={(v) => updateField('deliveryAddressLine2', v)} />
              <ReviewField label="Region" value={invoice.deliveryRegion || ''} onChange={(v) => updateField('deliveryRegion', v)} />
              <div className="space-y-1.5 group col-span-2 lg:col-span-3">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-brand-accent transition-colors">Delivery Address</label>
                {hasValidMapsKey ? (
                  <GoogleMapsAutocomplete
                    value={invoice.deliveryAddress || ''}
                    onChange={(v) => updateField('deliveryAddress', v)}
                    placeholder="Search the delivery address on Google Maps..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                  />
                ) : (
                  <input
                    aria-label="Delivery Address"
                    title="The exact location used for this invoice's map pin. Auto-filled from the Google Maps school lookup; edit to move the pin."
                    type="text"
                    value={invoice.deliveryAddress || ''}
                    onChange={(v) => updateField('deliveryAddress', v.target.value)}
                    placeholder="Auto-filled from the Google Maps school lookup on save"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                  />
                )}
                <p className="text-[10px] text-zinc-400">This is the actual location used for the map pin. Leave blank to use the looked-up school address; type an address here to override where the pin is placed.</p>
              </div>
            </div>
          </div>

          {/* Bill To Details */}
          <div className="saas-card bg-white p-8 space-y-8">
            <div className="flex items-center gap-3 text-brand-primary">
              <User className="w-5 h-5" />
              <h3 className="font-bold text-xs uppercase tracking-widest">Bill To Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReviewField label="Billing Name" value={invoice.customerName} onChange={(v) => updateField('customerName', v)} />
            </div>
          </div>
        </div>

        {/* Totals Side Panel - Only contains fields from the schema's summary */}
        <div className="space-y-8">
          <div className="saas-card bg-white text-zinc-900 p-8 space-y-6">
            <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-400">Invoice Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-zinc-100 pb-3">
                <span className="text-zinc-500 font-medium font-sans uppercase text-[10px] tracking-wider">Sub Total</span>
                <span className="font-extrabold font-mono text-zinc-900 text-base whitespace-nowrap">{formatCurrency(invoice.subTotal)}</span>
              </div>
              
              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">VAT Rate</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={invoice.vatRate || '15%'}
                    onChange={(e) => {
                      const updated = { ...invoice, vatRate: e.target.value };
                      setInvoice(updated);
                      // Recalculate totals
                      setTimeout(() => updateLineItems(invoice.lineItems), 0);
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                    placeholder="15%"
                  />
                  <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-sm font-bold font-mono text-zinc-600 whitespace-nowrap flex items-center justify-center">
                    {formatCurrency(invoice.vatAmount)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Freight Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
                  <input
                    type="number"
                    step="any"
                    value={invoice.freight === 0 ? '' : invoice.freight}
                    onChange={(e) => {
                      const val = e.target.value;
                      const fVal = val === '' ? 0 : parseFloat(val);
                      const updated = { ...invoice, freight: fVal };
                      setInvoice(updated);
                      setTimeout(() => updateLineItems(invoice.lineItems), 0);
                    }}
                    className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Amount Incl. of VAT</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
                  <input
                    type="number"
                    step="any"
                    value={invoice.amountIncl === 0 ? '' : invoice.amountIncl}
                    onChange={(e) => {
                      const val = e.target.value;
                      const aVal = val === '' ? 0 : parseFloat(val);
                      updateField('amountIncl', aVal);
                    }}
                    className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xl font-black border-t border-zinc-100 pt-4 mt-2">
                <span className="uppercase tracking-tighter text-zinc-500 text-sm">Total Due</span>
                <span className="text-brand-primary font-bold font-mono text-xl whitespace-nowrap">{formatCurrency(invoice.totalDue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items - FULL WIDTH */}
      <div className="saas-card bg-white p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-zinc-500">
            <div className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 shadow-sm text-brand-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 leading-tight">Line Items</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Please check and verify all extracted items</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-zinc-50 text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-100 rounded-lg select-none">
            {invoice.lineItems?.length || 0} items extracted
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 italic font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="px-4 pb-4 font-semibold text-left w-[15%]">Stock Code</th>
                <th className="px-4 pb-4 font-semibold text-left w-[33%]">Description</th>
                <th className="px-4 pb-4 font-semibold text-right w-[10%]">Qty</th>
                <th className="px-4 pb-4 font-semibold text-right w-[13%]">Price</th>
                <th className="px-4 pb-4 font-semibold text-right w-[11%]">Discount</th>
                <th className="px-4 pb-4 font-semibold text-right w-[13%]">Value</th>
                <th className="px-4 pb-4 font-semibold text-center w-[10%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm font-bold text-zinc-400 uppercase tracking-tight">
                    No line items found. Click add to create one.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((item, idx: number) => (
                  <tr key={idx} className="group hover:bg-zinc-50/40 transition-colors">
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={item.stockCode || ''} 
                        onChange={(e) => {
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], stockCode: e.target.value };
                          updateLineItems(newItems);
                        }}
                        placeholder="STOCK CODE"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-mono transition-all focus:outline-none"
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={item.description || ''}
                        onChange={(e) => {
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], description: e.target.value };
                          updateLineItems(newItems);
                        }}
                        placeholder="Item Description"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm transition-all focus:outline-none"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <input 
                        type="number" 
                        step="any"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newItems = [...invoice.lineItems];
                          newItems[idx] = { ...newItems[idx], qty: val === '' ? 0 : parseFloat(val) };
                          updateLineItems(newItems);
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-semibold font-mono text-right focus:outline-none transition-all"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
                        <input 
                          type="number" 
                          step="any"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newItems = [...invoice.lineItems];
                            newItems[idx] = { ...newItems[idx], unitPrice: val === '' ? 0 : parseFloat(val) };
                            updateLineItems(newItems);
                          }}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-semibold font-mono text-right focus:outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">R</span>
                        <input 
                          type="number" 
                          step="any"
                          value={item.disc === 0 ? '' : item.disc}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newItems = [...invoice.lineItems];
                            newItems[idx] = { ...newItems[idx], disc: val === '' ? 0 : parseFloat(val) };
                            updateLineItems(newItems);
                          }}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 rounded-xl text-sm font-semibold font-mono text-right focus:outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-black font-mono text-zinc-900 pr-2">
                        {formatCurrency(item.value)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLineItem(idx)}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all inline-flex items-center justify-center border border-red-100"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      </div>
    </div>
  );

  return hasValidMapsKey ? (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      {content}
    </APIProvider>
  ) : content;
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 group">
      <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-brand-accent transition-colors">{label}</label>
      <input aria-label={label} 
        type="text" 
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
      />
    </div>
  );
}

