import { compareCupsByField, compareCupsTwoLevel, isCupAscDefaultField } from '../cupListSort';

const base = {
  name: 'Alpha Cup',
  location: 'Stockholm',
  start_date: '2026-07-10T08:00:00.000Z',
  updated_at: '2026-07-10T08:00:00.000Z',
  ingest_source_id: null as string | null,
  featured: false,
  ratings_count: 2,
  visible: true,
};

describe('cupListSort', () => {
  it('sorts by name', () => {
    expect(compareCupsByField(base, { ...base, name: 'Beta Cup' }, 'name', 'asc')).toBeLessThan(0);
  });

  it('breaks ties with secondary', () => {
    const a = { ...base, name: 'Same', location: 'A' };
    const b = { ...base, name: 'Same', location: 'B' };
    expect(compareCupsTwoLevel(a, b, 'name', 'location', 'asc')).toBeLessThan(0);
  });

  it('with date primary + secondary, reorders same-day by secondary', () => {
    const earlier = {
      ...base,
      name: 'Zulu',
      start_date: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
    };
    const later = {
      ...base,
      name: 'Alpha',
      start_date: new Date(2026, 6, 10, 18, 0, 0).toISOString(),
    };
    expect(compareCupsTwoLevel(earlier, later, 'start_date', 'name', 'asc')).toBeGreaterThan(0);
  });

  it('sorts featured, visible, ratings_count', () => {
    expect(
      compareCupsByField(
        { ...base, featured: false },
        { ...base, featured: true },
        'featured',
        'asc',
      ),
    ).toBeLessThan(0);
    expect(
      compareCupsByField({ ...base, visible: false }, { ...base, visible: true }, 'visible', 'asc'),
    ).toBeLessThan(0);
    expect(
      compareCupsByField(
        { ...base, ratings_count: 1 },
        { ...base, ratings_count: 5 },
        'ratings_count',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('default order helpers', () => {
    expect(isCupAscDefaultField('name')).toBe(true);
    expect(isCupAscDefaultField('updatedAt')).toBe(false);
  });
});
