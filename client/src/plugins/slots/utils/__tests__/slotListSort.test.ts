import { compareSlotsByField, isSlotAscDefaultField } from '../slotListSort';

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
