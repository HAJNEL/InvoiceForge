import { Dispatch, SetStateAction } from 'react';
import { IDENTIFICATION_TYPES, PAYMENT_METHODS, ACCOUNT_TYPES, HOLDER_RELATIONSHIPS, BANKS, PASSPORT_COUNTRY_CODES } from '../constants';
import { RateGroup } from '../../../types';
import { StaffFormData } from './staffFormTypes';

const inputClass = "w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all";
const labelClass = "text-[10px] font-black uppercase tracking-widest text-zinc-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-black uppercase tracking-wider text-brand-primary pt-2 border-t border-zinc-100 first:border-t-0 first:pt-0">
      {children}
    </p>
  );
}

export function StaffMemberFormFields({ form, setForm, rateGroups }: {
  form: StaffFormData;
  setForm: Dispatch<SetStateAction<StaffFormData>>;
  rateGroups: RateGroup[];
}) {
  const set = <K extends keyof StaffFormData>(key: K, value: StaffFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const selectedRateGroup = rateGroups.find(g => g.id === form.rateGroupId) || null;

  const handleRateGroupChange = (rateGroupId: string) => {
    // Tiers are specific to a group, so switching groups always clears the tier.
    setForm(prev => ({ ...prev, rateGroupId, rateTierId: '' }));
  };

  return (
    <div className="space-y-5">
      <SectionHeading>Essentials</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee Number">
          <input title="SimplePay employee number" type="text" value={form.number} onChange={e => set('number', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Status">
          <select title="Staff member status" value={form.status} onChange={e => set('status', e.target.value as StaffFormData['status'])} className={inputClass}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="First Names *">
          <input title="First names" type="text" required value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Last Name *">
          <input title="Last name" type="text" required value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Date of Birth">
          <input title="Date of birth" type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Date of Appointment">
          <input title="Date of appointment" type="date" value={form.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Job Title">
          <input title="Job title" type="text" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Income Tax Number">
          <input title="Income tax number" type="text" value={form.incomeTaxNumber} onChange={e => set('incomeTaxNumber', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input title="Email address" type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Cellphone No.">
          <input title="Cellphone number" type="tel" value={form.cellNo} onChange={e => set('cellNo', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Identification Type">
          <select title="Identification type" value={form.identificationType} onChange={e => set('identificationType', e.target.value as StaffFormData['identificationType'])} className={inputClass}>
            {IDENTIFICATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {form.identificationType === 'rsa_id' ? (
          <Field label="ID Number">
            <input title="RSA ID number" type="text" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} className={inputClass} />
          </Field>
        ) : form.identificationType !== 'none' ? (
          <>
            <Field label="Passport / Foreign ID No.">
              <input title="Passport / foreign ID number" type="text" value={form.otherNumber} onChange={e => set('otherNumber', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Passport Country Code">
              <select title="Passport country code" value={form.passportCountryCode} onChange={e => set('passportCountryCode', e.target.value)} className={inputClass}>
                <option value="">Select country</option>
                {PASSPORT_COUNTRY_CODES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </>
        ) : null}
      </div>

      <SectionHeading>Compensation</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Rate Group">
          <select
            title="Rate group this staff member is paid from"
            value={form.rateGroupId}
            onChange={e => handleRateGroupChange(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {rateGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Tier">
          <select
            title="Pay tier within the selected rate group"
            value={form.rateTierId}
            onChange={e => set('rateTierId', e.target.value)}
            disabled={!selectedRateGroup || selectedRateGroup.tiers.length === 0}
            className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <option value="">{selectedRateGroup ? 'Select tier' : 'Select a rate group first'}</option>
            {selectedRateGroup?.tiers.map(t => (
              <option key={t.id} value={t.id}>{t.label || 'Untitled'} · R{t.ratePerQuarterHour.toFixed(2)}/15min</option>
            ))}
          </select>
        </Field>
      </div>

      <SectionHeading>Payment Method</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Payment Method">
          <select title="Payment method" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value as StaffFormData['paymentMethod'])} className={inputClass}>
            {PAYMENT_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {form.paymentMethod === 'eft_manual' && (
          <>
            <Field label="Bank">
              <select title="Bank" value={form.bankId} onChange={e => set('bankId', e.target.value)} className={inputClass}>
                <option value="">Select bank</option>
                {BANKS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Account Number">
              <input title="Account number" type="text" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Branch Code">
              <input title="Branch code" type="text" value={form.branchCode} onChange={e => set('branchCode', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Account Type">
              <select title="Account type" value={form.accountType} onChange={e => set('accountType', e.target.value)} className={inputClass}>
                <option value="">Select type</option>
                {ACCOUNT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Holder Relationship">
              <select title="Account holder relationship" value={form.holderRelationship} onChange={e => set('holderRelationship', e.target.value)} className={inputClass}>
                {HOLDER_RELATIONSHIPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Holder Name">
              <input title="Account holder name" type="text" value={form.holderName} onChange={e => set('holderName', e.target.value)} className={inputClass} />
            </Field>
          </>
        )}
      </div>

      <SectionHeading>Residential Address</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Unit Number">
          <input title="Unit number" type="text" value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Complex">
          <input title="Complex" type="text" value={form.complex} onChange={e => set('complex', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Street Number">
          <input title="Street number" type="text" value={form.streetNumber} onChange={e => set('streetNumber', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Street / Farm Name">
          <input title="Street or farm name" type="text" value={form.streetOrFarmName} onChange={e => set('streetOrFarmName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Suburb or District">
          <input title="Suburb or district" type="text" value={form.suburbOrDistrict} onChange={e => set('suburbOrDistrict', e.target.value)} className={inputClass} />
        </Field>
        <Field label="City or Town">
          <input title="City or town" type="text" value={form.cityOrTown} onChange={e => set('cityOrTown', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Code">
          <input title="Postal code" type="text" value={form.physicalCode} onChange={e => set('physicalCode', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <SectionHeading>Postal Address</SectionHeading>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          title="Postal address same as residential"
          type="checkbox"
          checked={form.postalSameAsPhysical}
          onChange={e => set('postalSameAsPhysical', e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
        />
        <span className="text-xs font-bold text-zinc-700">Same as Residential Address</span>
      </label>
      {!form.postalSameAsPhysical && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Line 1">
            <input title="Postal address line 1" type="text" value={form.postalLine1} onChange={e => set('postalLine1', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Line 2">
            <input title="Postal address line 2" type="text" value={form.postalLine2} onChange={e => set('postalLine2', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Line 3">
            <input title="Postal address line 3" type="text" value={form.postalLine3} onChange={e => set('postalLine3', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Code">
            <input title="Postal code" type="text" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} className={inputClass} />
          </Field>
        </div>
      )}
    </div>
  );
}
