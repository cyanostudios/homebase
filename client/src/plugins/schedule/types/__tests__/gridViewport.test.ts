import {
  FULL_DAY_GRID_SETTINGS,
  getGridHeightPx,
  getPreferredScrollTopPx,
  getPreferredViewportHeightPx,
  GRID_ROW_HEIGHT_PX,
  GRID_SLOT_MINUTES,
  isSlotVisibleInGrid,
  type ScheduleSlot,
} from '../../types/schedule';

describe('full-day grid viewport helpers', () => {
  it('defines a 0–24 rendered extent', () => {
    expect(FULL_DAY_GRID_SETTINGS).toEqual({ startHour: 0, endHour: 24 });
    expect(getGridHeightPx(FULL_DAY_GRID_SETTINGS)).toBe(
      ((24 * 60) / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX,
    );
  });

  it('sizes the preferred viewport to Visade tider span', () => {
    expect(getPreferredViewportHeightPx({ startHour: 16, endHour: 22 })).toBe(
      ((6 * 60) / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX,
    );
  });

  it('scrolls so preferred startHour is at the top', () => {
    expect(getPreferredScrollTopPx({ startHour: 16, endHour: 22 })).toBe(
      ((16 * 60) / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX,
    );
    expect(getPreferredScrollTopPx({ startHour: 0, endHour: 24 })).toBe(0);
  });

  it('keeps isSlotVisibleInGrid as preferred-window overlap helper', () => {
    const slot: ScheduleSlot = {
      day: 'monday',
      startTime: '14:00',
      endTime: '15:00',
      location: '',
      trainingIndex: 0,
    };
    expect(isSlotVisibleInGrid(slot, { startHour: 16, endHour: 22 })).toBe(false);
    expect(isSlotVisibleInGrid(slot, FULL_DAY_GRID_SETTINGS)).toBe(true);
  });
});
