jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  },
  lookup: jest.fn(),
}));

jest.mock('../safeFetch', () => ({
  safeFetch: jest.fn(),
  createSafeLookup: jest.fn(() => jest.fn()),
  TIMEOUT_MS: 15000,
}));

jest.mock('../tlsInventory', () => ({
  inspectTls: jest.fn(async () => ({
    ok: true,
    protocol: 'TLSv1.3',
    authorized: true,
    validFrom: null,
    validTo: null,
    daysRemaining: 90,
    issuer: 'Test',
    hostnameMatch: true,
    error: null,
  })),
}));

jest.mock('../dnsInventory', () => ({
  inspectDns: jest.fn(async () => ({
    ok: true,
    aCount: 1,
    aaaaCount: 0,
    ns: [],
    caa: [],
    spfPresent: true,
    dmarcPresent: true,
    error: null,
  })),
}));

const { safeFetch } = require('../safeFetch');
const { inspectTls } = require('../tlsInventory');
const { inspectDns } = require('../dnsInventory');
const { crawl, QUICK_MAX_PAGES, QUICK_CRAWL_DELAY_MS } = require('../crawler');

function ok(url, body, contentType) {
  return {
    ok: true,
    statusCode: 200,
    headers: { 'content-type': contentType },
    body,
    finalUrl: url,
    redirects: [],
    elapsedMs: 1,
    error: null,
  };
}

