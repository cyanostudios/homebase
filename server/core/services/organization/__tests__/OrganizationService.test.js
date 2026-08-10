const { normalizeOrganization, EMPTY_ORGANIZATION } = require('../OrganizationService');

describe('normalizeOrganization', () => {
  test('returns empty shape for null/invalid input', () => {
    expect(normalizeOrganization(null)).toEqual(EMPTY_ORGANIZATION);
    expect(normalizeOrganization('x')).toEqual(EMPTY_ORGANIZATION);
  });

  test('trims strings and keeps known nested fields', () => {
    expect(
      normalizeOrganization({
        name: '  Acme  ',
        logoUrl: ' https://example.com/logo.png ',
        website: ' https://acme.example ',
        email: ' hello@acme.example ',
        address: { line1: ' Storgatan 1 ', city: ' Stockholm ', extra: 'drop' },
        billing: { organizationNumber: ' 556677-8899 ', bankgiro: '123' },
        unknown: true,
      }),
    ).toEqual({
      name: 'Acme',
      logoUrl: 'https://example.com/logo.png',
      website: 'https://acme.example',
      email: 'hello@acme.example',
      address: {
        line1: 'Storgatan 1',
        line2: '',
        postalCode: '',
        city: 'Stockholm',
        country: '',
      },
      billing: {
        organizationNumber: '556677-8899',
        vatNumber: '',
        bankgiro: '123',
        plusgiro: '',
        iban: '',
        bic: '',
        invoiceEmail: '',
        phone: '',
      },
    });
  });

  test('truncates website and email to 255 characters', () => {
    const long = `https://example.com/${'x'.repeat(300)}`;
    const normalized = normalizeOrganization({ website: long, email: `${'a'.repeat(300)}@x.com` });
    expect(normalized.website).toHaveLength(255);
    expect(normalized.email).toHaveLength(255);
  });
});
