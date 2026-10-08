import { normalizeContactType } from './normalizeContactType';

export interface MappedImportAddress {
  id: string;
  type: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  region: string;
  country: string;
  email: string;
}

export interface MappedImportContactPerson {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface MappedContactImportPayload {
  companyName: string;
  contactType: 'company' | 'private';
  companyType: string;
  organizationNumber: string;
  personalNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  phone2: string;
  website: string;
  taxRate: string;
  paymentTerms: string;
  currency: string;
  fTax: string;
  notes: string;
  addresses: MappedImportAddress[];
  contactPersons: MappedImportContactPerson[];
}

function str(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? '' : String(value);
}

/**
 * Digits-only Swedish personnummer/samordningsnummer detector.
 * Accepts 10 or 12 digit strings (12-digit century prefix is stripped to the 10-digit
 * core). Validates month (1-12) and day (1-31, with the samordningsnummer +60 offset
 * subtracted before validation).
 */
export function isSwedishPersonalNumber(raw: string | null | undefined): boolean {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return false;
  }

  const core = digits.length === 12 ? digits.slice(2) : digits;
  if (core.length !== 10) {
    return false;
  }

  const month = Number(core.slice(2, 4));
  let day = Number(core.slice(4, 6));
  if (day > 60) {
    day -= 60;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }

  return true;
}

/** First run of digits in a free-text payment terms value (e.g. "30 dagar" -> "30"). */
export function extractPaymentTermsDigits(raw: string | null | undefined): string {
  const match = String(raw ?? '').match(/\d+/);
  return match ? match[0] : '';
}

/**
 * Map one import-wizard row (CSV header → schema key, see `getContactImportSchema`) to a
 * `createContact` payload. Mirrors the manual ContactForm shapes for addresses/contactPersons.
 */
export function mapContactImportRow(row: Record<string, string>): MappedContactImportPayload {
  const typeRaw = str(row.contactType).trim();
  const orgNumberRaw = str(row.organisationNumber).trim();
  const personalNumberRaw = str(row.personalNumber).trim();

  const contactType = typeRaw
    ? normalizeContactType(typeRaw)
    : isSwedishPersonalNumber(orgNumberRaw)
      ? 'private'
      : 'company';

  const organizationNumber = contactType === 'company' ? orgNumberRaw : '';
  const personalNumber = contactType === 'private' ? personalNumberRaw || orgNumberRaw : '';

  const paymentTerms = extractPaymentTermsDigits(row.paymentTerms);

  const notesRaw = str(row.notes).trim();
  const deliveryTermsRaw = str(row.deliveryTerms).trim();
  const notes = notesRaw || deliveryTermsRaw || '';

  const addressLine1 = str(row.addressLine1).trim();
  const addressLine2 = str(row.addressLine2).trim();
  const postalCode = str(row.postalCode).trim();
  const city = str(row.city).trim();
  const country = str(row.country).trim();
  const hasAddress = Boolean(addressLine1 || addressLine2 || postalCode || city || country);

  const addresses: MappedImportAddress[] = hasAddress
    ? [
        {
          id: Date.now().toString(),
          type: 'Billing Address',
          addressLine1,
          addressLine2,
          postalCode,
          city,
          region: '',
          country: country || 'Sweden',
          email: '',
        },
      ]
    : [];

  const contactPersonName = str(row.contactPersonName).trim();
  const contactPersons: MappedImportContactPerson[] = contactPersonName
    ? [
        {
          id: Date.now().toString(),
          name: contactPersonName,
          title: '',
          email: '',
          phone: '',
        },
      ]
    : [];

  return {
    companyName: str(row.companyName).trim(),
    contactType,
    companyType: str(row.companyType).trim(),
    organizationNumber,
    personalNumber,
    vatNumber: str(row.vatNumber).trim(),
    email: str(row.email).trim(),
    phone: str(row.phone).trim(),
    phone2: str(row.phone2).trim(),
    website: str(row.website).trim(),
    taxRate: str(row.taxRate).trim(),
    paymentTerms,
    currency: str(row.currency).trim(),
    fTax: str(row.fTax).trim(),
    notes,
    addresses,
    contactPersons,
  };
}
