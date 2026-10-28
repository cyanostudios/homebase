const { analyzePage, analyzeSite, WEIGHTS } = require('../scoring');

function basePage(analysisOverrides = {}, pageOverrides = {}) {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    elapsedMs: 300,
    analysis: {
      title: 'A Good Example Page Title',
      metaDescription:
        'A reasonably sized meta description that falls within recommended bounds for SEO purposes.',
      h1Count: 1,
      canonical: 'https://example.com/',
      noindex: false,
      lang: 'en',
      viewport: 'width=device-width, initial-scale=1',
      og: { 'og:title': 'T', 'og:description': 'D', 'og:image': 'https://example.com/img.png' },
      twitter: { 'twitter:card': 'summary' },
      jsonLd: [{ '@type': 'Organization' }],
      htmlSize: 20000,
      shellOnly: false,
      ...analysisOverrides,
    },
    ...pageOverrides,
  };
}

describe('WEIGHTS', () => {
  test('matches the ADR category weights (indexing 0.30 / content 0.30 / technical 0.25 / sharing 0.15)', () => {
    expect(WEIGHTS).toEqual({ indexing: 0.3, content: 0.3, technical: 0.25, sharing: 0.15 });
  });
});

describe('analyzePage', () => {
  test('gives a perfect score to a fully-optimized page with no findings', () => {
    const result = analyzePage(basePage());
    expect(result.categories).toEqual({
      indexing: 100,
      content: 100,
      technical: 100,
      sharing: 100,
    });
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
    expect(result.shellOnly).toBe(false);
  });

  test('penalizes noindex as a critical indexing finding', () => {
    const baseline = analyzePage(basePage());
    const result = analyzePage(basePage({ noindex: true }));
    expect(result.categories.indexing).toBeLessThan(baseline.categories.indexing);
    expect(
      result.findings.some((f) => f.severity === 'critical' && f.category === 'indexing'),
    ).toBe(true);
  });

  test('penalizes a 4xx status heavily under indexing', () => {
    const result = analyzePage(basePage({}, { statusCode: 404 }));
    expect(result.categories.indexing).toBeLessThanOrEqual(20);
    expect(result.findings.some((f) => /HTTP 404/.test(f.message))).toBe(true);
  });

  test('penalizes missing title and missing meta description under content', () => {
    const result = analyzePage(basePage({ title: null, metaDescription: null }));
    expect(result.categories.content).toBeLessThan(100);
    expect(result.findings.some((f) => /title/i.test(f.message) && f.category === 'content')).toBe(
      true,
    );
    expect(result.findings.some((f) => /meta description/i.test(f.message))).toBe(true);
  });

  test('penalizes http (non-https) pages under technical', () => {
    const result = analyzePage(basePage({}, { finalUrl: 'http://example.com/' }));
    expect(result.categories.technical).toBeLessThan(100);
    expect(
      result.findings.some((f) => f.category === 'technical' && /https/i.test(f.message)),
    ).toBe(true);
  });

  test('penalizes missing Open Graph tags under sharing', () => {
    const result = analyzePage(basePage({ og: {} }));
    expect(result.categories.sharing).toBeLessThan(100);
  });

  test('flags a shell-only (SPA) page as a content warning', () => {
    const result = analyzePage(basePage({ shellOnly: true }));
    expect(result.shellOnly).toBe(true);
    expect(result.findings.some((f) => /shell/i.test(f.message))).toBe(true);
  });

  test('warns when any image is missing alt text', () => {
    const result = analyzePage(
      basePage({
        images: [
          { src: '/a.png', alt: 'Diagram' },
          { src: '/b.png', alt: '' },
          { src: '/c.png', alt: null },
        ],
      }),
    );
    const altFinding = result.findings.find(
      (f) => f.category === 'content' && /alt text/i.test(f.message),
    );
    expect(altFinding).toMatchObject({ severity: 'warning', pillar: 'seo' });
    expect(altFinding.message).toMatch(/2 of 3/);
    expect(result.categories.content).toBeLessThan(100);
  });

  test('does not warn when every image has alt text', () => {
    const result = analyzePage(
      basePage({
        images: [
          { src: '/a.png', alt: 'Diagram' },
          { src: '/b.png', alt: 'Photo' },
        ],
      }),
    );
    expect(result.findings.some((f) => /alt text/i.test(f.message))).toBe(false);
    expect(result.categories.content).toBe(100);
  });
});

