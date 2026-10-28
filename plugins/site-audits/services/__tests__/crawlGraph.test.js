const { buildCrawlGraph } = require('../crawlGraph');

describe('crawlGraph', () => {
  test('counts sitemap-only and crawled-not-in-sitemap URLs', () => {
    const graph = buildCrawlGraph({
      homepageUrl: 'https://example.com/',
      pages: [
        { url: 'https://example.com/', finalUrl: 'https://example.com/', depth: 0 },
        { url: 'https://example.com/a', finalUrl: 'https://example.com/a', depth: 1 },
        { url: 'https://example.com/extra', finalUrl: 'https://example.com/extra', depth: 1 },
      ],
      sitemapUrls: ['https://example.com/', 'https://example.com/a', 'https://example.com/missing'],
    });
    expect(graph.pageCount).toBe(3);
    expect(graph.maxDepth).toBe(1);
    expect(graph.sitemapOnlyCount).toBe(1);
    expect(graph.sitemapOnlySample).toContain('https://example.com/missing');
    expect(graph.crawledNotInSitemapCount).toBe(1);
    expect(graph.crawledNotInSitemapSample).toContain('https://example.com/extra');
  });
});
