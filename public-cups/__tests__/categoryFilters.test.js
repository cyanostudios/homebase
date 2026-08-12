const {
  normalizeCategoryToken,
  getCategoryPresence,
  matchesCategoryGroup,
  categoryTokensFromText,
} = require('../lib/categoryFilters');

describe('Cupappen categoryFilters', () => {
  test('normalizes FP/PF to Flickor/Pojkar (split tokens)', () => {
    expect(normalizeCategoryToken('FP')).toBe('Flickor/Pojkar');
    expect(normalizeCategoryToken('PF')).toBe('Flickor/Pojkar');
    expect(normalizeCategoryToken('FP2013')).toBe('Flickor/Pojkar 2013');
    expect(categoryTokensFromText('FP2013')).toEqual(
      expect.arrayContaining(['Flickor', 'Pojkar 2013']),
    );
  });

  test('F/P slash forms yield both genders', () => {
    const p = getCategoryPresence('F/P2013-2019');
    expect(p.hasGirls).toBe(true);
    expect(p.hasBoys).toBe(true);
  });

  test('FP matches Flickor, Pojkar, and Mix filters', () => {
    expect(matchesCategoryGroup('FP', 'girls')).toBe(true);
    expect(matchesCategoryGroup('FP', 'boys')).toBe(true);
    expect(matchesCategoryGroup('PF2014', 'girls_boys')).toBe(true);
    expect(matchesCategoryGroup('Mix', 'girls_boys')).toBe(true);
  });

  test('single-gender youth does not match Mix (AND)', () => {
    expect(matchesCategoryGroup('Flickor 2012', 'girls')).toBe(true);
    expect(matchesCategoryGroup('Flickor 2012', 'boys')).toBe(false);
    expect(matchesCategoryGroup('Flickor 2012', 'girls_boys')).toBe(false);
    expect(matchesCategoryGroup('Pojkar 2010', 'girls_boys')).toBe(false);
  });

  test('cup with both F and P classes matches Mix', () => {
    expect(matchesCategoryGroup('Flickor 12, Pojkar 12', 'girls_boys')).toBe(true);
    expect(matchesCategoryGroup('Flickor 12; Pojkar 12', 'girls_boys')).toBe(true);
  });

  test('dam/herr unchanged', () => {
    expect(matchesCategoryGroup('Dam', 'women')).toBe(true);
    expect(matchesCategoryGroup('Herrar', 'men')).toBe(true);
    expect(matchesCategoryGroup('Dam', 'girls_boys')).toBe(false);
  });
});
