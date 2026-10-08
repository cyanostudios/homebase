import type { ImportSchema } from '@/core/utils/importUtils';

/**
 * English labels for auto-mapping (platform convention). Aliases cover common SV/EN
 * exports and Fortnox customer export headers so a Fortnox CSV auto-maps without edits.
 */
export function getContactImportSchema(): ImportSchema {
  return {
    fields: [
      { key: 'companyName', label: 'Name', required: true, aliases: ['Namn', 'Kundnamn'] },
      { key: 'contactType', label: 'Type', required: false, aliases: ['Typ'] },
      {
        key: 'organisationNumber',
        label: 'Organisation number',
        required: false,
        aliases: ['Organisationsnummer', 'Org.nr', 'Orgnr'],
      },
      {
        key: 'personalNumber',
        label: 'Personal number',
        required: false,
        aliases: ['Personnummer'],
      },
      {
        key: 'vatNumber',
        label: 'Vat number',
        required: false,
        aliases: ['VAT-nummer', 'Momsregistreringsnummer', 'VAT number'],
      },
      {
        key: 'addressLine1',
        label: 'Street 1',
        required: false,
        aliases: ['Gatuadress 1', 'Adress 1'],
      },
      {
        key: 'addressLine2',
        label: 'Street 2',
        required: false,
        aliases: ['Gatuadress 2', 'Adress 2'],
      },
      { key: 'postalCode', label: 'Postal code', required: false, aliases: ['Postnummer'] },
      { key: 'city', label: 'City', required: false, aliases: ['Stad', 'Ort'] },
      { key: 'country', label: 'Country', required: false, aliases: ['Land'] },
      {
        key: 'contactPersonName',
        label: 'Contact',
        required: false,
        aliases: ['Kontaktperson', 'Contact person'],
      },
      { key: 'email', label: 'Email', required: false, aliases: ['E-post'] },
      { key: 'phone', label: 'Phone', required: false, aliases: ['Telefon'] },
      {
        key: 'paymentTerms',
        label: 'Payment terms',
        required: false,
        aliases: ['Betalningsvillkor'],
      },
      { key: 'notes', label: 'Notes', required: false },
      {
        key: 'deliveryTerms',
        label: 'Delivery terms',
        required: false,
        aliases: ['Leveransvillkor'],
      },
      // Grind 1 Homebase scalars — optional passthrough (English labels match export).
      { key: 'companyType', label: 'Company type', required: false },
      { key: 'phone2', label: 'Phone 2', required: false },
      { key: 'website', label: 'Website', required: false },
      { key: 'taxRate', label: 'Tax rate', required: false },
      { key: 'currency', label: 'Currency', required: false },
      { key: 'fTax', label: 'F-tax', required: false },
    ],
  };
}

/** Two rows — a company and a private contact (heuristic type detection) — for CSV template download. */
export const CONTACT_IMPORT_EXAMPLE_ROWS: Record<string, string>[] = [
  {
    companyName: 'Acme AB',
    contactType: 'company',
    organisationNumber: '5560160680',
    personalNumber: '',
    vatNumber: 'SE556016068001',
    addressLine1: 'Storgatan 1',
    addressLine2: '',
    postalCode: '11122',
    city: 'Stockholm',
    country: 'Sweden',
    contactPersonName: 'Anna Andersson',
    email: 'info@acme.se',
    phone: '0701234567',
    paymentTerms: '30 dagar',
    notes: '',
    deliveryTerms: '',
    companyType: 'AB',
    phone2: '',
    website: 'https://acme.se',
    taxRate: '25',
    currency: 'SEK',
    fTax: 'yes',
  },
  {
    companyName: 'Erik Eriksson',
    contactType: '',
    organisationNumber: '830908-8584',
    personalNumber: '',
    vatNumber: '',
    addressLine1: 'Lillgatan 2',
    addressLine2: '',
    postalCode: '22222',
    city: 'Göteborg',
    country: 'Sweden',
    contactPersonName: '',
    email: 'erik@example.com',
    phone: '0709876543',
    paymentTerms: '14',
    notes: 'Imported sample',
    deliveryTerms: '',
    companyType: '',
    phone2: '',
    website: '',
    taxRate: '',
    currency: '',
    fTax: '',
  },
];
