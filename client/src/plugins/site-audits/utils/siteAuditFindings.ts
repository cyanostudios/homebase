import type { SiteAuditFinding, SiteAuditPillar } from '../types/site-audits';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export type SiteAuditFindingSeverityCounts = {
  total: number;
  critical: number;
  warning: number;
  info: number;
};

/** Count findings by severity for collapsed section meta. */
export function countSiteAuditFindingSeverities(
  findings: readonly SiteAuditFinding[],
): SiteAuditFindingSeverityCounts {
  const counts: SiteAuditFindingSeverityCounts = {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
  };
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

/**
 * Severity order is critical → warning → info.
 * Equal severity keeps API order (stable sort).
 */
export function sortSiteAuditFindingsBySeverity(
  findings: readonly SiteAuditFinding[],
): SiteAuditFinding[] {
  return [...findings].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  );
}

/** Missing or unrecognized pillar is SEO. Does not affect score category. */
export function siteAuditFindingPillar(finding: SiteAuditFinding): SiteAuditPillar {
  if (finding.pillar === 'seo' || finding.pillar === 'ai' || finding.pillar === 'security') {
    return finding.pillar;
  }
  return 'seo';
}

/** Critical and warning only. Info stays in the pillar sections. */
export function selectSiteAuditQuickWins(
  findings: readonly SiteAuditFinding[],
): SiteAuditFinding[] {
  return sortSiteAuditFindingsBySeverity(
    findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'warning'),
  );
}

export function selectSiteAuditPillarFindings(
  findings: readonly SiteAuditFinding[],
  pillar: SiteAuditPillar,
): SiteAuditFinding[] {
  return sortSiteAuditFindingsBySeverity(
    findings.filter((finding) => siteAuditFindingPillar(finding) === pillar),
  );
}
