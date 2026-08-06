import { sortCategoryNames } from '../sortCategoryNames';

describe('sortCategoryNames', () => {
  test('follows catalog order then orphans then uncategorized', () => {
    expect(
      sortCategoryNames(
        ['Zebra', 'Alpha', 'Beta', '__uncategorized__'],
        ['Beta', 'Alpha'],
        '__uncategorized__',
      ),
    ).toEqual(['Beta', 'Alpha', 'Zebra', '__uncategorized__']);
  });

  test('matches catalog case-insensitively but keeps instruction spelling', () => {
    expect(sortCategoryNames(['kitchen'], ['Kitchen'])).toEqual(['kitchen']);
  });
});
