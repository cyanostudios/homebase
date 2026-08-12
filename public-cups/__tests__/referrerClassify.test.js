const {
  classifyReferrer,
  truncateReferrer,
  MAX_REFERRER_CHARS,
} = require('../lib/referrerClassify');

describe('Cupappen referrerClassify', () => {
  test('empty → direct', () => {
    expect(classifyReferrer('')).toEqual({ bucket: 'direct', referrer_domain: '' });
    expect(classifyReferrer(null)).toEqual({ bucket: 'direct', referrer_domain: '' });
  });

  test('internal cupappen / localhost', () => {
    expect(classifyReferrer('https://www.cupappen.se/skane/')).toEqual({
      bucket: 'internal',
      referrer_domain: 'cupappen.se',
    });
    expect(classifyReferrer('http://localhost:8080/')).toMatchObject({ bucket: 'internal' });
  });

  test('search engines', () => {
    expect(classifyReferrer('https://www.google.com/search?q=cup')).toEqual({
      bucket: 'search',
      referrer_domain: 'google.com',
    });
    expect(classifyReferrer('https://www.bing.com/')).toMatchObject({ bucket: 'search' });
  });

  test('social', () => {
    expect(classifyReferrer('https://t.co/abc')).toEqual({
      bucket: 'social',
      referrer_domain: 't.co',
    });
    expect(classifyReferrer('https://www.facebook.com/')).toMatchObject({
      bucket: 'social',
      referrer_domain: 'facebook.com',
    });
  });

  test('other domain keeps host only', () => {
    expect(classifyReferrer('https://example.org/path?q=1')).toEqual({
      bucket: 'other',
      referrer_domain: 'example.org',
    });
  });

  test('truncates oversized referrer input', () => {
    const huge = `https://example.com/${'a'.repeat(MAX_REFERRER_CHARS)}`;
    expect(truncateReferrer(huge).length).toBe(MAX_REFERRER_CHARS);
    expect(classifyReferrer(huge).bucket).toBe('other');
  });
});
