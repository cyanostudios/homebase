const { validateImageUrl, validateImageUrls } = require('../core/utils/validateImageUrl');

describe('validateImageUrl', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects non-http(s) URLs', async () => {
    const r = await validateImageUrl('ftp://x/y.png', { fetchImpl: async () => ({ ok: true }) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('invalid_protocol');
  });

  it('accepts HEAD with image content-type', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      headers: { get: (h) => (h === 'content-type' ? 'image/jpeg' : null) },
    }));
    const r = await validateImageUrl('https://example.com/a.jpg');
    expect(r.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('falls back when HEAD fails content check', async () => {
    let n = 0;
    global.fetch = jest.fn(async (url, init) => {
      n += 1;
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          headers: { get: () => 'text/html' },
        };
      }
      if (init?.headers?.Range) {
        return {
          ok: true,
          status: 206,
          headers: { get: () => 'image/png' },
        };
      }
      return {
        ok: true,
        headers: { get: () => 'image/png' },
      };
    });
    const r = await validateImageUrl('https://example.com/b.png');
    expect(r.ok).toBe(true);
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it('validateImageUrls reports first failure index', async () => {
    global.fetch = jest.fn(async (url) => {
      const u = String(url);
      if (u.includes('bad')) {
        return { ok: true, headers: { get: () => 'text/plain' } };
      }
      return { ok: true, headers: { get: () => 'image/gif' } };
    });
    const r = await validateImageUrls(['https://x/good.gif', 'https://x/bad'], { concurrency: 2 });
    expect(r.ok).toBe(false);
    expect(r.index).toBe(1);
  });
});
