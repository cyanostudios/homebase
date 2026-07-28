import { formatCompanyTypeLabel } from '../../types/contacts';

describe('formatCompanyTypeLabel', () => {
  it('maps known codes to dropdown labels', () => {
    expect(formatCompanyTypeLabel('AB')).toBe('AB (Aktiebolag)');
    expect(formatCompanyTypeLabel('HB')).toBe('HB (Handelsbolag)');
    expect(formatCompanyTypeLabel('KB')).toBe('KB (Kommanditbolag)');
    expect(formatCompanyTypeLabel('EF')).toBe('Enskild Firma');
  });

  it('returns em dash for empty values', () => {
    expect(formatCompanyTypeLabel(undefined)).toBe('—');
    expect(formatCompanyTypeLabel(null)).toBe('—');
    expect(formatCompanyTypeLabel('')).toBe('—');
    expect(formatCompanyTypeLabel('   ')).toBe('—');
  });

  it('returns raw value for unknown codes', () => {
    expect(formatCompanyTypeLabel('XYZ')).toBe('XYZ');
  });
});
