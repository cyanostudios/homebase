/**
 * Technical inventory tab (etapp 1.2 + 1.3) — headers, TLS, DNS, detected
 * technologies, resources, crawl coverage. Plain text only.
 * See docs/ai/design/SITE_AUDITS_UX.md and SITE_AUDITS_ETAPP1_3.md.
 */
import { Check, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_EMPTY_STATE_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type {
  SiteAuditRunSummary,
  SiteAuditSiteMeta,
  SiteAuditTechnologies,
  SiteAuditTechnologyItem,
} from '../types/site-audits';

export type SiteAuditTechnicalSection =
  | 'headers'
  | 'tls'
  | 'dns'
  | 'technologies'
  | 'resources'
  | 'crawl';

export const SITE_AUDIT_TECHNICAL_SECURITY_SECTIONS: SiteAuditTechnicalSection[] = [
  'headers',
  'tls',
  'dns',
];

export const SITE_AUDIT_TECHNICAL_INFRA_SECTIONS: SiteAuditTechnicalSection[] = [
  'technologies',
  'resources',
  'crawl',
];

const ALL_TECHNICAL_SECTIONS: SiteAuditTechnicalSection[] = [
  'headers',
  'tls',
  'dns',
  'technologies',
  'resources',
  'crawl',
];

/** Fixed catalog order from SITE_AUDITS_ETAPP1_3. Unknown categories render after these. */
const TECHNOLOGY_CATEGORY_ORDER = [
  'cms',
  'ecommerce',
  'analytics',
  'cdn',
  'framework',
  'chat',
  'marketing',
  'other',
] as const;

function technologyEvidenceLine(item: SiteAuditTechnologyItem): string {
  if (!Array.isArray(item.evidence)) return '';
  return item.evidence
    .map((entry) => {
      const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
      const value = typeof entry?.value === 'string' ? entry.value.trim() : '';
      if (kind && value) return `${kind} ${value}`;
      return kind || value;
    })
    .filter(Boolean)
    .join(' · ');
}

function technologyLabel(item: SiteAuditTechnologyItem): string {
  if (typeof item.name === 'string' && item.name.trim()) return item.name.trim();
  if (typeof item.id === 'string' && item.id.trim()) return item.id.trim();
  return '—';
}

function groupTechnologies(
  technologies: SiteAuditTechnologies | undefined,
): Array<{ category: string; items: SiteAuditTechnologyItem[] }> {
  const items = Array.isArray(technologies?.items) ? technologies.items : [];
  const buckets = new Map<string, SiteAuditTechnologyItem[]>();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const raw = typeof item.category === 'string' ? item.category.trim() : '';
    const category = raw || 'other';
    const list = buckets.get(category) ?? [];
    list.push({ ...item, id: item.id || `technology-${index}` });
    buckets.set(category, list);
  });

  const groups: Array<{ category: string; items: SiteAuditTechnologyItem[] }> = [];
  for (const category of TECHNOLOGY_CATEGORY_ORDER) {
    const group = buckets.get(category);
    if (group?.length) groups.push({ category, items: group });
    buckets.delete(category);
  }
  for (const [category, group] of buckets) {
    if (group.length) groups.push({ category, items: group });
  }
  return groups;
}

function asSiteMeta(summary: SiteAuditRunSummary | null | undefined): SiteAuditSiteMeta | null {
  if (!summary || typeof summary !== 'object') return null;
  const meta = summary.siteMeta;
  if (!meta || typeof meta !== 'object') return null;
  return meta as SiteAuditSiteMeta;
}

function PresenceIcon({ present }: { present: boolean }) {
  return present ? (
    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
  ) : (
    <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
  );
}

function InventorySection({
  title,
  meta,
  children,
  empty,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={title}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen={false}
        titleAside={
          meta ? (
            <span className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
              {meta}
            </span>
          ) : null
        }
      >
        {empty ? <p className={DETAIL_EMPTY_STATE_CLASS}>{children}</p> : children}
      </DetailSection>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right text-foreground">{value}</span>
    </div>
  );
}

