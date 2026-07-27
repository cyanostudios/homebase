import { normalizeContactType } from '../normalizeContactType';

describe('normalizeContactType', () => {
  it('defaults empty/unknown to company', () => {
    expect(normalizeContactType(undefined)).toBe('company');
    expect(normalizeContactType(null)).toBe('company');
    expect(normalizeContactType('')).toBe('company');
    expect(normalizeContactType('  ')).toBe('company');
    expect(normalizeContactType('other')).toBe('company');
  });

  it('accepts canonical and common labels', () => {
    expect(normalizeContactType('company')).toBe('company');
    expect(normalizeContactType('Company')).toBe('company');
    expect(normalizeContactType('Företag')).toBe('company');
    expect(normalizeContactType('private')).toBe('private');
    expect(normalizeContactType('Private')).toBe('private');
    expect(normalizeContactType('Privat')).toBe('private');
    expect(normalizeContactType('person')).toBe('private');
  });
});
