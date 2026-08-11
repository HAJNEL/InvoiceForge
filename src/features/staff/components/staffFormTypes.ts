import { StaffMember } from '../../../types';

export interface StaffFormData {
  number: string;
  firstName: string;
  lastName: string;
  birthdate: string;
  appointmentDate: string;
  identificationType: StaffMember['identificationType'];
  idNumber: string;
  otherNumber: string;
  passportCountryCode: string;
  incomeTaxNumber: string;
  jobTitle: string;
  email: string;
  cellNo: string;
  paymentMethod: StaffMember['paymentMethod'];
  bankId: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  holderRelationship: string;
  holderName: string;
  unitNumber: string;
  complex: string;
  streetNumber: string;
  streetOrFarmName: string;
  suburbOrDistrict: string;
  cityOrTown: string;
  physicalCode: string;
  postalSameAsPhysical: boolean;
  postalLine1: string;
  postalLine2: string;
  postalLine3: string;
  postalCode: string;
  status: StaffMember['status'];
  rateGroupId: string;
  rateTierId: string;
}

export const EMPTY_STAFF_FORM: StaffFormData = {
  number: '',
  firstName: '',
  lastName: '',
  birthdate: '',
  appointmentDate: '',
  identificationType: 'rsa_id',
  idNumber: '',
  otherNumber: '',
  passportCountryCode: '',
  incomeTaxNumber: '',
  jobTitle: '',
  email: '',
  cellNo: '',
  paymentMethod: 'eft_manual',
  bankId: '',
  accountNumber: '',
  branchCode: '',
  accountType: '',
  holderRelationship: '1',
  holderName: '',
  unitNumber: '',
  complex: '',
  streetNumber: '',
  streetOrFarmName: '',
  suburbOrDistrict: '',
  cityOrTown: '',
  physicalCode: '',
  postalSameAsPhysical: true,
  postalLine1: '',
  postalLine2: '',
  postalLine3: '',
  postalCode: '',
  status: 'active',
  rateGroupId: '',
  rateTierId: '',
};

export function staffToFormData(s: StaffMember): StaffFormData {
  return {
    number: s.number || '',
    firstName: s.firstName || '',
    lastName: s.lastName || '',
    birthdate: s.birthdate || '',
    appointmentDate: s.appointmentDate || '',
    identificationType: s.identificationType || 'rsa_id',
    idNumber: s.idNumber || '',
    otherNumber: s.otherNumber || '',
    passportCountryCode: s.passportCountryCode || '',
    incomeTaxNumber: s.incomeTaxNumber || '',
    jobTitle: s.jobTitle || '',
    email: s.email || '',
    cellNo: s.cellNo || '',
    paymentMethod: s.paymentMethod || 'eft_manual',
    bankId: s.bankAccount?.bankId || '',
    accountNumber: s.bankAccount?.accountNumber || '',
    branchCode: s.bankAccount?.branchCode || '',
    accountType: s.bankAccount?.accountType || '',
    holderRelationship: s.bankAccount?.holderRelationship || '1',
    holderName: s.bankAccount?.holderName || '',
    unitNumber: s.physicalAddress?.unitNumber || '',
    complex: s.physicalAddress?.complex || '',
    streetNumber: s.physicalAddress?.streetNumber || '',
    streetOrFarmName: s.physicalAddress?.streetOrFarmName || '',
    suburbOrDistrict: s.physicalAddress?.suburbOrDistrict || '',
    cityOrTown: s.physicalAddress?.cityOrTown || '',
    physicalCode: s.physicalAddress?.code || '',
    postalSameAsPhysical: s.postalAddress?.sameAsPhysical ?? true,
    postalLine1: s.postalAddress?.line1 || '',
    postalLine2: s.postalAddress?.line2 || '',
    postalLine3: s.postalAddress?.line3 || '',
    postalCode: s.postalAddress?.code || '',
    status: s.status || 'active',
    rateGroupId: s.rateGroupId || '',
    rateTierId: s.rateTierId || '',
  };
}

export function formDataToStaff(f: StaffFormData): Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  return {
    number: f.number.trim() || undefined,
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    birthdate: f.birthdate || undefined,
    appointmentDate: f.appointmentDate || undefined,
    identificationType: f.identificationType,
    idNumber: f.idNumber.trim() || undefined,
    otherNumber: f.otherNumber.trim() || undefined,
    passportCountryCode: f.passportCountryCode || undefined,
    incomeTaxNumber: f.incomeTaxNumber.trim() || undefined,
    jobTitle: f.jobTitle.trim() || undefined,
    email: f.email.trim() || undefined,
    cellNo: f.cellNo.trim() || undefined,
    paymentMethod: f.paymentMethod,
    bankAccount: {
      bankId: f.bankId || undefined,
      accountNumber: f.accountNumber.trim() || undefined,
      branchCode: f.branchCode.trim() || undefined,
      accountType: f.accountType || undefined,
      holderRelationship: f.holderRelationship || undefined,
      holderName: f.holderName.trim() || undefined,
    },
    physicalAddress: {
      unitNumber: f.unitNumber.trim() || undefined,
      complex: f.complex.trim() || undefined,
      streetNumber: f.streetNumber.trim() || undefined,
      streetOrFarmName: f.streetOrFarmName.trim() || undefined,
      suburbOrDistrict: f.suburbOrDistrict.trim() || undefined,
      cityOrTown: f.cityOrTown.trim() || undefined,
      code: f.physicalCode.trim() || undefined,
    },
    postalAddress: {
      sameAsPhysical: f.postalSameAsPhysical,
      line1: f.postalSameAsPhysical ? undefined : (f.postalLine1.trim() || undefined),
      line2: f.postalSameAsPhysical ? undefined : (f.postalLine2.trim() || undefined),
      line3: f.postalSameAsPhysical ? undefined : (f.postalLine3.trim() || undefined),
      code: f.postalSameAsPhysical ? undefined : (f.postalCode.trim() || undefined),
    },
    status: f.status,
    rateGroupId: f.rateGroupId || undefined,
    rateTierId: f.rateGroupId ? (f.rateTierId || undefined) : undefined,
  };
}