describe('analyzeSite', () => {
  test('averages per-page category scores and flags missing robots.txt/sitemap', () => {
    const pages = [basePage(), basePage({}, { url: 'https://example.com/page-2' })];
    const summary = analyzeSite(pages, {
      robotsTxtFound: false,
      sitemapFound: false,
      homepageHeaders: {},
    });

    expect(summary.pageCount).toBe(2);
    expect(summary.findings.find((f) => /robots\.txt/i.test(f.message))).toMatchObject({
      severity: 'warning',
      pillar: 'seo',
    });
    expect(summary.findings.some((f) => /sitemap/i.test(f.message))).toBe(true);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.score).toBeLessThanOrEqual(100);
  });

  test('flags duplicate titles across pages', () => {
    const pages = [
      basePage({}, { url: 'https://example.com/a' }),
      basePage({}, { url: 'https://example.com/b' }),
    ];
    const summary = analyzeSite(pages, {
      robotsTxtFound: true,
      sitemapFound: true,
      homepageHeaders: {},
    });
    expect(summary.findings.some((f) => /duplicate title/i.test(f.message))).toBe(true);
  });

  test('surfaces a sample of broken (4xx/5xx) pages as a critical finding', () => {
    const pages = [
      basePage(),
      basePage({}, { url: 'https://example.com/broken', statusCode: 500 }),
    ];
    const summary = analyzeSite(pages, {
      robotsTxtFound: true,
      sitemapFound: true,
      homepageHeaders: {},
    });
    expect(
      summary.findings.some((f) => f.severity === 'critical' && /error status/i.test(f.message)),
    ).toBe(true);
  });

  test('marks the whole site as shellOnly only when every page is a JS shell', () => {
    const allShell = analyzeSite(
      [
        basePage({ shellOnly: true }),
        basePage({ shellOnly: true }, { url: 'https://example.com/2' }),
      ],
      { robotsTxtFound: true, sitemapFound: true, homepageHeaders: {} },
    );
    expect(allShell.shellOnly).toBe(true);

    const mixed = analyzeSite(
      [basePage({ shellOnly: true }), basePage({}, { url: 'https://example.com/2' })],
      { robotsTxtFound: true, sitemapFound: true, homepageHeaders: {} },
    );
    expect(mixed.shellOnly).toBe(false);
    expect(mixed.shellOnlyPageCount).toBe(1);
  });

  test('does not treat a missing Content-Encoding header as uncompressed', () => {
    const summary = analyzeSite([basePage()], {
      robotsTxtFound: true,
      sitemapFound: true,
      llmsTxtFound: true,
      homepageHeaders: {
        'cache-control': 'public, max-age=60',
        'strict-transport-security': 'max-age=1',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'",
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'geolocation=()',
        'x-frame-options': 'DENY',
      },
    });
    expect(summary.findings.some((f) => /content-encoding|not compressed/i.test(f.message))).toBe(
      false,
    );
  });

  test('a healthy site with good signals and real security headers scores highly', () => {
    const pages = [basePage(), basePage({}, { url: 'https://example.com/page-2' })];
    const summary = analyzeSite(pages, {
      robotsTxtFound: true,
      sitemapFound: true,
      llmsTxtFound: true,
      homepageHeaders: {
        'content-encoding': 'gzip',
        'cache-control': 'public, max-age=3600',
        'strict-transport-security': 'max-age=63072000',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'",
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'geolocation=()',
        'x-frame-options': 'DENY',
      },
    });
    expect(summary.score).toBeGreaterThanOrEqual(90);
  });
});

const SECURITY_HEADERS = {
  'cache-control': 'public, max-age=3600',
  'strict-transport-security': 'max-age=63072000',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'geolocation=()',
  'x-frame-options': 'DENY',
};

function healthyMeta(overrides = {}) {
  return {
    robotsTxtFound: true,
    sitemapFound: true,
    llmsTxtFound: true,
    aiBotRobots: { byAgent: { '*': 'allow' }, blocked: [] },
    homepageHeaders: { ...SECURITY_HEADERS },
    securityProbes: [],
    ...overrides,
  };
}

function headersWithout(...names) {
  const headers = { ...SECURITY_HEADERS };
  for (const name of names) delete headers[name];
  return headers;
}

