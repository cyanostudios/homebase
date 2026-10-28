/**
 * Client-side diff of a site run vs the previous done site run (etapp 1.4).
 * See docs/ai/adr/SITE_AUDITS_ETAPP1_4.md.
 */
import {
  SITE_AUDIT_CATEGORY_IDS,
  type SiteAuditCategoryId,
  type SiteAuditFinding,
  type SiteAuditFindingSeverity,
  type SiteAuditRun,
} from '../types/site-audits';

const ACTIONABLE_SEVERITIES = new Set<SiteAuditFindingSeverity>(['critical', 'warning']);

export interface SiteAuditRunDiffFinding {
  severity: SiteAuditFindingSeverity;
  message: string;
  code?: string;
  url?: string;
}

export interface SiteAuditRunDiff {
  baselineRunId: string;
  scoreDelta: number | null;
  categoryDeltas: Partial<Record<SiteAuditCategoryId, number>>;
  added: SiteAuditRunDiffFinding[];
  resolved: SiteAuditRunDiffFinding[];
}

function runStartedMs(run: Pick<SiteAuditRun, 'startedAt'>): number | null {
  if (!run.startedAt) {
    return null;
  }
  const ms = new Date(run.startedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Prefer stable `code` (+ url when present); else code|message|url normalized. */
export function siteAuditFindingFingerprint(finding: SiteAuditFinding): string {
  const code = typeof finding.code === 'string' ? finding.code.trim().toLowerCase() : '';
  const message = String(finding.message ?? '')
    .trim()
    .toLowerCase();
  const url = typeof finding.url === 'string' ? finding.url.trim().toLowerCase() : '';
  if (code) {
    return url ? `${code}|${url}` : code;
  }
  return [code, message, url].filter(Boolean).join('|');
}

function toDiffFinding(finding: SiteAuditFinding): SiteAuditRunDiffFinding {
  return {
    severity: finding.severity,
    message: String(finding.message ?? ''),
    ...(typeof finding.code === 'string' && finding.code ? { code: finding.code } : {}),
    ...(typeof finding.url === 'string' && finding.url ? { url: finding.url } : {}),
  };
}

function actionableFindings(run: SiteAuditRun | null | undefined): SiteAuditFinding[] {
  const list = Array.isArray(run?.summary?.findings) ? run!.summary!.findings! : [];
  return list.filter((f) => f && ACTIONABLE_SEVERITIES.has(f.severity as SiteAuditFindingSeverity));
}

/**
 * Previous **done** site run older than `selected` by `startedAt`.
 * Ignores cancelled / failed / queued / running.
 */
export function findPreviousDoneSiteRun(
  selected: SiteAuditRun | null | undefined,
  siteRuns: SiteAuditRun[],
): SiteAuditRun | null {
  if (!selected) {
    return null;
  }
  const selectedTime = runStartedMs(selected);
  if (selectedTime === null) {
    return null;
  }
  const siteAuditId = String(selected.siteAuditId ?? '');
  let best: SiteAuditRun | null = null;
  let bestTime = -Infinity;
  for (const run of siteRuns) {
    if (!run || String(run.id) === String(selected.id)) {
      continue;
    }
    if (run.target && run.target !== 'site') {
      continue;
    }
    if (run.status !== 'done') {
      continue;
    }
    if (siteAuditId && String(run.siteAuditId) && String(run.siteAuditId) !== siteAuditId) {
      continue;
    }
    const time = runStartedMs(run);
    if (time === null || time >= selectedTime) {
      continue;
    }
    if (time > bestTime) {
      bestTime = time;
      best = run;
    }
  }
  return best;
}

export function computeSiteAuditRunDiff(
  current: SiteAuditRun | null | undefined,
  baseline: SiteAuditRun | null | undefined,
): SiteAuditRunDiff | null {
  if (!current || !baseline || baseline.status !== 'done') {
    return null;
  }

  const currentScore =
    typeof current.score === 'number'
      ? current.score
      : typeof current.summary?.score === 'number'
        ? current.summary.score
        : null;
  const baselineScore =
    typeof baseline.score === 'number'
      ? baseline.score
      : typeof baseline.summary?.score === 'number'
        ? baseline.summary.score
        : null;
  const scoreDelta =
    currentScore !== null && baselineScore !== null ? currentScore - baselineScore : null;

  const categoryDeltas: Partial<Record<SiteAuditCategoryId, number>> = {};
  for (const categoryId of SITE_AUDIT_CATEGORY_IDS) {
    const cur = current.summary?.categories?.[categoryId];
    const base = baseline.summary?.categories?.[categoryId];
    if (typeof cur === 'number' && typeof base === 'number') {
      categoryDeltas[categoryId] = cur - base;
    }
  }

  const currentMap = new Map<string, SiteAuditFinding>();
  for (const finding of actionableFindings(current)) {
    currentMap.set(siteAuditFindingFingerprint(finding), finding);
  }
  const baselineMap = new Map<string, SiteAuditFinding>();
  for (const finding of actionableFindings(baseline)) {
    baselineMap.set(siteAuditFindingFingerprint(finding), finding);
  }

  const added: SiteAuditRunDiffFinding[] = [];
  for (const [key, finding] of currentMap) {
    if (!baselineMap.has(key)) {
      added.push(toDiffFinding(finding));
    }
  }
  const resolved: SiteAuditRunDiffFinding[] = [];
  for (const [key, finding] of baselineMap) {
    if (!currentMap.has(key)) {
      resolved.push(toDiffFinding(finding));
    }
  }

  const severityRank = (s: SiteAuditFindingSeverity) =>
    s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
  const sortFindings = (a: SiteAuditRunDiffFinding, b: SiteAuditRunDiffFinding) =>
    severityRank(a.severity) - severityRank(b.severity) || a.message.localeCompare(b.message);

  added.sort(sortFindings);
  resolved.sort(sortFindings);

  return {
    baselineRunId: String(baseline.id),
    scoreDelta,
    categoryDeltas,
    added,
    resolved,
  };
}

/** Compact signed delta for History / Overview (e.g. `+4`, `−2`, `0`). */
export function formatSiteAuditScoreDelta(delta: number | null | undefined): string | null {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return null;
  }
  const rounded = Math.round(delta);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  if (rounded < 0) {
    return String(rounded);
  }
  return '0';
}
