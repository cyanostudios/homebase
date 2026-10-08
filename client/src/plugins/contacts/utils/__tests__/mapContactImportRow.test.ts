import {
  extractPaymentTermsDigits,
  isSwedishPersonalNumber,
  mapContactImportRow,
} from '../mapContactImportRow';

describe('isSwedishPersonalNumber', () => {
  it('accepts valid 10-digit personnummer', () => {
    expect(isSwedishPersonalNumber('830908-8584')).toBe(true);
    expect(isSwedishPersonalNumber('8309088584')).toBe(true);
  });

  it('strips century from 12-digit values', () => {
    expect(isSwedishPersonalNumber('198309088584')).toBe(true);
  });

  it('handles samordningsnummer day offset (+60)', () => {
    expect(isSwedishPersonalNumber('830968-8584')).toBe(true);
  });

  it('rejects invalid month/day or wrong length', () => {
    expect(isSwedishPersonalNumber('')).toBe(false);
    expect(isSwedishPersonalNumber('123')).toBe(false);
    expect(isSwedishPersonalNumber('9913088584')).toBe(false);
    expect(isSwedishPersonalNumber('8300328584')).toBe(false);
    expect(isSwedishPersonalNumber('5560160680')).toBe(false);
  });
});

describe('extractPaymentTermsDigits', () => {
  it('returns first digit run from free text', () => {
    expect(extractPaymentTermsDigits('30 dagar')).toBe('30');
    expect(extractPaymentTermsDigits('14')).toBe('14');
    expect(extractPaymentTermsDigits('')).toBe('');
    expect(extractPaymentTermsDigits('Net 45')).toBe('45');
  });
});

describe('mapContactImportRow', () => {
  const fixedNow = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps company row with org number and billing address defaults', () => {
    const payload = mapContactImportRow({
      companyName: 'Acme AB',
      contactType: 'company',
      organisationNumber: '5560160680',
      personalNumber: '',
      vatNumber: 'SE556016068001',
      addressLine1: 'Storgatan 1',
      addressLine2: 'Box 1',
      postalCode: '11122',
      city: 'Stockholm',
      country: '',
      contactPersonName: 'Anna Andersson',
      email: 'info@acme.se',
      phone: '0701234567',
      paymentTerms: '30 dagar',
      notes: 'VIP',
      deliveryTerms: 'FOB',
      companyType: 'AB',
      phone2: '08-123',
      website: 'https://acme.se',
      taxRate: '25',
      currency: 'SEK',
      fTax: 'yes',
    });

    expect(payload.contactType).toBe('company');
    expect(payload.organizationNumber).toBe('5560160680');
    expect(payload.personalNumber).toBe('');
    expect(payload.paymentTerms).toBe('30');
    expect(payload.notes).toBe('VIP');
    expect(payload.addresses).toEqual([
      {
        id: String(fixedNow),
        type: 'Billing Address',
        addressLine1: 'Storgatan 1',
        addressLine2: 'Box 1',
        postalCode: '11122',
        city: 'Stockholm',
        region: '',
        country: 'Sweden',
        email: '',
      },
    ]);
    expect(payload.contactPersons).toEqual([
      {
        id: String(fixedNow),
        name: 'Anna Andersson',
        title: '',
        email: '',
        phone: '',
      },
    ]);
  });

  it('infers private when type empty and org field is personnummer', () => {
    const payload = mapContactImportRow({
      companyName: 'Erik Eriksson',
      contactType: '',
      organisationNumber: '830908-8584',
      personalNumber: '',
      addressLine1: 'Lillgatan 2',
      postalCode: '22222',
      city: 'Göteborg',
      paymentTerms: '14',
    });

    expect(payload.contactType).toBe('private');
    expect(payload.organizationNumber).toBe('');
    expect(payload.personalNumber).toBe('830908-8584');
  });

  it('uses delivery terms as notes when notes empty', () => {
    const payload = mapContactImportRow({
      companyName: 'Test AB',
      contactType: 'company',
      organisationNumber: '5560160680',
      notes: '',
      deliveryTerms: 'Leverans inom 5 dagar',
    });

    expect(payload.notes).toBe('Leverans inom 5 dagar');
  });

  it('omits addresses and contact persons when empty', () => {
    const payload = mapContactImportRow({
      companyName: 'Minimal Co',
      contactType: 'företag',
      organisationNumber: '5560160680',
    });

    expect(payload.contactType).toBe('company');
    expect(payload.addresses).toEqual([]);
    expect(payload.contactPersons).toEqual([]);
  });
});