describe('etapp 1.1 scoring', () => {
  const richPage = () =>
    basePage({ author: 'Ada Lovelace', h2Count: 1, bodyTextLength: 480, mixedContentSample: [] });

  test('missing HSTS on HTTPS is a security warning and deducts more than CSP or X-Content-Type-Options', () => {
    const withoutHsts = analyzeSite(
      [richPage()],
      healthyMeta({ homepageHeaders: headersWithout('strict-transport-security') }),
    );
    const withoutCsp = analyzeSite(
      [richPage()],
      healthyMeta({ homepageHeaders: headersWithout('content-security-policy') }),
    );
    const withoutXcto = analyzeSite(
      [richPage()],
      healthyMeta({ homepageHeaders: headersWithout('x-content-type-options') }),
    );
    const withAll = analyzeSite([richPage()], healthyMeta());

    const hsts = withoutHsts.findings.find((f) => /HSTS/.test(f.message));
    expect(hsts).toMatchObject({ severity: 'warning', category: 'technical', pillar: 'security' });
    expect(
      withoutHsts.findings.some(
        (f) => f.severity === 'info' && /security headers/i.test(f.message),
      ),
    ).toBe(false);
    expect(
      withoutCsp.findings.find((f) => /Content-Security-Policy/.test(f.message)),
    ).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });
    expect(
      withoutXcto.findings.find((f) => /X-Content-Type-Options/.test(f.message)),
    ).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });

    expect(withAll.categories.technical).toBe(100);
    expect(100 - withoutHsts.categories.technical).toBe(10);
    expect(100 - withoutCsp.categories.technical).toBe(4);
    expect(100 - withoutXcto.categories.technical).toBe(3);
    expect(100 - withoutHsts.categories.technical).toBeGreaterThan(
      100 - withoutCsp.categories.technical,
    );
  });

  test('does not require HSTS or cookie flags on an HTTP homepage', () => {
    const summary = analyzeSite(
      [
        basePage(
          { author: 'Ada', h2Count: 1, bodyTextLength: 400 },
          { url: 'http://example.com/', finalUrl: 'http://example.com/' },
        ),
      ],
      healthyMeta({
        homepageHeaders: {
          'set-cookie': 'sid=secret; Path=/',
        },
      }),
    );
    expect(summary.findings.some((f) => /HSTS/.test(f.message))).toBe(false);
    expect(summary.findings.some((f) => /Set-Cookie/.test(f.message))).toBe(false);
    expect(summary.siteMeta.cookieFlags).toEqual({ applicable: false, issues: [] });
  });

  test('warns when an HTTPS Set-Cookie is missing Secure, HttpOnly, or SameSite', () => {
    const summary = analyzeSite(
      [richPage()],
      healthyMeta({
        homepageHeaders: {
          ...SECURITY_HEADERS,
          'set-cookie': ['sid=abc; Path=/', 'theme=light; Secure; HttpOnly; SameSite=Lax'],
        },
      }),
    );
    const cookieFinding = summary.findings.find((f) => /Set-Cookie/.test(f.message));
    expect(cookieFinding).toMatchObject({
      severity: 'warning',
      category: 'technical',
      pillar: 'security',
    });
    expect(cookieFinding.message).toContain('sid');
    expect(cookieFinding.message).not.toContain('abc');
    expect(cookieFinding.message).not.toContain('theme');
    expect(summary.categories.technical).toBe(95);
    expect(summary.siteMeta.cookieFlags.issues).toEqual([
      { name: 'sid', missing: ['Secure', 'HttpOnly', 'SameSite'] },
    ]);
  });

  test('uses the homepage final URL when scoring HSTS after a redirect', () => {
    const scored = analyzePage(
      basePage(
        { author: 'Ada', h2Count: 1, bodyTextLength: 400 },
        {
          url: 'http://example.com/',
          finalUrl: 'https://www.example.com/',
        },
      ),
    );
    expect(scored.finalUrl).toBe('https://www.example.com/');
    const summary = analyzeSite(
      [scored],
      healthyMeta({ homepageHeaders: headersWithout('strict-transport-security') }),
    );
    expect(summary.findings.some((f) => /HSTS/.test(f.message) && f.pillar === 'security')).toBe(
      true,
    );
    expect(summary.findings.some((f) => /served over HTTP/.test(f.message))).toBe(false);
  });

  test('mixed content is a security warning and is copied onto siteMeta', () => {
    const sample = ['http://cdn.example.com/app.js'];
    const result = analyzePage(richPage());
    const mixed = analyzePage(
      basePage({
        author: 'Ada',
        h2Count: 1,
        bodyTextLength: 400,
        mixedContentSample: sample,
      }),
    );
    expect(result.findings.some((f) => /mixed content/i.test(f.message))).toBe(false);
    const finding = mixed.findings.find((f) => /mixed content/i.test(f.message));
    expect(finding).toMatchObject({
      severity: 'warning',
      category: 'technical',
      pillar: 'security',
    });
    expect(mixed.categories.technical).toBe(85);

    const summary = analyzeSite(
      [basePage({ author: 'Ada', h2Count: 1, bodyTextLength: 400, mixedContentSample: sample })],
      healthyMeta(),
    );
    expect(summary.siteMeta.mixedContentSample).toEqual(sample);
  });

  test('missing or empty llms.txt is an AI indexing warning', () => {
    const missing = analyzeSite([richPage()], healthyMeta({ llmsTxtFound: false }));
    const present = analyzeSite([richPage()], healthyMeta({ llmsTxtFound: true }));
    const finding = missing.findings.find((f) => /llms\.txt/i.test(f.message));
    expect(finding).toMatchObject({ severity: 'warning', category: 'indexing', pillar: 'ai' });
    expect(missing.categories.indexing).toBe(95);
    expect(present.categories.indexing).toBe(100);
    expect(present.findings.some((f) => /llms\.txt/i.test(f.message))).toBe(false);
    expect(missing.siteMeta.llmsTxtFound).toBe(false);
    expect(present.siteMeta.llmsTxtFound).toBe(true);
  });

  test('root-blocked AI crawlers are an indexing warning', () => {
    const summary = analyzeSite(
      [richPage()],
      healthyMeta({
        aiBotRobots: {
          byAgent: { '*': 'allow', GPTBot: 'disallow', CCBot: 'disallow' },
          blocked: ['GPTBot', 'CCBot'],
        },
      }),
    );
    const finding = summary.findings.find((f) => /AI crawlers blocked/.test(f.message));
    expect(finding).toMatchObject({ severity: 'warning', category: 'indexing', pillar: 'ai' });
    expect(finding.message).toContain('GPTBot');
    expect(finding.message).toContain('CCBot');
    expect(summary.categories.indexing).toBe(95);
    expect(summary.siteMeta.aiBotRobots.blocked).toEqual(['GPTBot', 'CCBot']);
  });

  test('exposed probes are critical and deduct, capped, while closed probes do not', () => {
    const closed = analyzeSite(
      [richPage()],
      healthyMeta({
        securityProbes: [{ path: '/.env', statusCode: 404, exposed: false }],
      }),
    );
    const one = analyzeSite(
      [richPage()],
      healthyMeta({
        securityProbes: [
          { path: '/.env', statusCode: 200, exposed: true },
          { path: '/.git/HEAD', statusCode: 403, exposed: false },
        ],
      }),
    );
    const three = analyzeSite(
      [richPage()],
      healthyMeta({
        securityProbes: [
          { path: '/.env', exposed: true, statusCode: 200 },
          { path: '/.git/HEAD', exposed: true, statusCode: 200 },
          { path: '/wp-config.php', exposed: true, statusCode: 200 },
        ],
      }),
    );

    expect(closed.categories.technical).toBe(100);
    expect(closed.findings.some((f) => /Sensitive path/.test(f.message))).toBe(false);
    const exposed = one.findings.find((f) => /Sensitive path exposed: \/\.env/.test(f.message));
    expect(exposed).toMatchObject({
      severity: 'critical',
      category: 'technical',
      pillar: 'security',
    });
    expect(one.findings.some((f) => /\/\.git\/HEAD/.test(f.message))).toBe(false);
    expect(one.categories.technical).toBe(75);
    expect(three.categories.technical).toBe(50);
    expect(
      three.findings.filter((f) => f.pillar === 'security' && f.severity === 'critical'),
    ).toHaveLength(3);
  });

  test('flags thin body text, a missing H2, a useless JSON-LD type, and a missing homepage author', () => {
    const thin = analyzePage(
      basePage({ bodyTextLength: 40, shellOnly: false, h2Count: 1, author: 'Ada' }),
    );
    expect(thin.findings.find((f) => /thin body/i.test(f.message))).toMatchObject({
      severity: 'warning',
      category: 'content',
      pillar: 'ai',
    });
    expect(thin.categories.content).toBe(90);

    const shell = analyzePage(basePage({ bodyTextLength: 40, shellOnly: true, h2Count: 1 }));
    expect(shell.findings.some((f) => /thin body/i.test(f.message))).toBe(false);

    const noH2 = analyzePage(
      basePage({ h1Count: 1, h2Count: 0, bodyTextLength: 500, author: 'Ada' }),
    );
    expect(noH2.findings.find((f) => /no H2/.test(f.message))).toMatchObject({
      severity: 'info',
      category: 'content',
      pillar: 'ai',
    });
    expect(noH2.categories.content).toBe(95);

    const useless = analyzePage(
      basePage({
        jsonLd: [{ '@type': 'Thing' }],
        h2Count: 1,
        bodyTextLength: 500,
        author: 'Ada',
      }),
    );
    expect(useless.findings.find((f) => /useful @type/.test(f.message))).toMatchObject({
      severity: 'warning',
      category: 'sharing',
      pillar: 'ai',
    });
    expect(useless.categories.sharing).toBe(90);

    const missingAuthor = analyzeSite(
      [basePage({ h2Count: 1, bodyTextLength: 500 })],
      healthyMeta(),
    );
    const withAuthor = analyzeSite([richPage()], healthyMeta());
    expect(missingAuthor.findings.find((f) => /missing an author/.test(f.message))).toMatchObject({
      severity: 'info',
      category: 'sharing',
      pillar: 'ai',
    });
    expect(withAuthor.findings.some((f) => /missing an author/.test(f.message))).toBe(false);
    expect(missingAuthor.categories.sharing).toBe(95);
    expect(withAuthor.categories.sharing).toBe(100);
  });

  test('JSON-LD author satisfies the homepage author check', () => {
    const summary = analyzeSite(
      [
        basePage({
          author: null,
          h2Count: 1,
          bodyTextLength: 500,
          jsonLd: [{ '@type': 'Article', author: { '@type': 'Person', name: 'Ada' } }],
        }),
      ],
      healthyMeta(),
    );
    expect(summary.findings.some((f) => /missing an author/.test(f.message))).toBe(false);
    expect(summary.findings.some((f) => /useful @type/.test(f.message))).toBe(false);
  });

  test('etapp 1.2 inventory persists siteMeta and scores missing referrer/permissions/frame headers', () => {
    const summary = analyzeSite(
      [richPage()],
      healthyMeta({
        homepageHeaders: headersWithout('referrer-policy', 'permissions-policy', 'x-frame-options'),
        tls: {
          ok: true,
          protocol: 'TLSv1.3',
          authorized: true,
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 10 * 86400000).toISOString(),
          daysRemaining: 10,
          issuer: 'Test CA',
          hostnameMatch: true,
          error: null,
        },
        dns: {
          ok: true,
          aCount: 1,
          aaaaCount: 0,
          ns: ['ns1.example.com'],
          caa: [],
          spfPresent: false,
          dmarcPresent: false,
          error: null,
        },
        resources: { thirdPartyScriptHostCount: 12, thirdPartyScriptHosts: [] },
        crawlGraph: { pageCount: 1, maxDepth: 0 },
        compression: { contentEncoding: 'gzip', ok: true, error: null },
      }),
    );
    expect(summary.siteMeta.securityHeaders.referrerPolicy.present).toBe(false);
    expect(summary.siteMeta.tls.daysRemaining).toBe(10);
    expect(summary.siteMeta.dns.spfPresent).toBe(false);
    expect(summary.siteMeta.compression.contentEncoding).toBe('gzip');
    expect(summary.findings.find((f) => /Referrer-Policy/.test(f.message))).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });
    expect(summary.findings.find((f) => /Permissions-Policy/.test(f.message))).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });
    expect(summary.findings.find((f) => /frame protection/.test(f.message))).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });
    expect(summary.findings.find((f) => /expires in 10/.test(f.message))).toMatchObject({
      severity: 'warning',
      pillar: 'security',
    });
    expect(summary.findings.find((f) => /SPF/.test(f.message))).toMatchObject({ severity: 'info' });
    expect(summary.findings.find((f) => /DMARC/.test(f.message))).toMatchObject({
      severity: 'info',
    });
    expect(summary.findings.find((f) => /third-party script hosts/.test(f.message))).toMatchObject({
      severity: 'info',
      pillar: 'security',
    });
  });
});

