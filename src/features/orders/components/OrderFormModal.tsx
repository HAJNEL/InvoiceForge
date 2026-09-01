import { useState, useEffect } from 'react';
import { X, Plus, Trash2, MapPin, XCircle } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import type { Order, OrderLineItem, OrderStatus } from '../hooks/useOrders';
import { useOrders } from '../hooks/useOrders';
import { GOOGLE_MAPS_API_KEY, hasMapsKey } from '../hooks/useOrderLocationIssues';
import { useSettings } from '../../settings/hooks/useSettings';
import { schoolKeyFor, upsertCachedSchoolPin, buildSchoolPinSearchAddress, findSchoolsSharingAddress } from '../../../lib/geocoding';
import { SchoolFinderPanel, type SchoolFinderResult } from './SchoolFinderPanel';
import { GoogleMapsAutocomplete } from '../../../components/GoogleMapsAutocomplete';

interface DraftLine {
  id: string;
  stockCode: string;
  qty: number;
}

function emptyLine(): DraftLine {
  return { id: Math.random().toString(36).slice(2), stockCode: '', qty: 1 };
}

function toDraftLines(lineItems: OrderLineItem[]): DraftLine[] {
  if (lineItems.length === 0) return [emptyLine()];
  return lineItems.map(l => ({ id: Math.random().toString(36).slice(2), stockCode: l.stockCode, qty: l.qty }));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSave: (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<unknown>;
}

export function OrderFormModal({ isOpen, onClose, order, onSave }: Props) {
  const { settings } = useSettings();
  const { orders } = useOrders();
  const [schoolId, setSchoolId] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Active');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  // The school's confirmed location, chosen via School Finder - persisted to the
  // Order doc (Order.location) and the shared school-pin cache on save. Starts
  // at whatever the order already had so re-opening an already-pinned order
  // doesn't silently drop its location.
  const [selectedResult, setSelectedResult] = useState<SchoolFinderResult | null>(null);
  // Distinguishes "explicitly cleared" from "nothing picked yet" - the latter
  // falls back to the order's already-saved location, the former must not.
  const [locationCleared, setLocationCleared] = useState(false);
  // Other schools sharing the typed address, surfaced as a confirm-before-save
  // prompt (see findSchoolsSharingAddress) - null when there's nothing to warn
  // about or the warning hasn't been checked yet for the current address.
  const [duplicateSchools, setDuplicateSchools] = useState<string[] | null>(null);

  const warehousePosition = settings?.warehouseLat != null && settings?.warehouseLng != null
    ? { lat: settings.warehouseLat, lng: settings.warehouseLng }
    : null;
  const pendingLocation = locationCleared ? undefined : (selectedResult?.position ?? order?.location);

  useEffect(() => {
    if (order) {
      setSchoolId(order.schoolId);
      setClientNumber(order.clientNumber);
      setSchoolName(order.schoolName);
      setAddress(order.address || '');
      setArea(order.area);
      setSchoolType(order.schoolType);
      setOrderNumber(order.orderNumber);
      setStatus(order.status);
      setLines(toDraftLines(order.lineItems));
    } else {
      setSchoolId(''); setClientNumber(''); setSchoolName(''); setAddress(''); setArea('');
      setSchoolType(''); setOrderNumber(''); setStatus('Active'); setLines([emptyLine()]);
    }
    setSelectedResult(null);
    setLocationCleared(false);
    setFinderOpen(false);
    setDuplicateSchools(null);
  }, [order, isOpen]);

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  // Gate the actual save behind a confirm-before-save prompt when the typed
  // address matches another school's order - two different schools sharing one
  // delivery address is usually a copy-paste mistake, so this asks first rather
  // than silently saving it. `force` skips the check when the user has already
  // confirmed via that dialog.
  const handleSaveClick = (force = false) => {
    if (!schoolName.trim()) return;
    if (!force && address.trim()) {
      const duplicates = findSchoolsSharingAddress(orders, order?.id, schoolName, address);
      if (duplicates.length > 0) {
        setDuplicateSchools(duplicates);
        return;
      }
    }
    performSave();
  };

  const performSave = async () => {
    // Blank/zero-quantity SKU rows never become order lines.
    const lineItems: OrderLineItem[] = lines
      .filter(l => l.stockCode.trim() && l.qty > 0)
      .map(l => ({ stockCode: l.stockCode.trim(), qty: l.qty }));

    setSaving(true);
    const result = await onSave({
      schoolId: schoolId.trim(),
      clientNumber: clientNumber.trim(),
      schoolName: schoolName.trim(),
      address: address.trim(),
      area: area.trim(),
      schoolType: schoolType.trim(),
      orderNumber: orderNumber.trim(),
      status,
      lineItems,
      ...(pendingLocation ? { location: pendingLocation } : {})
    });
    setSaving(false);
    if (result) {
      // Keep the school-pin cache (used by Order Builder's map and the Location
      // Issues check) in sync with the location just confirmed here, so other
      // screens reflect it immediately instead of waiting on their own re-geocode.
      // searchAddress must match what OrderBuilderMap/OrderLocationGeocoder will
      // compute as "expected" for this school (buildSchoolPinSearchAddress), or
      // they'll treat this pin as stale and immediately re-geocode over it.
      if (selectedResult) {
        upsertCachedSchoolPin({
          schoolKey: schoolKeyFor(schoolName),
          schoolName: schoolName.trim(),
          searchAddress: buildSchoolPinSearchAddress(schoolName, address) || selectedResult.name,
          address: selectedResult.address,
          position: selectedResult.position
        });
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
          <div>
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary">
              {order ? 'Edit Order' : 'Add Order'}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">School, area and SKU quantities</p>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 hover:bg-zinc-200 rounded-xl text-zinc-400 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <input
              title="School"
              placeholder="School"
              value={schoolName}
              // Typing a new name manually invalidates whatever location was
              // picked/carried over for the old one - Google Maps results for
              // "F.D. Conradie" don't apply once the field says something else.
              // Selecting a School Finder result sets schoolName itself (below),
              // so that path never runs through here.
              onChange={(e) => { setSchoolName(e.target.value); setSelectedResult(null); setDuplicateSchools(null); }}
              className="col-span-2 px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />

            <div className="col-span-2">
              {hasMapsKey ? (
                <GoogleMapsAutocomplete
                  value={address}
                  onChange={(val) => { setAddress(val); setSelectedResult(null); setDuplicateSchools(null); }}
                  placeholder="Address (optional — overrides School Finder's search)"
                  className="w-full px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                />
              ) : (
                <input
                  title="Address"
                  placeholder="Address (optional)"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setSelectedResult(null); setDuplicateSchools(null); }}
                  className="w-full px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                />
              )}
            </div>

            {hasMapsKey && (
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Find this school on Google Maps"
                    onClick={() => setFinderOpen(v => !v)}
                    disabled={!schoolName.trim() && !address.trim()}
                    className="flex items-center gap-1 text-[10px] font-black uppercase text-brand-accent hover:bg-brand-accent/5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MapPin className="w-3 h-3" /> School Finder
                  </button>
                  {pendingLocation && (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <MapPin className="w-3 h-3 text-brand-accent shrink-0" />
                      Location set
                      {selectedResult?.distanceKm != null && ` · ${selectedResult.distanceKm.toFixed(1)} km from warehouse`}
                      <button
                        type="button"
                        title="Clear selected location"
                        onClick={() => { setSelectedResult(null); setLocationCleared(true); }}
                        className="p-0.5 text-zinc-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                {finderOpen && (
                  <SchoolFinderPanel
                    schoolName={schoolName}
                    address={address}
                    warehousePosition={warehousePosition}
                    selectedPosition={pendingLocation}
                    onSelect={(result) => {
                      // The search was address-driven (address overrides school
                      // name as the query - see SchoolFinderPanel/
                      // buildSchoolPinSearchAddress), so the picked result refines
                      // the Address field, not the school name - setting
                      // schoolName here would clobber it with a street address.
                      // Only when there's no address does the result describe the
                      // school itself, so schoolName is what gets updated then.
                      if (address.trim()) {
                        setAddress(result.address);
                      } else {
                        setSchoolName(result.name);
                      }
                      setSelectedResult(result);
                      setLocationCleared(false);
                      setFinderOpen(false);
                    }}
                  />
                )}
              </div>
            )}

            <input title="Order number" placeholder="Order No." value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="School ID" placeholder="School ID" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="Area" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="School type" placeholder="School Type" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <input title="Client number" placeholder="Client Number" value={clientNumber} onChange={(e) => setClientNumber(e.target.value)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent" />
            <select title="Status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="px-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent">
              <option value="Active">Active</option>
              <option value="Complete">Complete</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">SKUs & Quantities</label>
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-1.5">
                <input title="SKU" placeholder="SKU" value={line.stockCode} onChange={(e) => updateLine(line.id, { stockCode: e.target.value })}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
                <input title="Quantity" type="number" min={0} value={line.qty} onChange={(e) => updateLine(line.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-16 px-2 py-1.5 bg-zinc-50/50 border border-zinc-200 rounded-lg text-[11px] text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20" />
                <button
                  type="button"
                  title="Remove line"
                  onClick={() => setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== line.id) : prev)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              title="Add another SKU line"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-brand-accent hover:bg-brand-accent/5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Line
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Save order"
            onClick={() => handleSaveClick()}
            disabled={saving || !schoolName.trim()}
            className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            {saving ? 'Saving…' : order ? 'Save Changes' : 'Add Order'}
          </button>
        </div>
      </div>

      {duplicateSchools && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] text-zinc-900 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border border-zinc-200 shadow-2xl">
            <div className="p-5 space-y-3">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Address Already In Use
              </h4>
              <p className="text-xs text-zinc-600">
                This address is also used by {duplicateSchools.length === 1 ? 'another school' : `${duplicateSchools.length} other schools`}:
              </p>
              <ul className="text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-32 overflow-y-auto">
                {duplicateSchools.map(name => (
                  <li key={name} className="px-3 py-1.5">{name}</li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-400">Save anyway if this is correct (e.g. a shared campus), or go back and check the address.</p>
            </div>
            <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-end gap-2">
              <button
                type="button"
                title="Go back and edit"
                onClick={() => setDuplicateSchools(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                title="Save order anyway"
                onClick={() => { setDuplicateSchools(null); handleSaveClick(true); }}
                className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return hasMapsKey ? (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      {content}
    </APIProvider>
  ) : content;
}
