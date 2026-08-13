import {
  EMPTY_ORGANIZATION,
  getSidebarOrganizationLines,
  normalizeOrganizationProfile,
} from '../organizationApi';

describe('normalizeOrganizationProfile', () => {
  test('returns empty shape for null/invalid input', () => {
    expect(normalizeOrganizationProfile(null)).toEqual(EMPTY_ORGANIZATION);
    expect(normalizeOrganizationProfile('x')).toEqual(EMPTY_ORGANIZATION);
  });

  test('fills missing nested address and billing fields', () => {
    expect(
      normalizeOrganizationProfile({
        name: ' Acme ',
        billing: { organizationNumber: ' 556677-8899 ', swishNumber: ' 123 456 78 90 ' },
        address: { line1: ' Storgatan 1 ' },
      }),
    ).toEqual({
      name: 'Acme',
      logoUrl: '',
      website: '',
      email: '',
      phone: '',
      address: {
        line1: 'Storgatan 1',
        line2: '',
        postalCode: '',
        city: '',
        country: '',
      },
      billing: {
        organizationNumber: '556677-8899',
        vatNumber: '',
        bankgiro: '',
        plusgiro: '',
        iban: '',
        bic: '',
        invoiceEmail: '',
        swishNumber: '123 456 78 90',
      },
    });
  });

  test('migrates legacy billing.phone to top-level phone', () => {
    expect(normalizeOrganizationProfile({ billing: { phone: ' 070-111 22 33 ' } }).phone).toBe(
      '070-111 22 33',
    );
  });
});

describe('getSidebarOrganizationLines', () => {
  test('includes address and swish when present', () => {
    const lines = getSidebarOrganizationLines({
      billing: {
        organizationNumber: '8025454896',
        swishNumber: '123 146 77 86',
      },
      address: { line1: 'Nobelvägen 21' },
      website: 'https://www.example.com/',
      email: 'info@example.com',
    });

    expect(lines.orgNumber).toBe('8025454896');
    expect(lines.addressLines).toEqual(['Nobelvägen 21']);
    expect(lines.websiteHref).toBe('https://www.example.com/');
    expect(lines.websiteLabel).toBe('www.example.com');
    expect(lines.email).toBe('info@example.com');
    expect(lines.swish).toBe('123 146 77 86');
    expect(lines.hasContent).toBe(true);
  });

  test('survives incomplete payloads without throwing', () => {
    expect(() => getSidebarOrganizationLines({})).not.toThrow();
    expect(() => getSidebarOrganizationLines({ billing: null, address: null })).not.toThrow();
    expect(getSidebarOrganizationLines({}).hasContent).toBe(false);
  });
});
