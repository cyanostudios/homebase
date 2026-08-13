const { MAX_FALLBACK_IMAGES, normalizeFallbackImageUrls } = require('../fallbackImages');

describe('normalizeFallbackImageUrls', () => {
  test('returns empty for null/undefined/non-list', () => {
    expect(normalizeFallbackImageUrls(null)).toEqual([]);
    expect(normalizeFallbackImageUrls(undefined)).toEqual([]);
    expect(normalizeFallbackImageUrls({})).toEqual([]);
    expect(normalizeFallbackImageUrls({ urls: null })).toEqual([]);
  });

  test('accepts bare array and { urls } wrapper', () => {
    expect(normalizeFallbackImageUrls(['https://cdn.example/a.webp'])).toEqual([
      'https://cdn.example/a.webp',
    ]);
    expect(normalizeFallbackImageUrls({ urls: ['https://cdn.example/b.jpg'] })).toEqual([
      'https://cdn.example/b.jpg',
    ]);
  });

  test('allows http and https only', () => {
    expect(
      normalizeFallbackImageUrls([
        'https://cdn.example/ok.jpg',
        'http://localhost:9000/local.webp',
        'ftp://cdn.example/x.jpg',
        '/assets/fallback/01.jpg',
        'javascript:alert(1)',
        '',
      ]),
    ).toEqual(['https://cdn.example/ok.jpg', 'http://localhost:9000/local.webp']);
  });

  test('blocks /api/ paths on absolute URLs', () => {
    expect(
      normalizeFallbackImageUrls([
        'https://app.example/api/files/raw/1',
        'http://app.example/api/cups/x',
        'https://cdn.example/cups/cover.webp',
      ]),
    ).toEqual(['https://cdn.example/cups/cover.webp']);
  });

  test('dedupes while preserving first-seen order', () => {
    expect(
      normalizeFallbackImageUrls([
        'https://cdn.example/a.jpg',
        'https://cdn.example/b.jpg',
        'https://cdn.example/a.jpg',
        '  https://cdn.example/b.jpg  ',
      ]),
    ).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
  });

  test('caps at MAX_FALLBACK_IMAGES', () => {
    const urls = Array.from(
      { length: MAX_FALLBACK_IMAGES + 25 },
      (_, i) => `https://cdn.example/img-${i}.jpg`,
    );
    const out = normalizeFallbackImageUrls(urls);
    expect(out).toHaveLength(MAX_FALLBACK_IMAGES);
    expect(out[0]).toBe('https://cdn.example/img-0.jpg');
    expect(out[MAX_FALLBACK_IMAGES - 1]).toBe(
      `https://cdn.example/img-${MAX_FALLBACK_IMAGES - 1}.jpg`,
    );
  });
});
