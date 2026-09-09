import { orderItemsByBrowseIds } from '../orderItemsByBrowseIds';

describe('orderItemsByBrowseIds', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('returns items unchanged when browse order is empty', () => {
    expect(orderItemsByBrowseIds(items, [])).toBe(items);
    expect(orderItemsByBrowseIds(items, null)).toBe(items);
    expect(orderItemsByBrowseIds(items, undefined)).toBe(items);
  });

  it('orders by the visible list ids and drops ids not in items', () => {
    expect(orderItemsByBrowseIds(items, ['c', 'a', 'missing', 'b'])).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('does not append items omitted from browse order (filtered out)', () => {
    expect(orderItemsByBrowseIds(items, ['b', 'a'])).toEqual([{ id: 'b' }, { id: 'a' }]);
  });
});