describe('crawl same-host fetch scope', () => {
  beforeEach(() => {
    safeFetch.mockReset();
  });

  test('does not fetch sitemap URLs that leave the audit host', async () => {
    const fetched = [];
    safeFetch.mockImplementation(async (url) => {
      fetched.push(url);
      if (String(url).endsWith('/robots.txt')) {
        return ok(
          url,
          [
            'User-agent: *',
            'Allow: /',
            'Sitemap: http://127.0.0.1/secret.xml',
            'Sitemap: https://evil.example/sitemap.xml',
          ].join('\n'),
          'text/plain',
        );
      }
      if (String(url).endsWith('/sitemap.xml')) {
        return ok(
          url,
          '<?xml version="1.0"?><sitemapindex><sitemap><loc>http://10.0.0.5/map.xml</loc></sitemap><sitemap><loc>https://evil.example/other.xml</loc></sitemap></sitemapindex>',
          'application/xml',
        );
      }
      return ok(
        url,
        '<html><head><title>Home</title></head><body><p>Hello from the homepage.</p></body></html>',
        'text/html',
      );
    });

    const result = await crawl('https://example.com/');

    expect(fetched.some((url) => String(url).includes('127.0.0.1'))).toBe(false);
    expect(fetched.some((url) => String(url).includes('10.0.0.5'))).toBe(false);
    expect(fetched.some((url) => String(url).includes('evil.example'))).toBe(false);
    expect(fetched).toContain('https://example.com/sitemap.xml');
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].url).toMatch(/^https:\/\/example\.com\/?/);
    expect(result.siteMeta.auditMode).toBe('full');
  });

  test('crawls the homepage final host after an apex to www redirect', async () => {
    const fetched = [];
    safeFetch.mockImplementation(async (url) => {
      const href = String(url);
      fetched.push(href);
      if (href === 'https://example.com/') {
        return {
          ok: true,
          statusCode: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html><head><title>Home</title></head><body><p>Hello from the homepage with enough readable text.</p><a href="https://www.example.com/about">About</a></body></html>',
          finalUrl: 'https://www.example.com/',
          redirects: [
            { from: 'https://example.com/', to: 'https://www.example.com/', statusCode: 301 },
          ],
          elapsedMs: 5,
          error: null,
        };
      }
      if (href.endsWith('/robots.txt')) {
        return ok(
          href,
          'User-agent: *\nAllow: /\nSitemap: https://www.example.com/sitemap.xml\n',
          'text/plain',
        );
      }
      if (href.endsWith('/sitemap.xml')) {
        return ok(
          href,
          '<?xml version="1.0"?><urlset><url><loc>https://www.example.com/pricing</loc></url><url><loc>https://example.com/legacy</loc></url></urlset>',
          'application/xml',
        );
      }
      return ok(
        href,
        '<html><head><title>Inner</title></head><body><p>Enough inner page text to look like a real document.</p></body></html>',
        'text/html',
      );
    });

    const result = await crawl('https://example.com/');

    expect(fetched[0]).toBe('https://example.com/');
    expect(fetched).toContain('https://www.example.com/robots.txt');
    expect(fetched).toContain('https://www.example.com/sitemap.xml');
    expect(fetched).toContain('https://www.example.com/pricing');
    expect(fetched).toContain('https://www.example.com/about');
    expect(fetched).not.toContain('https://example.com/robots.txt');
    expect(fetched).not.toContain('https://example.com/legacy');
    expect(fetched).toContain('https://www.example.com/llms.txt');
    expect(fetched).toContain('https://www.example.com/.env');
    expect(fetched).toContain('https://www.example.com/.git/HEAD');
    expect(fetched).toContain('https://www.example.com/wp-config.php');
    expect(fetched).toContain('https://www.example.com/server-status');
    expect(fetched).toContain('https://www.example.com/phpinfo.php');
    expect(fetched).not.toContain('https://example.com/llms.txt');
    expect(fetched).not.toContain('https://example.com/.env');
    expect(result.pages[0].finalUrl).toBe('https://www.example.com/');
    expect(result.pages.some((page) => String(page.url).includes('/.env'))).toBe(false);
  });

  test('records llms.txt and security probes without counting them as crawled pages', async () => {
    safeFetch.mockImplementation(async (url) => {
      const href = String(url);
      if (href.endsWith('/robots.txt')) {
        return ok(
          href,
          'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n',
          'text/plain',
        );
      }
      if (href.endsWith('/sitemap.xml')) {
        return {
          ok: false,
          statusCode: 404,
          headers: {},
          body: '',
          finalUrl: href,
          redirects: [],
          elapsedMs: 1,
          error: 'HTTP 404',
        };
      }
      if (href.endsWith('/llms.txt')) {
        return ok(href, '# Example\n\nThis site documents its pages for agents.\n', 'text/plain');
      }
      if (href.endsWith('/.env')) {
        return ok(href, 'DB_PASSWORD=hunter2\nAPP_KEY=abc\n', 'text/plain');
      }
      if (
        href.endsWith('/.git/HEAD') ||
        href.endsWith('/wp-config.php') ||
        href.endsWith('/server-status') ||
        href.endsWith('/phpinfo.php')
      ) {
        return {
          ok: false,
          statusCode: 404,
          headers: { 'content-type': 'text/plain' },
          body: 'missing',
          finalUrl: href,
          redirects: [],
          elapsedMs: 1,
          error: 'HTTP 404',
        };
      }
      return ok(
        href,
        '<html><head><title>Home</title></head><body><p>Hello from the homepage with enough readable text.</p></body></html>',
        'text/html',
      );
    });

    const result = await crawl('https://example.com/');

    expect(result.pages).toHaveLength(1);
    expect(result.siteMeta.llmsTxtFound).toBe(true);
    expect(result.siteMeta.aiBotRobots.byAgent.GPTBot).toBe('disallow');
    expect(result.siteMeta.aiBotRobots.byAgent['*']).toBe('allow');
    expect(result.siteMeta.aiBotRobots.blocked).toEqual(['GPTBot']);
    const envProbe = result.siteMeta.securityProbes.find((probe) => probe.path === '/.env');
    expect(envProbe.exposed).toBe(true);
    expect(envProbe.signature).toBe('env');
    expect(envProbe.body).toBeUndefined();
    expect(
      result.siteMeta.securityProbes.find((probe) => probe.path === '/phpinfo.php').exposed,
    ).toBe(false);
    expect(result.siteMeta.securityProbes).toHaveLength(5);
  });

  test('limits crawl to the start URL path prefix', async () => {
    const fetched = [];
    safeFetch.mockImplementation(async (url) => {
      const href = String(url);
      fetched.push(href);
      if (href.endsWith('/robots.txt')) {
        return ok(
          href,
          'User-agent: *\nAllow: /\nSitemap: https://www.example.com/sitemap.xml\n',
          'text/plain',
        );
      }
      if (href.endsWith('/sitemap.xml')) {
        return ok(
          href,
          [
            '<?xml version="1.0"?><urlset>',
            '<url><loc>https://www.example.com/nordics-baltics/</loc></url>',
            '<url><loc>https://www.example.com/nordics-baltics/offices</loc></url>',
            '<url><loc>https://www.example.com/about</loc></url>',
            '<url><loc>https://www.example.com/</loc></url>',
            '</urlset>',
          ].join(''),
          'application/xml',
        );
      }
      if (href.includes('/nordics-baltics')) {
        return ok(
          href,
          [
            '<html><head><title>Nordics</title></head><body>',
            '<p>Enough nordics page text to look like a real document for the shell heuristic.</p>',
            '<a href="https://www.example.com/nordics-baltics/offices">Offices</a>',
            '<a href="https://www.example.com/about">About</a>',
            '<a href="https://www.example.com/">Home</a>',
            '</body></html>',
          ].join(''),
          'text/html',
        );
      }
      return ok(
        href,
        '<html><head><title>Other</title></head><body><p>Enough other page text to look like a real document.</p></body></html>',
        'text/html',
      );
    });

    const result = await crawl('https://www.example.com/nordics-baltics/');

    expect(result.siteMeta.pathScope).toBe('/nordics-baltics');
    expect(fetched).toContain('https://www.example.com/nordics-baltics/');
    expect(fetched).toContain('https://www.example.com/nordics-baltics/offices');
    expect(fetched).not.toContain('https://www.example.com/about');
    expect(
      fetched.filter(
        (url) => url === 'https://www.example.com/' || url === 'https://www.example.com',
      ),
    ).toEqual([]);
    expect(result.pages.every((page) => String(page.url).includes('/nordics-baltics'))).toBe(true);
  });

  test('quick mode uses the lower page cap and skips security and compression probes', async () => {
    expect(QUICK_MAX_PAGES).toBe(50);
    expect(QUICK_CRAWL_DELAY_MS).toBe(50);

    const fetched = [];
    safeFetch.mockImplementation(async (url, options = {}) => {
      const href = String(url);
      fetched.push(href);
      if (options.extraHeaders && options.extraHeaders['Accept-Encoding']) {
        throw new Error('compression probe should be skipped in quick mode');
      }
      if (href.endsWith('/robots.txt')) {
        return ok(
          href,
          'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
          'text/plain',
        );
      }
      if (href.endsWith('/sitemap.xml')) {
        const locs = Array.from({ length: 80 }, (_, index) => {
          return `<url><loc>https://example.com/p${index}</loc></url>`;
        }).join('');
        return ok(href, `<?xml version="1.0"?><urlset>${locs}</urlset>`, 'application/xml');
      }
      if (href.endsWith('/llms.txt')) {
        return ok(href, '# Example\n\nAgent notes for this host.\n', 'text/plain');
      }
      return ok(
        href,
        '<html><head><title>Page</title></head><body><p>Enough page text to look like a real document.</p></body></html>',
        'text/html',
      );
    });
    inspectTls.mockClear();
    inspectDns.mockClear();

    const result = await crawl('https://example.com/', { mode: 'quick' });

    expect(result.pages).toHaveLength(QUICK_MAX_PAGES);
    expect(result.siteMeta.auditMode).toBe('quick');
    expect(result.siteMeta.securityProbes).toEqual([]);
    expect(result.siteMeta.compression).toEqual({ contentEncoding: null, skipped: true });
    expect(result.siteMeta.llmsTxtFound).toBe(true);
    expect(fetched).toContain('https://example.com/robots.txt');
    expect(fetched).toContain('https://example.com/sitemap.xml');
    expect(fetched).toContain('https://example.com/llms.txt');
    for (const probePath of [
      '/.env',
      '/.git/HEAD',
      '/wp-config.php',
      '/server-status',
      '/phpinfo.php',
    ]) {
      expect(fetched.some((url) => String(url).endsWith(probePath))).toBe(false);
    }
    expect(inspectTls).toHaveBeenCalled();
    expect(inspectDns).toHaveBeenCalled();
  }, 20000);
});
