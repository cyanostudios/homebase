import type { SiteAudit } from '../types/site-audits';

export type SiteAuditSortField =
  | 'name'
  | 'url'
  | 'lastScore'
  | 'lastRunAt'
  | 'updatedAt'
  | 'createdAt';
export type SiteAuditSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: SiteAuditSortField[] = ['name', 'url'];

export function isSiteAuditAscDefaultField(field: SiteAuditSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

function toTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function compareSiteAuditsByField(
  a: SiteAudit,
  b: SiteAudit,
  field: SiteAuditSortField,
  order: SiteAuditSortOrder,
): number {
  let result = 0;

  if (field === 'name' || field === 'url') {
    const av = String(a[field] || '').toLowerCase();
    const bv = String(b[field] || '').toLowerCase();
    result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
  } else if (field === 'lastScore') {
    const av = a.lastScore ?? -1;
    const bv = b.lastScore ?? -1;
    result = av - bv;
  } else {
    result = toTime(a[field]) - toTime(b[field]);
  }

  return order === 'asc' ? result : -result;
}
