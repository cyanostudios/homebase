import { formatDate } from '@/core/utils/dateFormat';

export type SiteAuditRelativeTimeTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Compact "time ago" for the list meta row (e.g. "2h ago", "3d ago"). Falls back to a plain
 * date for anything older than a week or in the future.
 */
export function formatSiteAuditRelativeTime(
  value: string | null | undefined,
  t: SiteAuditRelativeTimeTranslate,
): string | null {
  if (!value) {
    return null;
  }
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) {
    return null;
  }
  const diffMs = Date.now() - then;
  if (diffMs < 0) {
    return formatDate(value);
  }
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return t('siteAudits.relative.justNow');
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return t('siteAudits.relative.minutesAgo', { count: diffMin });
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return t('siteAudits.relative.hoursAgo', { count: diffHour });
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return t('siteAudits.relative.daysAgo', { count: diffDay });
  }
  return formatDate(value);
}

export function formatSiteAuditScore(score: number | null | undefined): string {
  return typeof score === 'number' ? String(Math.round(score)) : '—';
}

export function siteAuditFindingKey(
  finding: { severity?: string; code?: string; message?: string; url?: string },
  seen: Map<string, number>,
): string {
  const base = [finding.severity, finding.code, finding.message, finding.url]
    .map((part) => part ?? '')
    .join('|');
  const next = (seen.get(base) ?? 0) + 1;
  seen.set(base, next);
  return `${base}#${next}`;
}
