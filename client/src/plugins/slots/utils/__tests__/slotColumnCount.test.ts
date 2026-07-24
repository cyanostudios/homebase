import {
  isSlotColumnCount,
  parseStoredSlotColumnCount,
  resolveSlotColumnCount,
} from '../slotColumnCount';

describe('resolveSlotColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveSlotColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveSlotColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveSlotColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveSlotColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveSlotColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveSlotColumnCount(null)).toBe(1);
    expect(resolveSlotColumnCount({})).toBe(1);
  });

  it('does not allow 4 columns', () => {
    expect(resolveSlotColumnCount({ columnCount: 4 })).toBe(1);
  });
});

describe('isSlotColumnCount / parseStoredSlotColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isSlotColumnCount(1)).toBe(true);
    expect(isSlotColumnCount(4)).toBe(false);
    expect(parseStoredSlotColumnCount('2')).toBe(2);
    expect(parseStoredSlotColumnCount('grid')).toBe(null);
  });
});