describe('etapp 1.3 technologies', () => {
  function richAnalysis(overrides = {}) {
    return basePage({
      author: 'Ada Lovelace',
      h2Count: 1,
      bodyTextLength: 480,
      mixedContentSample: [],
      ...overrides,
    });
  }

  test('stores a technologies inventory without changing weights, score, or findings', () => {
    const baseline = analyzeSite([richAnalysis()], healthyMeta());
    const summary = analyzeSite(
      [
        richAnalysis({
          techHints: {
            generator: 'WordPress 6.4.2',
            pathHits: ['/wp-content/', '/wp-includes/'],
          },
        }),
      ],
      healthyMeta({
        homepageHeaders: {
          ...SECURITY_HEADERS,
          'cf-ray': 'abc123-ARN',
          server: 'cloudflare',
        },
        resources: {
          thirdPartyScriptHosts: ['www.googletagmanager.com'],
          thirdPartyHosts: ['www.googletagmanager.com', 'js.stripe.com'],
        },
      }),
    );

    expect(summary.weights).toEqual(WEIGHTS);
    expect(summary.score).toBe(baseline.score);
    expect(summary.categories).toEqual(baseline.categories);
    expect(summary.findings).toEqual(baseline.findings);
    expect(baseline.siteMeta.technologies).toEqual({ items: [], catalogVersion: 1 });
    expect(summary.siteMeta.technologies.catalogVersion).toBe(1);

    const byId = Object.fromEntries(
      summary.siteMeta.technologies.items.map((item) => [item.id, item]),
    );
    expect(byId.wordpress).toMatchObject({ name: 'WordPress', category: 'cms' });
    expect(byId.wordpress.evidence).toEqual(
      expect.arrayContaining([
        { kind: 'generator', value: 'WordPress 6.4.2' },
        { kind: 'path', value: '/wp-content/' },
      ]),
    );
    expect(byId.wordpress.evidence.length).toBeLessThanOrEqual(3);
    expect(byId.cloudflare).toMatchObject({ name: 'Cloudflare', category: 'cdn' });
    expect(byId.cloudflare.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'header' })]),
    );
    expect(byId['google-tag-manager']).toMatchObject({
      name: 'Google Tag Manager',
      category: 'analytics',
    });
    expect(byId.stripe).toMatchObject({ name: 'Stripe', category: 'ecommerce' });
    expect(summary.findings.some((finding) => /wordpress|technolog/i.test(finding.message))).toBe(
      false,
    );
  });
});

