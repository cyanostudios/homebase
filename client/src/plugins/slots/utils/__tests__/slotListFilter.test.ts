import {
  slotHasCategory,
  slotIsUpcoming,
  slotIsVisible,
  slotMatchesListFilters,
  toggleSlotListFilter,
} from '../slotListFilter';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');

describe('slotListFilter', () => {
  it('detects visible, upcoming, and category', () => {
    expect(slotIsVisible({ visible: true })).toBe(true);
    expect(slotIsVisible({ visible: false })).toBe(false);
    expect(slotIsUpcoming({ slot_time: '2026-08-08T12:00:00.000Z' }, NOW)).toBe(true);
    expect(slotIsUpcoming({ slot_time: '2026-08-01T12:00:00.000Z' }, NOW)).toBe(false);
    expect(slotHasCategory({ category: 'Training' })).toBe(true);
    expect(slotHasCategory({ category: '  ' })).toBe(false);
  });

  it('ANDs facets; empty selection matches all', () => {
    const slot = {
      visible: true,
      slot_time: '2026-08-10T12:00:00.000Z',
      category: 'Match',
    };
    expect(slotMatchesListFilters(slot, [], NOW)).toBe(true);
    expect(slotMatchesListFilters(slot, ['visible', 'upcoming'], NOW)).toBe(true);
    expect(slotMatchesListFilters({ ...slot, visible: false }, ['visible', 'upcoming'], NOW)).toBe(
      false,
    );
  });

  it('toggles facets independently', () => {
    expect(toggleSlotListFilter([], 'visible')).toEqual(['visible']);
    expect(toggleSlotListFilter(['visible'], 'withCategory')).toEqual(['visible', 'withCategory']);
    expect(toggleSlotListFilter(['visible', 'withCategory'], 'visible')).toEqual(['withCategory']);
  });
});
