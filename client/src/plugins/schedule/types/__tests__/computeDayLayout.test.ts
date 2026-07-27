import { computeDayLayout, getSlotDragId, swapColumnOrder, type ScheduleSlot } from '../schedule';

function makeSlot(
  overrides: Partial<ScheduleSlot> & Pick<ScheduleSlot, 'teamId' | 'startTime' | 'endTime'>,
): ScheduleSlot {
  return {
    day: 'monday',
    location: '',
    trainingIndex: 0,
    teamName: overrides.teamId,
    ...overrides,
  };
}

describe('computeDayLayout column order', () => {
  it('assigns left/right by start time when no column order is set', () => {
    const a = makeSlot({ teamId: '1', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });
    const b = makeSlot({ teamId: '2', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });

    const layout = computeDayLayout([a, b]);
    expect(layout).toHaveLength(2);
    expect(layout.every((item) => item.colCount === 2)).toBe(true);
  });

  it('respects dayColumnOrder for same-start overlapping slots', () => {
    const a = makeSlot({ teamId: '1', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });
    const b = makeSlot({ teamId: '2', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });
    const order = [getSlotDragId(b), getSlotDragId(a)];

    const layout = computeDayLayout([a, b], order);
    const byId = Object.fromEntries(
      layout.map((item) => [getSlotDragId(item.slot), item.colIndex]),
    );

    expect(byId[getSlotDragId(b)]).toBe(0);
    expect(byId[getSlotDragId(a)]).toBe(1);
  });
});

describe('swapColumnOrder', () => {
  it('swaps two overlapping slot ids in the day order', () => {
    const a = makeSlot({ teamId: '1', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });
    const b = makeSlot({ teamId: '2', startTime: '10:00', endTime: '11:00', trainingIndex: 0 });
    const idA = getSlotDragId(a);
    const idB = getSlotDragId(b);

    const swapped = swapColumnOrder([a, b], [idA, idB], a, b);
    expect(swapped).toEqual([idB, idA]);
  });
});
