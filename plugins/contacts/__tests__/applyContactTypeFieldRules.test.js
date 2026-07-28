const {
  applyContactTypeFieldRules,
  normalizeStoredContactType,
} = require('../applyContactTypeFieldRules');

describe('normalizeStoredContactType', () => {
  it('maps private (any case) to private', () => {
    expect(normalizeStoredContactType('private')).toBe('private');
    expect(normalizeStoredContactType('Private')).toBe('private');
    expect(normalizeStoredContactType(' PRIVATE ')).toBe('private');
  });

  it('defaults everything else to company', () => {
    expect(normalizeStoredContactType('company')).toBe('company');
    expect(normalizeStoredContactType('')).toBe('company');
    expect(normalizeStoredContactType(undefined)).toBe('company');
    expect(normalizeStoredContactType('other')).toBe('company');
  });
});

describe('applyContactTypeFieldRules', () => {
  const companyData = {
    companyType: 'AB',
    organizationNumber: '556677-8899',
    vatNumber: 'SE556677889901',
    taxRate: '25',
    fTax: 'yes',
  };

  it('clears company fields and forces tax_rate 0 / empty f_tax for private', () => {
    expect(applyContactTypeFieldRules('private', companyData)).toEqual({
      company_type: '',
      organization_number: '',
      vat_number: '',
      tax_rate: 0,
      f_tax: '',
    });
  });

  it('passes through company fields with tax_rate coerced', () => {
    expect(applyContactTypeFieldRules('company', companyData)).toEqual({
      company_type: 'AB',
      organization_number: '556677-8899',
      vat_number: 'SE556677889901',
      tax_rate: 25,
      f_tax: 'yes',
    });
  });

  it('coerces empty company tax_rate to null', () => {
    expect(
      applyContactTypeFieldRules('company', {
        ...companyData,
        taxRate: '',
        fTax: '',
      }),
    ).toMatchObject({
      tax_rate: null,
      f_tax: '',
    });
  });
});
