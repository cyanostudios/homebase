import type { SiteAuditPageResult } from '../../types/site-audits';
import {
  filterSiteAuditPages,
  filterSiteAuditPagesByExclude,
  parseSiteAuditPageFilterTerms,
} from '../siteAuditPageFilter';

function page(
  partial: Pick<SiteAuditPageResult, 'url'> & Partial<SiteAuditPageResult>,
): SiteAuditPageResult {
  return { ...partial };
}

describe('parseSiteAuditPageFilterTerms', () => {
  test('empty and whitespace yield no terms', () => {
    expect(parseSiteAuditPageFilterTerms('')).toEqual([]);
    expect(parseSiteAuditPageFilterTerms('   ')).toEqual([]);
  });

  test('splits on commas and whitespace and lowercases', () => {
    expect(parseSiteAuditPageFilterTerms('/Asset/, wp-content  .map')).toEqual([
      '/asset/',
      'wp-content',
      '.map',
    ]);
  });

  test('dedupes terms', () => {
    expect(parseSiteAuditPageFilterTerms('/asset/ /Asset/')).toEqual(['/asset/']);
  });
});

describe('filterSiteAuditPages', () => {
  const pages = [
    page({ url: 'https://example.com/x' }),
    page({ url: 'https://example.com/y' }),
    page({ url: 'https://example.com/z' }),
    page({ url: 'https://example.com/asset/logo.png' }),
    page({ url: 'https://example.com/blog/post' }),
    page({ url: 'https://example.com/wp-content/themes/x.css' }),
  ];

  test('empty include and exclude returns all pages', () => {
    expect(filterSiteAuditPages(pages, {}).map((p) => p.url)).toEqual(pages.map((p) => p.url));
  });

  test('include only keeps URLs matching any include term', () => {
    expect(filterSiteAuditPages(pages, { include: ['/blog'] }).map((p) => p.url)).toEqual([
      'https://example.com/blog/post',
    ]);
  });

  test('exclude only drops URLs matching any exclude term', () => {
    expect(
      filterSiteAuditPages(pages, { exclude: ['/asset/', 'wp-content'] }).map((p) => p.url),
    ).toEqual([
      'https://example.com/x',
      'https://example.com/y',
      'https://example.com/z',
      'https://example.com/blog/post',
    ]);
  });

  test('include and exclude compose: among /x /y /z, include /x+/z exclude /y → /x and /z', () => {
    const xyz = [
      page({ url: 'https://example.com/x' }),
      page({ url: 'https://example.com/y' }),
      page({ url: 'https://example.com/z' }),
    ];
    expect(
      filterSiteAuditPages(xyz, { include: ['/x', '/z'], exclude: ['/y'] }).map((p) => p.url),
    ).toEqual(['https://example.com/x', 'https://example.com/z']);
  });

  test('include Z exclude Y from XYZ shows Z', () => {
    const xyz = [
      page({ url: 'https://example.com/x' }),
      page({ url: 'https://example.com/y' }),
      page({ url: 'https://example.com/z' }),
    ];
    expect(
      filterSiteAuditPages(xyz, { include: ['/z'], exclude: ['/y'] }).map((p) => p.url),
    ).toEqual(['https://example.com/z']);
  });

  test('matches finalUrl when present', () => {
    const withFinal = [
      page({ url: 'https://example.com/old', finalUrl: 'https://example.com/asset/new' }),
      page({ url: 'https://example.com/ok' }),
    ];
    expect(filterSiteAuditPages(withFinal, { exclude: ['/asset/'] }).map((p) => p.url)).toEqual([
      'https://example.com/ok',
    ]);
  });

  test('filterSiteAuditPagesByExclude remains a thin exclude wrapper', () => {
    expect(filterSiteAuditPagesByExclude(pages, '/asset/').map((p) => p.url)).toEqual(
      filterSiteAuditPages(pages, { exclude: ['/asset/'] }).map((p) => p.url),
    );
  });
});
