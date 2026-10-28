import type { SiteAuditPageResult } from '../../types/site-audits';
import {
  compareSiteAuditPagesByField,
  isSiteAuditPageAscDefaultField,
  sortSiteAuditPages,
} from '../siteAuditPageSort';

function page(
  partial: Pick<SiteAuditPageResult, 'url'> & Partial<SiteAuditPageResult>,
): SiteAuditPageResult {
  return partial;
}

describe('site audit pages table sort', () => {
  const pages: SiteAuditPageResult[] = [
    page({ url: '/b', title: 'Beta', statusCode: 404, score: 40 }),
    page({ url: '/a', title: 'Alpha', statusCode: 200, score: 90 }),
    page({ url: '/c', title: null, statusCode: null, score: null }),
  ];

  test('url and title default to ascending', () => {
    expect(isSiteAuditPageAscDefaultField('url')).toBe(true);
    expect(isSiteAuditPageAscDefaultField('title')).toBe(true);
    expect(isSiteAuditPageAscDefaultField('statusCode')).toBe(false);
    expect(isSiteAuditPageAscDefaultField('score')).toBe(false);
  });

  test('sorts by url ascending', () => {
    expect(sortSiteAuditPages(pages, 'url', 'asc').map((item) => item.url)).toEqual([
      '/a',
      '/b',
      '/c',
    ]);
  });

  test('sorts by score descending with nulls last when desc', () => {
    expect(sortSiteAuditPages(pages, 'score', 'desc').map((item) => item.url)).toEqual([
      '/a',
      '/b',
      '/c',
    ]);
  });

  test('sorts by status code ascending with null as -1', () => {
    expect(sortSiteAuditPages(pages, 'statusCode', 'asc').map((item) => item.url)).toEqual([
      '/c',
      '/a',
      '/b',
    ]);
  });

  test('compare flips when order is desc', () => {
    const a = page({ url: '/a', score: 10 });
    const b = page({ url: '/b', score: 20 });
    expect(compareSiteAuditPagesByField(a, b, 'score', 'asc')).toBeLessThan(0);
    expect(compareSiteAuditPagesByField(a, b, 'score', 'desc')).toBeGreaterThan(0);
  });
});