describe('etapp 1.4 finding codes', () => {
  const rich = (overrides = {}) =>
    basePage({
      author: 'Ada Lovelace',
      h2Count: 1,
      bodyTextLength: 480,
      mixedContentSample: [],
      ...overrides,
    });

  function codes(findings) {
    return findings.map((finding) => finding.code);
  }

  test('key page findings carry stable snake_case codes', () => {
    const collected = [
      ...codes(analyzePage(basePage({ noindex: true, canonical: null })).findings),
      ...codes(analyzePage(basePage({}, { statusCode: 404 })).findings),
      ...codes(analyzePage(basePage({}, { statusCode: 302 })).findings),
      ...codes(analyzePage(basePage({ title: 'Page not found' })).findings),
      ...codes(analyzePage(basePage({ title: null })).findings),
      ...codes(analyzePage(basePage({ title: 'A'.repeat(61) })).findings),
      ...codes(analyzePage(basePage({ title: 'Tiny' })).findings),
      ...codes(analyzePage(basePage({ metaDescription: null })).findings),
      ...codes(analyzePage(basePage({ metaDescription: 'Too short.' })).findings),
      ...codes(analyzePage(basePage({ h1Count: 0 })).findings),
      ...codes(analyzePage(basePage({ h1Count: 2 })).findings),
      ...codes(analyzePage(basePage({ images: [{ src: '/a.png', alt: '' }] })).findings),
      ...codes(analyzePage(basePage({ shellOnly: true })).findings),
      ...codes(analyzePage(rich({ bodyTextLength: 40, shellOnly: false })).findings),
      ...codes(analyzePage(rich({ h2Count: 0, bodyTextLength: 500 })).findings),
      ...codes(analyzePage(basePage({}, { finalUrl: 'http://example.com/' })).findings),
      ...codes(analyzePage(basePage({}, { elapsedMs: 2500 })).findings),
      ...codes(analyzePage(basePage({ htmlSize: 2 * 1024 * 1024 })).findings),
      ...codes(analyzePage(basePage({ viewport: null })).findings),
      ...codes(analyzePage(basePage({ lang: null })).findings),
      ...codes(
        analyzePage(basePage({ mixedContentSample: ['http://cdn.example.com/app.js'] })).findings,
      ),
      ...codes(analyzePage(basePage({ og: {} })).findings),
      ...codes(analyzePage(basePage({ twitter: {} })).findings),
      ...codes(analyzePage(basePage({ jsonLd: [{ _parseError: true }] })).findings),
      ...codes(analyzePage(rich({ jsonLd: [{ '@type': 'Thing' }] })).findings),
    ];

    expect(collected).toEqual(
      expect.arrayContaining([
        'noindex',
        'missing_canonical',
        'http_error_status',
        'redirect_response',
        'soft_404',
        'missing_title',
        'title_too_long',
        'title_too_short',
        'missing_meta_description',
        'meta_description_length',
        'missing_h1',
        'multiple_h1',
        'missing_alt',
        'shell_only',
        'thin_body',
        'missing_h2',
        'not_https',
        'slow_response',
        'large_html',
        'missing_viewport',
        'missing_lang',
        'mixed_content',
        'missing_og_title',
        'missing_og_description',
        'missing_og_image',
        'missing_twitter_card',
        'invalid_json_ld',
        'json_ld_no_useful_type',
      ]),
    );
    expect(collected.every((code) => typeof code === 'string' && /^[a-z0-9_]+$/.test(code))).toBe(
      true,
    );
  });

  test('key site findings carry stable codes and auditMode defaults to full', () => {
    const page = basePage({ h2Count: 1, bodyTextLength: 480 });
    const summary = analyzeSite(
      [page, { ...page, url: 'https://example.com/broken', statusCode: 500 }],
      {
        robotsTxtFound: false,
        sitemapFound: false,
        llmsTxtFound: false,
        aiBotRobots: { blocked: ['GPTBot'] },
        homepageHeaders: { 'set-cookie': 'sid=abc; Path=/' },
        securityProbes: [{ path: '/.env', exposed: true, statusCode: 200 }],
        dns: { ok: true, spfPresent: false, dmarcPresent: false },
        resources: { thirdPartyScriptHostCount: 12 },
        tls: { ok: true, hostnameMatch: false, daysRemaining: 90 },
      },
    );

    const siteCodes = summary.findings.map((finding) => finding.code);
    expect(siteCodes).toEqual(
      expect.arrayContaining([
        'robots_txt_missing',
        'sitemap_missing',
        'llms_txt_missing',
        'ai_bots_blocked',
        'no_cache_control',
        'no_hsts',
        'no_csp',
        'no_xcto',
        'no_referrer_policy',
        'no_permissions_policy',
        'no_frame_protection',
        'tls_hostname_mismatch',
        'spf_missing',
        'dmarc_missing',
        'third_party_script_hosts',
        'cookie_flags_missing',
        'duplicate_titles',
        'broken_pages',
        'http_error_status',
        'missing_author',
        'probe_exposed',
      ]),
    );
    expect(summary.findings.every((finding) => /^[a-z0-9_]+$/.test(finding.code))).toBe(true);
    expect(summary.weights).toEqual(WEIGHTS);
    expect(summary.siteMeta.auditMode).toBe('full');

    const expired = analyzeSite(
      [rich()],
      healthyMeta({
        tls: { ok: true, hostnameMatch: true, daysRemaining: -2 },
      }),
    );
    expect(expired.findings.some((finding) => finding.code === 'tls_expired')).toBe(true);

    const expiring = analyzeSite(
      [rich()],
      healthyMeta({
        tls: { ok: true, hostnameMatch: true, daysRemaining: 10 },
      }),
    );
    expect(expiring.findings.some((finding) => finding.code === 'tls_expiring')).toBe(true);

    expect(analyzeSite([rich()], healthyMeta({ auditMode: 'quick' })).siteMeta.auditMode).toBe(
      'quick',
    );
    expect(analyzeSite([rich()], healthyMeta({ auditMode: 'other' })).siteMeta.auditMode).toBe(
      'full',
    );
  });
});
