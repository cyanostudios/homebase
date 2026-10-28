const { detectTechnologies } = require('../techFingerprint');
const { CATALOG_VERSION, TECH_FINGERPRINT_CATALOG } = require('../techFingerprintCatalog');

const CATEGORIES = new Set([
  'cms',
  'ecommerce',
  'analytics',
  'cdn',
  'framework',
  'chat',
  'marketing',
  'other',
]);

const REQUIRED_NAMES = [
  'WordPress',
  'Shopify',
  'WooCommerce',
  'Magento',
  'Google Tag Manager',
  'Google Analytics',
  'Cloudflare',
  'Fastly',
  'Hotjar',
  'Intercom',
  'HubSpot',
  'Cookiebot',
  'OneTrust',
  'Next.js',
  'Nuxt',
  'Wix',
  'Squarespace',
  'Drupal',
  'Joomla',
  'Ghost',
  'Webflow',
  'Vercel',
  'Netlify',
  'Stripe',
  'PayPal',
  'Facebook Pixel',
  'LinkedIn Insight',
  'TikTok Pixel',
  'Segment',
  'Mixpanel',
  'Microsoft Clarity',
  'Zendesk',
  'Drift',
  'Crisp',
  'Klaviyo',
  'Mailchimp',
];

function signalsForEveryRule() {
  const pathHits = [];
  const hosts = [];
  const headers = {};
  for (const entry of TECH_FINGERPRINT_CATALOG) {
    for (const fragment of entry.match.pathIncludes || []) pathHits.push(fragment);
    for (const host of entry.match.hosts || []) {
      if (typeof host === 'string') hosts.push(host);
    }
    for (const header of entry.match.headers || []) {
      if (header.value instanceof RegExp) continue;
      const name = String(header.name).toLowerCase();
      if (!headers[name]) headers[name] = '1';
    }
  }
  return {
    homepageHeaders: headers,
    pages: [
      {
        analysis: {
          techHints: {
            generator:
              'WordPress WooCommerce Magento Wix Squarespace Drupal Joomla Ghost Webflow Nuxt BigCommerce PrestaShop Shopware',
            pathHits,
          },
        },
      },
    ],
    resources: { thirdPartyScriptHosts: hosts, thirdPartyHosts: hosts },
  };
}

