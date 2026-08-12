const { assertFinalUrlPublicHttps } = require('../fetchSourceSsrf');
const { validatePublicHttpsUrl } = require('../../../../server/core/utils/ssrfUrlGuard');

describe('assertFinalUrlPublicHttps', () => {
  test('allows public https final URL', () => {
    expect(assertFinalUrlPublicHttps('https://example.com/path').ok).toBe(true);
  });

  test('rejects private / localhost final URL after redirect', () => {
    const result = assertFinalUrlPublicHttps('https://127.0.0.1/secret');
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/not allowed/i);
  });

  test('rejects http final URL', () => {
    const result = assertFinalUrlPublicHttps('http://example.com/x');
    expect(result.ok).toBe(false);
  });

  test('null/empty final URL is treated as ok (no redirect info)', () => {
    expect(assertFinalUrlPublicHttps(null).ok).toBe(true);
    expect(assertFinalUrlPublicHttps('').ok).toBe(true);
  });
});

describe('validatePublicHttpsUrl (ingest SSRF baseline)', () => {
  test('blocks RFC1918 hosts', () => {
    expect(validatePublicHttpsUrl('https://192.168.1.1/').ok).toBe(false);
    expect(validatePublicHttpsUrl('https://10.0.0.5/').ok).toBe(false);
  });

  test('allows public https', () => {
    expect(validatePublicHttpsUrl('https://example.com/a').ok).toBe(true);
  });
});
