import {
  compareContactsByField,
  compareContactsTwoLevel,
  getContactTimeRank,
  isContactAscDefaultField,
} from '../contactListSort';

const base = {
  id: '1',
  companyName: 'Alpha',
  contactType: 'company' as const,
  email: 'a@example.com',
  phone: '070111',
  phone2: '',
  tags: ['vip'] as string[],
  isAssignable: true,
  updatedAt: new Date(2026, 6, 10, 8, 0, 0),
  createdAt: new Date(2026, 6, 1),
};

describe('contactListSort', () => {
  it('sorts by name', () => {
    expect(
      compareContactsByField(base, { ...base, companyName: 'Beta' }, 'name', 'asc'),
    ).toBeLessThan(0);
  });

  it('breaks ties with secondary', () => {
    const a = { ...base, companyName: 'Same', email: 'a@x.com' };
    const b = { ...base, id: '2', companyName: 'Same', email: 'b@x.com' };
    expect(compareContactsTwoLevel(a, b, 'name', 'email', 'asc')).toBeLessThan(0);
  });

  it('ranks time: active > logged > none', () => {
    const ctx = {
      activeTimeTrackingContactId: '1',
      contactIdsWithTimeEntries: new Set<string | number>(['2']),
    };
    expect(getContactTimeRank({ id: '1' }, ctx)).toBe(2);
    expect(getContactTimeRank({ id: '2' }, ctx)).toBe(1);
    expect(getContactTimeRank({ id: '3' }, ctx)).toBe(0);
    expect(
      compareContactsByField(
        { ...base, id: '1' },
        { ...base, id: '2', companyName: 'Beta' },
        'time',
        'desc',
        ctx,
      ),
    ).toBeLessThan(0);
  });

  it('with date primary + secondary, reorders same-day by secondary', () => {
    const earlier = {
      ...base,
      companyName: 'Zulu',
      updatedAt: new Date(2026, 6, 10, 8, 0, 0),
    };
    const later = {
      ...base,
      id: '2',
      companyName: 'Alpha',
      updatedAt: new Date(2026, 6, 10, 18, 0, 0),
    };
    expect(compareContactsTwoLevel(earlier, later, 'updatedAt', 'name', 'asc')).toBeGreaterThan(0);
  });

  it('sorts phone and assignable', () => {
    expect(compareContactsByField(base, { ...base, phone: '070222' }, 'phone', 'asc')).toBeLessThan(
      0,
    );
    expect(
      compareContactsByField(
        { ...base, isAssignable: false },
        { ...base, isAssignable: true },
        'assignable',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('default order helpers', () => {
    expect(isContactAscDefaultField('name')).toBe(true);
    expect(isContactAscDefaultField('updatedAt')).toBe(false);
  });
});
