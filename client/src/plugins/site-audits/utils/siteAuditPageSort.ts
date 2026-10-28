import type { SiteAuditPageResult } from '../types/site-audits';

export type SiteAuditPageSortField = 'url' | 'title' | 'statusCode' | 'score';
export type SiteAuditPageSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: SiteAuditPageSortField[] = ['url', 'title'];

export function isSiteAuditPageAscDefaultField(field: SiteAuditPageSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function compareSiteAuditPagesByField(
  a: SiteAuditPageResult,
  b: SiteAuditPageResult,
  field: SiteAuditPageSortField,
  order: SiteAuditPageSortOrder,
): number {
  let result = 0;

  if (field === 'url' || field === 'title') {
    const av = String(a[field] || '').toLowerCase();
    const bv = String(b[field] || '').toLowerCase();
    result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
  } else if (field === 'statusCode') {
    const av = a.statusCode ?? -1;
    const bv = b.statusCode ?? -1;
    result = av - bv;
  } else {
    const av = a.score ?? -1;
    const bv = b.score ?? -1;
    result = av - bv;
  }

  return order === 'asc' ? result : -result;
}

export function sortSiteAuditPages(
  pages: readonly SiteAuditPageResult[],
  field: SiteAuditPageSortField,
  order: SiteAuditPageSortOrder,
): SiteAuditPageResult[] {
  return [...pages].sort((a, b) => compareSiteAuditPagesByField(a, b, field, order));
}
