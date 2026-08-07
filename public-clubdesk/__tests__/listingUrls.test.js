const {
  slugifyCategory,
  categoryPath,
  pathForListing,
  parseListingPath,
  resolveCategoryFromSlug,
} = require('../lib/listingUrls');

describe('ClubdeskListingUrls', () => {
  test('slugifyCategory transliterates Swedish characters', () => {
    expect(slugifyCategory('Övrigt')).toBe('ovrigt');
    expect(slugifyCategory('Kaffe & Te')).toBe('kaffe-te');
  });

  test('pathForListing maps tabs and categories', () => {
    expect(pathForListing('home', 'Alla')).toBe('/');
    expect(pathForListing('guides', 'Alla')).toBe('/guides/');
    expect(pathForListing('all', 'Alla')).toBe('/guides/');
    expect(pathForListing('price-lists', 'Alla')).toBe('/price-lists/');
    expect(pathForListing('info', 'Alla')).toBe('/info/');
    expect(pathForListing('category', 'Kaffe')).toBe('/kategori/kaffe/');
  });

  test('parseListingPath reads real paths', () => {
    expect(parseListingPath('/')).toEqual({ tab: 'home', filter: 'Alla', categorySlug: null });
    expect(parseListingPath('/guides/')).toEqual({
      tab: 'guides',
      filter: 'Alla',
      categorySlug: null,
    });
    expect(parseListingPath('/alla/')).toEqual({
      tab: 'guides',
      filter: 'Alla',
      categorySlug: null,
    });
    expect(parseListingPath('/price-lists')).toEqual({
      tab: 'price-lists',
      filter: 'Alla',
      categorySlug: null,
    });
    expect(parseListingPath('/info')).toEqual({ tab: 'info', filter: 'Alla', categorySlug: null });
    expect(parseListingPath('/kategori/kaffe/')).toEqual({
      tab: 'category',
      filter: null,
      categorySlug: 'kaffe',
    });
  });

  test('resolveCategoryFromSlug matches slugified names', () => {
    expect(resolveCategoryFromSlug('ovrigt', ['Övrigt', 'Kaffe'])).toBe('Övrigt');
    expect(resolveCategoryFromSlug('kaffe', ['Övrigt', 'Kaffe'])).toBe('Kaffe');
    expect(resolveCategoryFromSlug('missing', ['Kaffe'])).toBeNull();
  });

  test('categoryPath is stable', () => {
    expect(categoryPath('Övrigt')).toBe('/kategori/ovrigt/');
  });
});
