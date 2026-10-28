import {
  SITE_AUDIT_CATEGORY_IDS,
  type SiteAuditComparison,
  type SiteAuditRun,
  type SiteAuditRunSummary,
} from '../types/site-audits';

/** Site + competitor legs of one POST /runs are inserted back-to-back. */
const BATCH_WINDOW_MS = 2 * 60 * 1000;

export interface SiteAuditFindingCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export function isComparableSiteAuditSummary(
  summary: SiteAuditRunSummary | null | undefined,
): summary is SiteAuditRunSummary {
  return Boolean(summary && typeof summary.score === 'number' && summary.categories);
}

/**
 * Client-side fallback mirroring `plugins/site-audits/services/compare.js` `compareSummaries()`.
 * Only used when a run's `summary.comparison` has not been attached yet (e.g. the competitor
 * leg finished slightly out of order, or a legacy run predates the comparison feature).
 */
export function computeSiteAuditComparison(
  siteSummary: SiteAuditRunSummary | null | undefined,
  competitorSummary: SiteAuditRunSummary | null | undefined,
): SiteAuditComparison {
  const categories: SiteAuditComparison['categories'] = {};
  for (const categoryId of SITE_AUDIT_CATEGORY_IDS) {
    const site = siteSummary?.categories?.[categoryId] ?? 0;
    const competitor = competitorSummary?.categories?.[categoryId] ?? 0;
    categories[categoryId] = { site, competitor, delta: site - competitor };
  }
  const siteScore = siteSummary?.score ?? null;
  const competitorScore = competitorSummary?.score ?? null;
  return {
    siteScore,
    competitorScore,
    scoreDelta: (siteScore ?? 0) - (competitorScore ?? 0),
    categories,
  };
}

function hasAttachedComparison(
  value: SiteAuditComparison | null | undefined,
): value is SiteAuditComparison {
  if (!value) {
    return false;
  }
  return (
    typeof value.siteScore === 'number' ||
    typeof value.competitorScore === 'number' ||
    Boolean(value.categories)
  );
}

export function getSiteAuditComparison(
  siteSummary: SiteAuditRunSummary | null | undefined,
  competitorSummary: SiteAuditRunSummary | null | undefined,
): SiteAuditComparison | null {
  const attached = siteSummary?.comparison ?? siteSummary?.compare ?? null;
  if (hasAttachedComparison(attached)) {
    return attached;
  }
  if (
    isComparableSiteAuditSummary(siteSummary) &&
    isComparableSiteAuditSummary(competitorSummary)
  ) {
    return computeSiteAuditComparison(siteSummary, competitorSummary);
  }
  return null;
}

/**
 * Competitor leg created with the same manual run. Queued summaries are `{}` and are not a
 * comparison. A later batch (outside the window) must not be paired with an older site run.
 */
export function findBatchCompetitorRun(
  siteRun: Pick<SiteAuditRun, 'startedAt'> | null | undefined,
  competitorRuns: SiteAuditRun[],
): SiteAuditRun | null {
  if (!siteRun?.startedAt || competitorRuns.length === 0) {
    return null;
  }
  const siteTime = new Date(siteRun.startedAt).getTime();
  if (!Number.isFinite(siteTime)) {
    return null;
  }
  let best: SiteAuditRun | null = null;
  let bestDelta = Infinity;
  for (const run of competitorRuns) {
    if (!run.startedAt) {
      continue;
    }
    const time = new Date(run.startedAt).getTime();
    if (!Number.isFinite(time)) {
      continue;
    }
    const delta = Math.abs(time - siteTime);
    if (delta <= BATCH_WINDOW_MS && delta < bestDelta) {
      best = run;
      bestDelta = delta;
    }
  }
  return best;
}

export function countSiteAuditFindings(
  summary: SiteAuditRunSummary | null | undefined,
): SiteAuditFindingCounts {
  const counts: SiteAuditFindingCounts = { total: 0, critical: 0, warning: 0, info: 0 };
  const findings = Array.isArray(summary?.findings) ? summary.findings : [];
  for (const finding of findings) {
    counts.total += 1;
    if (
      finding.severity === 'critical' ||
      finding.severity === 'warning' ||
      finding.severity === 'info'
    ) {
      counts[finding.severity] += 1;
    }
  }
  return counts;
}