describe('TECH_FINGERPRINT_CATALOG', () => {
  test('is a frozen 40–60 rule catalog at version 1', () => {
    expect(CATALOG_VERSION).toBe(1);
    expect(Object.isFrozen(TECH_FINGERPRINT_CATALOG)).toBe(true);
    expect(TECH_FINGERPRINT_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(TECH_FINGERPRINT_CATALOG.length).toBeLessThanOrEqual(60);

    const ids = new Set();
    const names = [];
    for (const entry of TECH_FINGERPRINT_CATALOG) {
      expect(CATEGORIES.has(entry.category)).toBe(true);
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      names.push(entry.name);
      expect(entry.match).toEqual(expect.any(Object));
    }
    for (const name of REQUIRED_NAMES) expect(names).toContain(name);
  });
});

describe('detectTechnologies', () => {
  test('returns an empty inventory when nothing matches', () => {
    expect(detectTechnologies()).toEqual({ items: [], catalogVersion: 1 });
    expect(detectTechnologies(null)).toEqual({ items: [], catalogVersion: 1 });
    expect(
      detectTechnologies({
        homepageHeaders: { server: 'nginx' },
        pages: [{ analysis: { techHints: { generator: null, pathHits: [] } } }],
        resources: {
          thirdPartyHosts: [
            'fakegoogletagmanager.com',
            'notstripe.com',
            'cloudflare.com.evil.test',
          ],
        },
      }),
    ).toEqual({ items: [], catalogVersion: 1 });
  });

  test('matches WordPress from generator and paths and caps evidence at 3', () => {
    const result = detectTechnologies({
      homepageHeaders: {},
      pages: [
        {
          analysis: {
            techHints: {
              generator: 'WordPress 6.4.2',
              pathHits: ['/wp-content/', '/wp-includes/', '/wp-json/'],
            },
          },
        },
      ],
      resources: {},
    });
    const wordpress = result.items.find((item) => item.id === 'wordpress');
    expect(wordpress).toEqual({
      id: 'wordpress',
      name: 'WordPress',
      category: 'cms',
      evidence: [
        { kind: 'generator', value: 'WordPress 6.4.2' },
        { kind: 'path', value: '/wp-content/' },
        { kind: 'path', value: '/wp-includes/' },
      ],
    });
    expect(result.catalogVersion).toBe(1);
  });

  test('deduplicates the same technology across pages', () => {
    const page = {
      analysis: { techHints: { generator: 'WordPress 6.4', pathHits: ['/wp-content/'] } },
    };
    const result = detectTechnologies({
      homepageHeaders: {},
      pages: [page, { ...page }],
      resources: {},
    });
    const hits = result.items.filter((item) => item.id === 'wordpress');
    expect(hits).toHaveLength(1);
    expect(hits[0].evidence).toEqual([
      { kind: 'generator', value: 'WordPress 6.4' },
      { kind: 'path', value: '/wp-content/' },
    ]);
  });

  test('matches headers case-insensitively and ignores unrelated powered-by values', () => {
    const cloudflare = detectTechnologies({
      homepageHeaders: { 'CF-Ray': 'abc123-ARN', Server: 'cloudflare' },
      pages: [],
      resources: {},
    });
    expect(cloudflare.items).toEqual([
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        category: 'cdn',
        evidence: [
          { kind: 'header', value: 'cf-ray: abc123-ARN' },
          { kind: 'header', value: 'server: cloudflare' },
        ],
      },
    ]);

    const shopify = detectTechnologies({
      homepageHeaders: { 'X-ShopId': '12345' },
      pages: [],
      resources: {},
    });
    expect(shopify.items).toEqual([
      {
        id: 'shopify',
        name: 'Shopify',
        category: 'ecommerce',
        evidence: [{ kind: 'header', value: 'x-shopid: 12345' }],
      },
    ]);

    expect(
      detectTechnologies({
        homepageHeaders: { 'X-Powered-By': 'Next.js' },
        pages: [],
        resources: {},
      }).items.map((item) => item.id),
    ).toEqual(['nextjs']);
    expect(
      detectTechnologies({
        homepageHeaders: { 'x-powered-by': 'Express' },
        pages: [],
        resources: {},
      }).items,
    ).toEqual([]);
  });

  test('matches script and stylesheet hosts, including subdomains', () => {
    const result = detectTechnologies({
      homepageHeaders: {},
      pages: [],
      resources: {
        thirdPartyScriptHosts: ['www.googletagmanager.com'],
        thirdPartyHosts: ['script.hotjar.com', 'js.stripe.com'],
      },
    });
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item]));
    expect(byId['google-tag-manager']).toMatchObject({
      name: 'Google Tag Manager',
      category: 'analytics',
      evidence: [{ kind: 'host', value: 'www.googletagmanager.com' }],
    });
    expect(byId.hotjar).toMatchObject({ name: 'Hotjar', category: 'analytics' });
    expect(byId.stripe).toMatchObject({
      name: 'Stripe',
      category: 'ecommerce',
      evidence: [{ kind: 'host', value: 'js.stripe.com' }],
    });
  });

  test('matches path hits case-insensitively', () => {
    const result = detectTechnologies({
      homepageHeaders: {},
      pages: [
        { analysis: { techHints: { generator: null, pathHits: ['/_NEXT/static/chunk.js'] } } },
      ],
      resources: {},
    });
    expect(result.items.find((item) => item.id === 'nextjs').evidence).toEqual([
      { kind: 'path', value: '/_NEXT/static/chunk.js' },
    ]);
  });

  test('truncates evidence values to header-inventory length', () => {
    const result = detectTechnologies({
      homepageHeaders: { 'cf-ray': 'B'.repeat(400) },
      pages: [
        {
          analysis: {
            techHints: { generator: `WordPress ${'A'.repeat(400)}`, pathHits: [] },
          },
        },
      ],
      resources: {},
    });
    const values = result.items.flatMap((item) => item.evidence.map((entry) => entry.value));
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value.length).toBe(201);
      expect(value.endsWith('…')).toBe(true);
    }
  });

  test('caps the inventory at 40 items in catalog order', () => {
    expect(TECH_FINGERPRINT_CATALOG.length).toBeGreaterThan(40);
    const result = detectTechnologies(signalsForEveryRule());
    expect(result.items.map((item) => item.id)).toEqual(
      TECH_FINGERPRINT_CATALOG.slice(0, 40).map((entry) => entry.id),
    );
    for (const item of result.items) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeLessThanOrEqual(3);
      for (const entry of item.evidence) {
        expect(['header', 'host', 'path', 'generator']).toContain(entry.kind);
        expect(entry.value.length).toBeLessThanOrEqual(201);
      }
    }
  });

  test('does not mutate its inputs', () => {
    const input = {
      homepageHeaders: { 'CF-Ray': 'abc' },
      pages: [{ analysis: { techHints: { generator: 'WordPress', pathHits: ['/wp-content/'] } } }],
      resources: {
        thirdPartyScriptHosts: ['www.googletagmanager.com'],
        thirdPartyHosts: ['js.stripe.com'],
      },
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    detectTechnologies(input);
    expect(input).toEqual(snapshot);
  });
});
