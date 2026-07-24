import {
  collectContactTags,
  contactHasEmail,
  contactHasNotes,
  contactHasPhone,
  contactIsRecentlyUpdated,
  contactMatchesListFilter,
  contactMatchesTagFilter,
} from '../contactListFilter';

const base = {
  id: '1',
  contactNumber: 'C1',
  contactType: 'company' as const,
  companyName: 'Acme',
  contactPersons: [],
  addresses: [],
  email: 'a@example.com',
  phone: '070',
  phone2: '',
  website: '',
  taxRate: '',
  paymentTerms: '',
  currency: '',
  fTax: '',
  notes: '',
  tags: [] as string[],
  isAssignable: false,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(),
};

describe('contactListFilter', () => {
  it('detects email, phone, notes', () => {
    expect(contactHasEmail(base)).toBe(true);
    expect(contactHasEmail({ ...base, email: '  ' })).toBe(false);
    expect(contactHasPhone(base)).toBe(true);
    expect(contactHasPhone({ ...base, phone: '', phone2: '1' })).toBe(true);
    expect(contactHasNotes({ ...base, notes: 'hi' })).toBe(true);
    expect(contactHasNotes(base)).toBe(false);
  });

  it('detects recently updated within 7 days', () => {
    const now = new Date(2026, 6, 20).getTime();
    expect(contactIsRecentlyUpdated({ updatedAt: new Date(2026, 6, 18) }, now)).toBe(true);
    expect(contactIsRecentlyUpdated({ updatedAt: new Date(2026, 5, 1) }, now)).toBe(false);
  });

  it('matches primary filters', () => {
    const empty = new Set<string | number>();
    expect(contactMatchesListFilter(base, 'company', empty)).toBe(true);
    expect(contactMatchesListFilter(base, 'private', empty)).toBe(false);
    expect(contactMatchesListFilter({ ...base, isAssignable: true }, 'assignable', empty)).toBe(
      true,
    );
    expect(contactMatchesListFilter(base, 'withEmail', empty)).toBe(true);
  });

  it('matches tag filter and collects unique tags', () => {
    const tagged = { ...base, tags: ['vip', 'client'] };
    expect(contactMatchesTagFilter(tagged, 'all')).toBe(true);
    expect(contactMatchesTagFilter(tagged, 'vip')).toBe(true);
    expect(contactMatchesTagFilter(tagged, 'other')).toBe(false);
    expect(collectContactTags([tagged, { tags: ['vip', 'a'] }])).toEqual(['a', 'client', 'vip']);
  });
});
