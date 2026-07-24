import { compareSlotsByField, compareSlotsTwoLevel, isSlotAscDefaultField } from '../slotListSort';

const base = {
  name: 'Alpha',
  location: 'Pitch A',
  slot_time: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
  updated_at: new Date(2026, 6, 1).toISOString(),
  category: 'training',
  visible: true,
  booked_count: 1,
};

describe('slotListSort', () => {
  it('sorts by name with location fallback', () => {
    expect(
      compareSlotsByField(
        { ...base, name: '', location: 'A' },
        { ...base, name: '', location: 'B' },
        'name',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('breaks ties with secondary', () => {
    const a = { ...base, location: 'Same', name: 'A' };
    const b = { ...base, location: 'Same', name: 'B' };
    expect(compareSlotsTwoLevel(a, b, 'location', 'name', 'asc')).toBeLessThan(0);
  });

  it('with date primary + secondary, reorders same-day by secondary', () => {
    const earlier = {
      ...base,
      name: 'Zulu',
      slot_time: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
    };
    const later = {
      ...base,
      name: 'Alpha',
      slot_time: new Date(2026, 6, 10, 18, 0, 0).toISOString(),
    };
    expect(compareSlotsTwoLevel(earlier, later, 'slot_time', 'name', 'asc')).toBeGreaterThan(0);
  });

  it('sorts category, visible, booked_count', () => {
    expect(
      compareSlotsByField(base, { ...base, category: 'match' }, 'category', 'asc'),
    ).toBeGreaterThan(0);
    expect(compareSlotsByField({ ...base, visible: false }, base, 'visible', 'asc')).toBeLessThan(
      0,
    );
    expect(
      compareSlotsByField(base, { ...base, booked_count: 5 }, 'booked_count', 'asc'),
    ).toBeLessThan(0);
  });

  it('default order helpers', () => {
    expect(isSlotAscDefaultField('slot_time')).toBe(true);
    expect(isSlotAscDefaultField('updatedAt')).toBe(false);
  });
});
