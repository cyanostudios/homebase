export type PanelMode = 'create' | 'edit' | 'view';

export interface ValidationError {
  field: string;
  message: string;
}

export interface SiteAudit {
  id: string;
  name: string;
  url: string;
  competitorUrl: string | null;
  lastScore: number | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteAuditPayload {
  name: string;
  url: string;
  competitorUrl?: string | null;
}

export type SiteAuditRunTarget = 'site' | 'competitor';
export type SiteAuditRunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
/** Crawl intensity for `POST /:id/runs` (etapp 1.4). Default on the server is `full`. */
export type SiteAuditRunMode = 'full' | 'quick';

export interface StartSiteAuditRunOptions {
  mode?: SiteAuditRunMode;
}

export type SiteAuditFindingSeverity = 'critical' | 'warning' | 'info';

/** Overview grouping. Missing or unknown values are treated as `seo` in the UI. */
export type SiteAuditPillar = 'seo' | 'ai' | 'security';

export interface SiteAuditFinding {
  severity: SiteAuditFindingSeverity;
  category: string;
  message: string;
  code?: string;
  url?: string;
  pillar?: SiteAuditPillar;
  [key: string]: unknown;
}

export interface SiteAuditCategoryScores {
  indexing: number;
  content: number;
  technical: number;
  sharing: number;
}

export type SiteAuditCategoryId = keyof SiteAuditCategoryScores;

export interface SiteAuditPageResult {
  url: string;
  title?: string | null;
  statusCode?: number | null;
  score?: number | null;
  categories?: SiteAuditCategoryScores;
  findings?: SiteAuditFinding[];
  shellOnly?: boolean;
  [key: string]: unknown;
}

export interface SiteAuditCompareCategoryDelta {
  site: number;
  competitor: number;
  delta: number;
}

/** Shape produced by `services/compare.js` `compareSummaries()`, attached as `summary.comparison`. */
export interface SiteAuditComparison {
  siteScore: number | null;
  competitorScore: number | null;
  scoreDelta: number;
  categories: Partial<Record<SiteAuditCategoryId, SiteAuditCompareCategoryDelta>>;
}

/** Presence + truncated value for one security header row (etapp 1.2). */
export interface SiteAuditHeaderPresence {
  present: boolean;
  value?: string | null;
  via?: 'xfo' | 'csp' | null;
}

/** One fingerprint hit stored on `summary.siteMeta.technologies` (etapp 1.3). */
export interface SiteAuditTechnologyEvidence {
  kind: string;
  value: string;
}

export interface SiteAuditTechnologyItem {
  id: string;
  name: string;
  category: string;
  evidence: SiteAuditTechnologyEvidence[];
}

/** Curated local catalog result. `catalogVersion` tracks rule evolution. */
export interface SiteAuditTechnologies {
  items: SiteAuditTechnologyItem[];
  catalogVersion: number;
}

/** Persisted `summary.siteMeta` inventory fields (etapp 1.1 + 1.2 + 1.3). */
export interface SiteAuditSiteMeta {
  robotsTxtFound?: boolean;
  sitemapFound?: boolean;
  llmsTxtFound?: boolean;
  aiBotRobots?: unknown;
  cookieFlags?: unknown;
  mixedContentSample?: unknown;
  securityProbes?: unknown;
  securityHeaders?: {
    hsts?: SiteAuditHeaderPresence;
    csp?: SiteAuditHeaderPresence;
    xcto?: SiteAuditHeaderPresence;
    referrerPolicy?: SiteAuditHeaderPresence;
    permissionsPolicy?: SiteAuditHeaderPresence;
    frameProtection?: SiteAuditHeaderPresence;
  };
  tls?: {
    ok?: boolean;
    protocol?: string | null;
    authorized?: boolean | null;
    validFrom?: string | null;
    validTo?: string | null;
    daysRemaining?: number | null;
    issuer?: string | null;
    hostnameMatch?: boolean | null;
    error?: string | null;
  };
  dns?: {
    ok?: boolean;
    aCount?: number;
    aaaaCount?: number;
    ns?: string[];
    caa?: string[];
    spfPresent?: boolean;
    dmarcPresent?: boolean;
    error?: string | null;
  };
  resources?: {
    scriptCount?: number;
    stylesheetCount?: number;
    imageCount?: number;
    asyncScripts?: number;
    deferScripts?: number;
    hasManifest?: boolean;
    hasServiceWorkerHint?: boolean;
    thirdPartyScriptHostCount?: number;
    thirdPartyScriptHosts?: string[];
    thirdPartyHosts?: string[];
    missingDimensionSample?: string[];
  };
  crawlGraph?: {
    pageCount?: number;
    homepageUrl?: string | null;
    sitemapUrlCount?: number;
    sitemapOnlyCount?: number;
    crawledNotInSitemapCount?: number;
    maxDepth?: number;
    sitemapOnlySample?: string[];
    crawledNotInSitemapSample?: string[];
  };
  compression?: {
    contentEncoding?: string | null;
    ok?: boolean;
    error?: string | null;
  };
  /** Detected technologies from the local fingerprint catalog (etapp 1.3). */
  technologies?: SiteAuditTechnologies;
  /** Start-URL path prefix when the crawl is scoped (null/omitted = whole host). */
  pathScope?: string | null;
  /** Crawl mode for this run (etapp 1.4). Omitted on legacy runs → treat as full. */
  auditMode?: SiteAuditRunMode | string | null;
  [key: string]: unknown;
}

export interface SiteAuditRunSummary {
  score?: number;
  categories?: SiteAuditCategoryScores;
  findings?: SiteAuditFinding[];
  shellOnly?: boolean;
  shellOnlyPageCount?: number;
  pageCount?: number;
  siteMeta?: SiteAuditSiteMeta;
  /** Attached once both site + competitor legs of a run batch finish (see compare.js). */
  comparison?: SiteAuditComparison;
  /** Defensive alias in case the backend evolves to use this key instead. */
  compare?: SiteAuditComparison;
  [key: string]: unknown;
}

export interface SiteAuditRun {
  id: string;
  siteAuditId: string;
  target: SiteAuditRunTarget;
  status: SiteAuditRunStatus;
  score: number | null;
  summary: SiteAuditRunSummary | null;
  pages: SiteAuditPageResult[] | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Response of `POST /:id/runs` — see plugins/site-audits/services/runAudit.js `startRun()`. */
export interface StartSiteAuditRunResponse {
  site: SiteAudit;
  run: SiteAuditRun;
  competitorRun: SiteAuditRun | null;
}

export const SITE_AUDIT_CATEGORY_IDS: SiteAuditCategoryId[] = [
  'indexing',
  'content',
  'technical',
  'sharing',
];

/** Fixed Overview order: SEO, AI readiness, Security. */
export const SITE_AUDIT_PILLAR_IDS: SiteAuditPillar[] = ['seo', 'ai', 'security'];

export function isSiteAuditRunActive(
  run: Pick<SiteAuditRun, 'status'> | null | undefined,
): boolean {
  return run?.status === 'queued' || run?.status === 'running';
}
