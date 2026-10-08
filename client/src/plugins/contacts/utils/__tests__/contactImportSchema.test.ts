import { buildAutoMapping } from '@/core/utils/importUtils';

import { getContactImportSchema } from '../contactImportSchema';

/** Typical Fortnox customer export headers (SV) including Kundnummer — must not map to schema. */
const FORTNOX_CUSTOMER_HEADERS = [
  'Namn',
  'Kundnummer',
  'Typ',
  'Organisationsnummer',
  'Personnummer',
  'Momsregistreringsnummer',
  'Gatuadress 1',
  'Gatuadress 2',
  'Postnummer',
  'Ort',
  'Land',
  'Kontaktperson',
  'E-post',
  'Telefon',
  'Betalningsvillkor',
  'Leveransvillkor',
];

describe('getContactImportSchema / buildAutoMapping', () => {
  it('auto-maps Fortnox headers and ignores Customer number', () => {
    const schema = getContactImportSchema();
    const mapping = buildAutoMapping(FORTNOX_CUSTOMER_HEADERS, schema);

    const kundnummerIndex = FORTNOX_CUSTOMER_HEADERS.indexOf('Kundnummer');
    expect(kundnummerIndex).toBe(1);

    expect(mapping.companyName).toBe(0);
    expect(mapping.contactType).toBe(2);
    expect(mapping.organisationNumber).toBe(3);
    expect(mapping.personalNumber).toBe(4);
    expect(mapping.vatNumber).toBe(5);
    expect(mapping.addressLine1).toBe(6);
    expect(mapping.addressLine2).toBe(7);
    expect(mapping.postalCode).toBe(8);
    expect(mapping.city).toBe(9);
    expect(mapping.country).toBe(10);
    expect(mapping.contactPersonName).toBe(11);
    expect(mapping.email).toBe(12);
    expect(mapping.phone).toBe(13);
    expect(mapping.paymentTerms).toBe(14);
    expect(mapping.deliveryTerms).toBe(15);

    const mappedIndices = Object.values(mapping).filter((idx) => idx >= 0);
    expect(mappedIndices).not.toContain(kundnummerIndex);

    expect(Object.keys(mapping)).not.toContain('contactNumber');
    expect(Object.keys(mapping)).not.toContain('customerNumber');
  });
});