export function SiteAuditTechnicalView({
  summary,
  runsLoading,
  hasRun,
  sections = ALL_TECHNICAL_SECTIONS,
}: {
  summary: SiteAuditRunSummary | null;
  runsLoading: boolean;
  hasRun: boolean;
  /** Which inventory blocks to show. Default: all. Security tab uses headers/tls/dns. */
  sections?: SiteAuditTechnicalSection[];
}) {
  const { t } = useTranslation();
  const siteMeta = asSiteMeta(summary);
  const show = (section: SiteAuditTechnicalSection) => sections.includes(section);

  if (runsLoading) {
    return (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('siteAudits.tabs.technical')}
          subtleTitle
          className="p-4 sm:p-6"
          collapsible
          defaultOpen
        >
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</p>
        </DetailSection>
      </Card>
    );
  }

  if (!hasRun || !siteMeta) {
    return (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('siteAudits.tabs.technical')}
          subtleTitle
          className="p-4 sm:p-6"
          collapsible
          defaultOpen
        >
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.noRunsYet')}</p>
        </DetailSection>
      </Card>
    );
  }

  const headers = siteMeta.securityHeaders;
  const headerRows = headers
    ? [
        { key: 'hsts', label: t('siteAudits.technical.headers.hsts'), entry: headers.hsts },
        { key: 'csp', label: t('siteAudits.technical.headers.csp'), entry: headers.csp },
        { key: 'xcto', label: t('siteAudits.technical.headers.xcto'), entry: headers.xcto },
        {
          key: 'referrerPolicy',
          label: t('siteAudits.technical.headers.referrerPolicy'),
          entry: headers.referrerPolicy,
        },
        {
          key: 'permissionsPolicy',
          label: t('siteAudits.technical.headers.permissionsPolicy'),
          entry: headers.permissionsPolicy,
        },
        {
          key: 'frameProtection',
          label: t('siteAudits.technical.headers.frameProtection'),
          entry: headers.frameProtection,
        },
      ]
    : [];
  const presentCount = headerRows.filter((row) => row.entry?.present).length;

  const tls = siteMeta.tls;
  const dns = siteMeta.dns;
  const resources = siteMeta.resources;
  const crawlGraph = siteMeta.crawlGraph;
  const compression = siteMeta.compression;
  const pathScope =
    typeof siteMeta.pathScope === 'string' && siteMeta.pathScope.trim()
      ? siteMeta.pathScope.trim()
      : null;
  const technologies =
    siteMeta.technologies && typeof siteMeta.technologies === 'object'
      ? siteMeta.technologies
      : undefined;
  const technologyGroups = groupTechnologies(technologies);
  const technologyCount = technologyGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-4">
      {show('headers') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.headers')}
          meta={
            headers
              ? t('siteAudits.technical.headersMeta', {
                  present: presentCount,
                  total: headerRows.length,
                })
              : undefined
          }
          empty={!headers}
        >
          {!headers ? (
            t('siteAudits.technical.emptySection')
          ) : (
            <ul className="space-y-2">
              {headerRows.map((row) => (
                <li key={row.key} className="flex items-start gap-2 text-xs">
                  <PresenceIcon present={Boolean(row.entry?.present)} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.label}</p>
                    {row.entry?.value ? (
                      <p className="break-all text-[11px] text-muted-foreground">
                        {row.entry.value}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {t('siteAudits.technical.missing')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </InventorySection>
      ) : null}

      {show('tls') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.tls')}
          meta={
            tls?.ok
              ? t('siteAudits.technical.tlsMeta', { days: tls.daysRemaining ?? '—' })
              : undefined
          }
          empty={!tls || !tls.ok}
        >
          {!tls || !tls.ok ? (
            tls?.error || t('siteAudits.technical.emptySection')
          ) : (
            <div className="space-y-2">
              <MetaRow label={t('siteAudits.technical.tls.protocol')} value={tls.protocol || '—'} />
              <MetaRow
                label={t('siteAudits.technical.tls.authorized')}
                value={
                  tls.authorized == null
                    ? '—'
                    : tls.authorized
                      ? t('siteAudits.technical.yes')
                      : t('siteAudits.technical.no')
                }
              />
              <MetaRow
                label={t('siteAudits.technical.tls.hostnameMatch')}
                value={
                  tls.hostnameMatch == null
                    ? '—'
                    : tls.hostnameMatch
                      ? t('siteAudits.technical.yes')
                      : t('siteAudits.technical.no')
                }
              />
              <MetaRow label={t('siteAudits.technical.tls.issuer')} value={tls.issuer || '—'} />
              <MetaRow label={t('siteAudits.technical.tls.validTo')} value={tls.validTo || '—'} />
              <MetaRow
                label={t('siteAudits.technical.tls.daysRemaining')}
                value={tls.daysRemaining == null ? '—' : String(tls.daysRemaining)}
              />
            </div>
          )}
        </InventorySection>
      ) : null}

      {show('dns') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.dns')}
          meta={
            dns?.ok
              ? t('siteAudits.technical.dnsMeta', {
                  spf: dns.spfPresent
                    ? t('siteAudits.technical.present')
                    : t('siteAudits.technical.missing'),
                  dmarc: dns.dmarcPresent
                    ? t('siteAudits.technical.present')
                    : t('siteAudits.technical.missing'),
                })
              : undefined
          }
          empty={!dns || !dns.ok}
        >
          {!dns || !dns.ok ? (
            dns?.error || t('siteAudits.technical.emptySection')
          ) : (
            <div className="space-y-2">
              <MetaRow
                label={t('siteAudits.technical.dns.spf')}
                value={
                  dns.spfPresent
                    ? t('siteAudits.technical.present')
                    : t('siteAudits.technical.missing')
                }
              />
              <MetaRow
                label={t('siteAudits.technical.dns.dmarc')}
                value={
                  dns.dmarcPresent
                    ? t('siteAudits.technical.present')
                    : t('siteAudits.technical.missing')
                }
              />
              <MetaRow
                label={t('siteAudits.technical.dns.records')}
                value={`A ${dns.aCount ?? 0} · AAAA ${dns.aaaaCount ?? 0}`}
              />
              <MetaRow
                label={t('siteAudits.technical.dns.ns')}
                value={(dns.ns || []).length ? (dns.ns || []).join(', ') : '—'}
              />
              <MetaRow
                label={t('siteAudits.technical.dns.caa')}
                value={(dns.caa || []).length ? (dns.caa || []).join(', ') : '—'}
              />
            </div>
          )}
        </InventorySection>
      ) : null}

      {show('technologies') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.technologies')}
          meta={
            technologies
              ? t('siteAudits.technical.technologiesMeta', { count: technologyCount })
              : undefined
          }
          empty={technologyCount === 0}
        >
          {technologyCount === 0 ? (
            t('siteAudits.technical.technologies.empty')
          ) : (
            <div className="space-y-3">
              {technologyGroups.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t(`siteAudits.technical.technologies.categories.${group.category}`, {
                      defaultValue: group.category,
                    })}
                  </p>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const evidence = technologyEvidenceLine(item);
                      return (
                        <li key={item.id} className="min-w-0 text-xs">
                          <p className="font-medium text-foreground">{technologyLabel(item)}</p>
                          {evidence ? (
                            <p className="break-all text-[11px] text-muted-foreground">
                              {evidence}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </InventorySection>
      ) : null}

      {show('resources') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.resources')}
          meta={
            resources
              ? t('siteAudits.technical.resourcesMeta', {
                  scripts: resources.scriptCount ?? 0,
                  thirdParty: resources.thirdPartyScriptHostCount ?? 0,
                })
              : undefined
          }
          empty={!resources}
        >
          {!resources ? (
            t('siteAudits.technical.emptySection')
          ) : (
            <div className="space-y-2">
              <MetaRow
                label={t('siteAudits.technical.resources.scripts')}
                value={String(resources.scriptCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.resources.stylesheets')}
                value={String(resources.stylesheetCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.resources.images')}
                value={String(resources.imageCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.resources.asyncDefer')}
                value={`${resources.asyncScripts ?? 0} / ${resources.deferScripts ?? 0}`}
              />
              <MetaRow
                label={t('siteAudits.technical.resources.manifest')}
                value={
                  resources.hasManifest
                    ? t('siteAudits.technical.yes')
                    : t('siteAudits.technical.no')
                }
              />
              <MetaRow
                label={t('siteAudits.technical.resources.serviceWorker')}
                value={
                  resources.hasServiceWorkerHint
                    ? t('siteAudits.technical.yes')
                    : t('siteAudits.technical.no')
                }
              />
              <MetaRow
                label={t('siteAudits.technical.resources.thirdPartyScripts')}
                value={
                  (resources.thirdPartyScriptHosts || []).length
                    ? (resources.thirdPartyScriptHosts || []).join(', ')
                    : '—'
                }
              />
              {compression ? (
                <MetaRow
                  label={t('siteAudits.technical.resources.compression')}
                  value={compression.contentEncoding || t('siteAudits.technical.missing')}
                />
              ) : null}
            </div>
          )}
        </InventorySection>
      ) : null}

      {show('crawl') ? (
        <InventorySection
          title={t('siteAudits.technical.sections.crawl')}
          meta={
            crawlGraph
              ? t('siteAudits.technical.crawlMeta', {
                  pages: crawlGraph.pageCount ?? 0,
                  depth: crawlGraph.maxDepth ?? 0,
                })
              : undefined
          }
          empty={!crawlGraph}
        >
          {!crawlGraph ? (
            t('siteAudits.technical.emptySection')
          ) : (
            <div className="space-y-2">
              <MetaRow
                label={t('siteAudits.technical.crawl.pathScope')}
                value={pathScope || t('siteAudits.technical.crawl.pathScopeWholeSite')}
              />
              <MetaRow
                label={t('siteAudits.technical.crawl.pages')}
                value={String(crawlGraph.pageCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.crawl.sitemapUrls')}
                value={String(crawlGraph.sitemapUrlCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.crawl.maxDepth')}
                value={String(crawlGraph.maxDepth ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.crawl.sitemapOnly')}
                value={String(crawlGraph.sitemapOnlyCount ?? 0)}
              />
              <MetaRow
                label={t('siteAudits.technical.crawl.notInSitemap')}
                value={String(crawlGraph.crawledNotInSitemapCount ?? 0)}
              />
              {(crawlGraph.sitemapOnlySample || []).length > 0 ? (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t('siteAudits.technical.crawl.sitemapOnlySample')}
                  </p>
                  <ul className="space-y-0.5">
                    {(crawlGraph.sitemapOnlySample || []).map((url) => (
                      <li
                        key={url}
                        className={cn('truncate font-mono text-[11px] text-foreground')}
                      >
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </InventorySection>
      ) : null}
    </div>
  );
}
