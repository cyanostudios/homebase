const { analyzeHtml } = require('../htmlAnalyzer');

const FULL_HTML = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Example Page Title</title>
      <meta name="description" content="A short description of the example page." />
      <link rel="canonical" href="https://example.com/canonical" />
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content="OG Title" />
      <meta property="og:image" content="https://example.com/og.png" />
      <meta name="twitter:card" content="summary_large_image" />
      <script type="application/ld+json">{"@type":"Organization","name":"Example"}</script>
    </head>
    <body>
      <h1>Main heading</h1>
      <p>Lots of real text content for this page goes here to simulate a normal server-rendered page.</p>
      <img src="/a.png" alt="An image" />
      <img src="/b.png" />
      <a href="/internal-page">Internal link</a>
      <a href="https://external.com/page">External link</a>
      <a href="#section">Anchor</a>
      <a href="mailto:a@b.com">Mail</a>
    </body>
  </html>
`;

describe('analyzeHtml', () => {
  test('extracts title, meta description, canonical, robots meta, lang and viewport', () => {
    const result = analyzeHtml(FULL_HTML, 'https://example.com/');
    expect(result.title).toBe('Example Page Title');
    expect(result.metaDescription).toBe('A short description of the example page.');
    expect(result.canonical).toBe('https://example.com/canonical');
    expect(result.robotsMeta).toBe('index, follow');
    expect(result.noindex).toBe(false);
    expect(result.lang).toBe('en');
    expect(result.viewport).toContain('width=device-width');
  });

  test('extracts h1s, Open Graph, Twitter card and valid JSON-LD', () => {
    const result = analyzeHtml(FULL_HTML, 'https://example.com/');
    expect(result.h1s).toEqual(['Main heading']);
    expect(result.h1Count).toBe(1);
    expect(result.og['og:title']).toBe('OG Title');
    expect(result.og['og:image']).toBe('https://example.com/og.png');
    expect(result.twitter['twitter:card']).toBe('summary_large_image');
    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0]['@type']).toBe('Organization');
  });

  test('extracts images (including missing alt) and only same-host internal links', () => {
    const result = analyzeHtml(FULL_HTML, 'https://example.com/');
    expect(result.images).toEqual([
      { src: '/a.png', alt: 'An image' },
      { src: '/b.png', alt: null },
    ]);
    expect(result.internalLinks).toEqual(['https://example.com/internal-page']);
  });

  test('flags noindex via robots meta tag', () => {
    const result = analyzeHtml(
      '<html><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>',
      'https://example.com/',
    );
    expect(result.noindex).toBe(true);
  });

  test('marks invalid JSON-LD blocks instead of throwing', () => {
    const html =
      '<html><head><script type="application/ld+json">{not valid json</script></head></html>';
    const result = analyzeHtml(html, 'https://example.com/');
    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0]._parseError).toBe(true);
  });

  test('detects a likely SPA shell (near-empty #root with a bundle script)', () => {
    const shellHtml = `
      <html>
        <head><title>App</title></head>
        <body>
          <div id="root"></div>
          <script src="/bundle.js"></script>
        </body>
      </html>
    `;
    const result = analyzeHtml(shellHtml, 'https://example.com/');
    expect(result.shellOnly).toBe(true);
  });

  test('does not flag a normal server-rendered page as a SPA shell', () => {
    const result = analyzeHtml(FULL_HTML, 'https://example.com/');
    expect(result.shellOnly).toBe(false);
  });

  test('returns body length, heading counts, author, and useful JSON-LD types', () => {
    const html = `
      <html>
        <head>
          <meta name="author" content="Ada Lovelace" />
          <script type="application/ld+json">
            {"@graph":[{"@type":"Thing"},{"@type":"https://schema.org/FAQPage"}]}
          </script>
        </head>
        <body>
          <h1>Title</h1>
          <h2>Section</h2>
          <h2>   </h2>
          <p>${'word '.repeat(80)}</p>
        </body>
      </html>
    `;
    const result = analyzeHtml(html, 'https://example.com/');
    expect(result.author).toBe('Ada Lovelace');
    expect(result.h2Count).toBe(1);
    expect(result.bodyTextLength).toBeGreaterThan(300);
    expect(result.usefulJsonLdTypes).toEqual(['FAQPage']);
    expect(result.mixedContentSample).toEqual([]);
  });

  test('reads rel=author when meta author is absent', () => {
    const html =
      '<html><head><link rel="author" href="https://example.com/ada" /></head><body></body></html>';
    expect(analyzeHtml(html, 'https://example.com/').author).toBe('https://example.com/ada');
  });

  test('samples at most five http assets on an https page and ignores canonical links', () => {
    const scripts = [1, 2, 3, 4, 5, 6]
      .map((n) => `<script src="http://cdn.example.com/a${n}.js"></script>`)
      .join('');
    const html = `
      <html>
        <head>
          <link rel="canonical" href="http://example.com/old" />
          <link rel="stylesheet" href="https://cdn.example.com/ok.css" />
          ${scripts}
          <img src="http://cdn.example.com/a1.js" />
        </head>
        <body><p>Hello</p></body>
      </html>
    `;
    const result = analyzeHtml(html, 'https://example.com/');
    expect(result.mixedContentSample).toEqual([
      'http://cdn.example.com/a1.js',
      'http://cdn.example.com/a2.js',
      'http://cdn.example.com/a3.js',
      'http://cdn.example.com/a4.js',
      'http://cdn.example.com/a5.js',
    ]);
  });

  test('does not report mixed content on an http page', () => {
    const html =
      '<html><body><img src="http://cdn.example.com/a.png" /><script src="http://cdn.example.com/a.js"></script></body></html>';
    expect(analyzeHtml(html, 'http://example.com/').mixedContentSample).toEqual([]);
  });

  test('collects generator and asset path hits for technology fingerprinting', () => {
    const html = `
      <html>
        <head>
          <meta name="generator" content="WordPress 6.4.2" />
          <script src="/wp-includes/js/wp-embed.js"></script>
          <link rel="stylesheet" href="/wp-content/themes/t/style.css" />
          <link rel="preload" href="/_nuxt/should-not-count.js" />
          <img src="https://cdn.shopify.com/s/files/pic.png" />
          <a href="/_next/static/should-not-count.js">skip</a>
        </head>
        <body></body>
      </html>
    `;
    const result = analyzeHtml(html, 'https://example.com/');
    expect(result.techHints.generator).toBe('WordPress 6.4.2');
    expect(result.techHints.pathHits).toEqual(
      expect.arrayContaining(['/wp-content/', '/wp-includes/', 'cdn.shopify.com']),
    );
    expect(result.techHints.pathHits).not.toEqual(expect.arrayContaining(['/_next/', '/_nuxt/']));
  });

  test('truncates a long generator and returns no path hits when assets have none', () => {
    const html = `<html><head><meta name="generator" content="${'G'.repeat(250)}" /></head><body></body></html>`;
    const result = analyzeHtml(html, 'https://example.com/');
    expect(result.techHints.generator).toHaveLength(201);
    expect(result.techHints.generator.endsWith('…')).toBe(true);
    expect(result.techHints.pathHits).toEqual([]);
    expect(
      analyzeHtml(
        '<html><head><meta name="generator" content="   " /></head></html>',
        'https://example.com/',
      ).techHints,
    ).toEqual({
      generator: null,
      pathHits: [],
    });
  });

  test('caps unique path hits at 20', () => {
    const { TECH_FINGERPRINT_CATALOG } = require('../techFingerprintCatalog');
    const fragments = [];
    for (const entry of TECH_FINGERPRINT_CATALOG) {
      for (const fragment of entry.match.pathIncludes || []) {
        if (!fragments.includes(fragment)) fragments.push(fragment);
      }
    }
    expect(fragments.length).toBeGreaterThan(20);
    const scripts = fragments
      .map((fragment) => {
        const path = fragment.startsWith('/') ? fragment : `/${fragment}`;
        return `<script src="https://cdn.example.com${path}asset.js"></script>`;
      })
      .join('');
    const result = analyzeHtml(
      `<html><head>${scripts}</head><body></body></html>`,
      'https://example.com/',
    );
    expect(result.techHints.pathHits).toHaveLength(20);
    expect(new Set(result.techHints.pathHits).size).toBe(20);
  });
});
