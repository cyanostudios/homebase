import { countItemsWithTag, itemMatchesSelectedTags, toggleTagFilter } from '../listTagFilter';

describe('listTagFilter', () => {
  const items = [{ tags: ['A', 'B'] }, { tags: ['B'] }, { tags: [] }, {}];

  test('empty selection matches every item', () => {
    expect(items.every((item) => itemMatchesSelectedTags(item, []))).toBe(true);
  });

  test('selected tags match with OR', () => {
    expect(itemMatchesSelectedTags(items[0], ['A', 'C'])).toBe(true);
    expect(itemMatchesSelectedTags(items[1], ['A'])).toBe(false);
    expect(itemMatchesSelectedTags(items[2], ['A', 'B'])).toBe(false);
  });

  test('count and toggle', () => {
    expect(countItemsWithTag(items, 'B')).toBe(2);
    expect(toggleTagFilter(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleTagFilter(['A', 'B'], 'A')).toEqual(['B']);
  });
});
