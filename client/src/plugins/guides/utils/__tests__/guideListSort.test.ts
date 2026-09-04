import { compareGuidesByField, isGuideAscDefaultField } from '../guideListSort';

const base = {
  id: '10',
  displayName: 'Alpha',
  updatedAt: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
  createdAt: new Date(2026, 6, 1).toISOString(),
  lifecycleStatus: 'active' as const,
  languages: ['en'],
};

describe('guideListSort', () => {
  it('sorts by displayName', () => {
    expect(
      compareGuidesByField(base, { ...base, displayName: 'Beta' }, 'displayName', 'asc'),
    ).toBeLessThan(0);
  });

  it('sorts by numeric id', () => {
    expect(compareGuidesByField(base, { ...base, id: '2' }, 'id', 'asc')).toBeGreaterThan(0);
  });

  it('sorts by languages count and lifecycle', () => {
    expect(
      compareGuidesByField(base, { ...base, languages: ['en', 'sv'] }, 'languages', 'asc'),
    ).toBeLessThan(0);
    expect(
      compareGuidesByField(
        { ...base, lifecycleStatus: 'active' },
        { ...base, lifecycleStatus: 'draft' },
        'lifecycleStatus',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('default order helpers', () => {
    expect(isGuideAscDefaultField('displayName')).toBe(true);
    expect(isGuideAscDefaultField('updatedAt')).toBe(false);
    expect(isGuideAscDefaultField('languages')).toBe(false);
  });
});
