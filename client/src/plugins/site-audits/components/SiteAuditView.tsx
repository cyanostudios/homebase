/**
 * Full detail view — tabs: overview | pages | compare | history | activity.
 * See docs/ai/design/SITE_AUDITS_UX.md "Detail view tabs" and
 * docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md (pattern reference: IngestSourceView).
 */
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  GitCompare,
  History,
  LayoutGrid,
  Search,
  Shield,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { nextListTableSort } from '@/core/list/listViewMode';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListTableSortIcon } from '@/core/ui/ListTableSortIcon';
import { formatDateTime } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useSiteAudits } from '../hooks/useSiteAudits';
import { SITE_AUDIT_CATEGORY_IDS, isSiteAuditRunActive } from '../types/site-audits';
import type { SiteAudit, SiteAuditRun } from '../types/site-audits';
import {
  getSiteAuditComparison,
  findBatchCompetitorRun,
  countSiteAuditFindings,
} from '../utils/siteAuditCompare';
import { formatSiteAuditDuration, siteAuditRunDurationMs } from '../utils/siteAuditDuration';
import { formatSiteAuditScore, siteAuditFindingKey } from '../utils/siteAuditFormat';
import { filterSiteAuditPages } from '../utils/siteAuditPageFilter';
import {
  isSiteAuditPageAscDefaultField,
  sortSiteAuditPages,
  type SiteAuditPageSortField,
  type SiteAuditPageSortOrder,
} from '../utils/siteAuditPageSort';
import {
  computeSiteAuditRunDiff,
  findPreviousDoneSiteRun,
  formatSiteAuditScoreDelta,
} from '../utils/siteAuditRunDiff';

import { SiteAuditFindingsPanel } from './SiteAuditFindingsPanel';
import { SiteAuditOutboundUrl } from './SiteAuditOutboundUrl';
import { SiteAuditPageFilterTags } from './SiteAuditPageFilterTags';
import { SiteAuditPageFindingsIcons } from './SiteAuditPageFindingsIcons';
import { SiteAuditQuickContextPanel } from './SiteAuditQuickContextPanel';
import { SiteAuditRunOverview } from './SiteAuditRunOverview';
import { SiteAuditSeverityBadge } from './SiteAuditSeverityBadge';
import {
  SITE_AUDIT_TECHNICAL_INFRA_SECTIONS,
  SITE_AUDIT_TECHNICAL_SECURITY_SECTIONS,
  SiteAuditTechnicalView,
} from './SiteAuditTechnicalView';

type SiteAuditViewTab =
  | 'overview'
  | 'quickWins'
  | 'seo'
  | 'ai'
  | 'security'
  | 'pages'
  | 'technical'
  | 'compare'
  | 'history'
  | 'activity';

const SITE_AUDIT_VIEW_TABS: SiteAuditViewTab[] = [
  'overview',
  'quickWins',
  'seo',
  'ai',
  'security',
  'pages',
  'technical',
  'compare',
  'history',
  'activity',
];

function parseSiteAuditViewTab(value: string | null): SiteAuditViewTab {
  if (value && SITE_AUDIT_VIEW_TABS.includes(value as SiteAuditViewTab)) {
    return value as SiteAuditViewTab;
  }
  return 'overview';
}

const POLL_INTERVAL_MS = 2000;

interface SiteAuditViewProps {
  item?: SiteAudit | null;
  siteAudit?: SiteAudit | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const SiteAuditView: React.FC<SiteAuditViewProps> = ({
  item: itemProp,
  siteAudit,
  stacked: _stacked = false,
}) => {
  const item = siteAudit ?? itemProp ?? null;
  const { t } = useTranslation();
  const {
    startSiteAuditRun,
    cancelSiteAuditRun,
    getSiteAuditRuns,
    getSiteAuditRun,
    refreshSiteAudits,
    lastStartedSiteAuditRun,
    siteAuditRunError,
  } = useSiteAudits();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = parseSiteAuditViewTab(searchParams.get('tab'));
  const hasCompetitor = Boolean(item?.competitorUrl);
  const activeTab: SiteAuditViewTab =
    requestedTab === 'compare' && !hasCompetitor ? 'overview' : requestedTab;

  const setActiveTab = useCallback(
    (tab: SiteAuditViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const [runs, setRuns] = useState<SiteAuditRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [isCancellingRun, setIsCancellingRun] = useState(false);
  const [expandedPageUrl, setExpandedPageUrl] = useState<string | null>(null);
  const [pageSortField, setPageSortField] = useState<SiteAuditPageSortField>('url');
  const [pageSortOrder, setPageSortOrder] = useState<SiteAuditPageSortOrder>('asc');
  const [pageIncludeTags, setPageIncludeTags] = useState<string[]>([]);
  const [pageExcludeTags, setPageExcludeTags] = useState<string[]>([]);

  const handlePageSort = useCallback(
    (field: SiteAuditPageSortField) => {
      const next = nextListTableSort(
        pageSortField,
        pageSortOrder,
        field,
        isSiteAuditPageAscDefaultField,
      );
      setPageSortField(next.field);
      setPageSortOrder(next.order);
    },
    [pageSortField, pageSortOrder],
  );

  const siteAuditId = item?.id ?? null;

  useEffect(() => {
    if (!siteAuditId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    setRuns((prev) => prev.filter((run) => String(run.siteAuditId) === String(siteAuditId)));
    setRunsLoading(true);
    setSelectedRunId(null);
    setPageIncludeTags([]);
    setPageExcludeTags([]);
    void getSiteAuditRuns(siteAuditId, 50)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setRuns((prev) => {
          const extras = prev.filter(
            (run) =>
              String(run.siteAuditId) === String(siteAuditId) &&
              !data.some((serverRun) => serverRun.id === run.id),
          );
          return [...extras, ...data];
        });
      })
      .catch(() => {
        if (!cancelled) {
          setRuns((prev) => prev.filter((run) => String(run.siteAuditId) === String(siteAuditId)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRunsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [siteAuditId, getSiteAuditRuns]);

  useEffect(() => {
    if (
      !siteAuditId ||
      !lastStartedSiteAuditRun ||
      lastStartedSiteAuditRun.siteAuditId !== String(siteAuditId)
    ) {
      return;
    }
    const incoming = [
      lastStartedSiteAuditRun.run,
      ...(lastStartedSiteAuditRun.competitorRun ? [lastStartedSiteAuditRun.competitorRun] : []),
    ];
    setRuns((prev) => {
      const next = [...prev];
      incoming.forEach((run) => {
        const idx = next.findIndex((existing) => existing.id === run.id);
        if (idx >= 0) {
          next[idx] = run;
        } else {
          next.unshift(run);
        }
      });
      return next;
    });
    setSelectedRunId(null);
  }, [siteAuditId, lastStartedSiteAuditRun]);

  const siteRuns = useMemo(() => runs.filter((r) => r.target === 'site'), [runs]);
  const competitorRuns = useMemo(() => runs.filter((r) => r.target === 'competitor'), [runs]);

  const activeSiteRun = useMemo(
    () =>
      selectedRunId
        ? (siteRuns.find((r) => r.id === selectedRunId) ?? null)
        : (siteRuns[0] ?? null),
    [selectedRunId, siteRuns],
  );

  const batchCompetitorRun = useMemo(
    () => findBatchCompetitorRun(activeSiteRun, competitorRuns),
    [activeSiteRun, competitorRuns],
  );

  const isActive = isSiteAuditRunActive(activeSiteRun) || isSiteAuditRunActive(batchCompetitorRun);

  // Poll every ~2s while the displayed run (or its same-batch competitor leg) is queued/running.
  useEffect(() => {
    if (!item || !isActive) {
      return;
    }
    const pollTargets = [activeSiteRun, batchCompetitorRun].filter(
      (run): run is SiteAuditRun => Boolean(run) && isSiteAuditRunActive(run),
    );
    if (pollTargets.length === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void Promise.all(pollTargets.map((run) => getSiteAuditRun(item.id, run.id)))
        .then((updated) => {
          setRuns((prev) => {
            const next = [...prev];
            updated.forEach((run) => {
              const idx = next.findIndex((r) => r.id === run.id);
              if (idx >= 0) {
                next[idx] = run;
              } else {
                next.unshift(run);
              }
            });
            return next;
          });
          if (
            updated.some(
              (run) =>
                run.status === 'done' || run.status === 'failed' || run.status === 'cancelled',
            )
          ) {
            void refreshSiteAudits();
          }
        })
        .catch(() => {
          /* transient poll error — retried on next tick */
        });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [item, isActive, activeSiteRun, batchCompetitorRun, getSiteAuditRun, refreshSiteAudits]);

  const handleRunAudit = useCallback(
    async (mode: 'full' | 'quick' = 'full') => {
      if (!item) {
        return;
      }
      setIsStartingRun(true);
      try {
        await startSiteAuditRun(item.id, mode === 'quick' ? { mode: 'quick' } : undefined);
        setSelectedRunId(null);
        setActiveTab('overview');
      } catch (err) {
        console.error('Failed to start site audit run:', err);
      } finally {
        setIsStartingRun(false);
      }
    },
    [item, startSiteAuditRun, setActiveTab],
  );

  const handleStopAudit = useCallback(async () => {
    const cancelTarget =
      (activeSiteRun && isSiteAuditRunActive(activeSiteRun) ? activeSiteRun : null) ||
      (batchCompetitorRun && isSiteAuditRunActive(batchCompetitorRun)
        ? batchCompetitorRun
        : null) ||
      activeSiteRun;
    if (!item || !cancelTarget?.id) {
      return;
    }
    setIsCancellingRun(true);
    try {
      const updated = await cancelSiteAuditRun(item.id, cancelTarget.id);
      setRuns((prev) => {
        const next = [...prev];
        const idx = next.findIndex((run) => run.id === updated.id);
        if (idx >= 0) {
          next[idx] = updated;
        } else {
          next.unshift(updated);
        }
        return next;
      });
      void getSiteAuditRuns(item.id, 50).then((data) => {
        setRuns((prev) => {
          const extras = prev.filter(
            (run) =>
              String(run.siteAuditId) === String(item.id) &&
              !data.some((incoming) => String(incoming.id) === String(run.id)),
          );
          return [...data, ...extras];
        });
      });
    } catch (err) {
      console.error('Failed to cancel site audit run:', err);
    } finally {
      setIsCancellingRun(false);
    }
  }, [item, activeSiteRun, batchCompetitorRun, cancelSiteAuditRun, getSiteAuditRuns]);

  const handleSelectHistoryRun = useCallback(
    (run: SiteAuditRun) => {
      setSelectedRunId(run.id);
      setActiveTab('overview');
    },
    [setActiveTab],
  );

  const previousDoneSiteRun = useMemo(
    () => findPreviousDoneSiteRun(activeSiteRun, siteRuns),
    [activeSiteRun, siteRuns],
  );
  const runDiff = useMemo(
    () => computeSiteAuditRunDiff(activeSiteRun, previousDoneSiteRun),
    [activeSiteRun, previousDoneSiteRun],
  );

  const comparison = activeSiteRun
    ? getSiteAuditComparison(
        activeSiteRun.summary,
        batchCompetitorRun?.status === 'done' ? batchCompetitorRun.summary : null,
      )
    : null;
  const siteFindingCounts = countSiteAuditFindings(activeSiteRun?.summary);
  const competitorFindingCounts =
    batchCompetitorRun?.status === 'done'
      ? countSiteAuditFindings(batchCompetitorRun.summary)
      : null;

  const tabs = useMemo(
    () =>
      [
        { id: 'overview' as const, label: t('siteAudits.tabs.overview'), icon: LayoutGrid },
        { id: 'quickWins' as const, label: t('siteAudits.tabs.quickWins'), icon: Zap },
        { id: 'seo' as const, label: t('siteAudits.tabs.seo'), icon: Search },
        { id: 'ai' as const, label: t('siteAudits.tabs.ai'), icon: Bot },
        { id: 'security' as const, label: t('siteAudits.tabs.security'), icon: Shield },
        { id: 'pages' as const, label: t('siteAudits.tabs.pages'), icon: FileText },
        { id: 'technical' as const, label: t('siteAudits.tabs.technical'), icon: Wrench },
        { id: 'compare' as const, label: t('siteAudits.tabs.compare'), icon: GitCompare },
        { id: 'history' as const, label: t('siteAudits.tabs.history'), icon: History },
        { id: 'activity' as const, label: t('siteAudits.tabs.activity'), icon: Activity },
      ].filter((tab) => tab.id !== 'compare' || hasCompetitor),
    [hasCompetitor, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActiveTab = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActiveTab}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActiveTab ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );

  if (!item) {
    return null;
  }

  const pages = Array.isArray(activeSiteRun?.pages) ? activeSiteRun.pages : [];
  const pageFiltersActive = pageIncludeTags.length > 0 || pageExcludeTags.length > 0;
  const filteredPages = filterSiteAuditPages(pages, {
    include: pageIncludeTags,
    exclude: pageExcludeTags,
  });
  const sortedPages = sortSiteAuditPages(filteredPages, pageSortField, pageSortOrder);
  const pagesHiddenCount = pages.length - filteredPages.length;

  const pageSortHeaderClass =
    'cursor-pointer select-none text-xs font-black text-slate-400 hover:bg-primary/10 dark:text-slate-500';

  const renderPageSortHead = (field: SiteAuditPageSortField, label: string, className?: string) => (
    <TableHead
      className={cn(pageSortHeaderClass, className)}
      onClick={() => handlePageSort(field)}
      aria-sort={
        pageSortField === field ? (pageSortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ListTableSortIcon active={pageSortField === field} order={pageSortOrder} />
      </span>
    </TableHead>
  );

  const pagesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('siteAudits.tabs.pages')}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen
        titleAside={
          activeSiteRun && !runsLoading ? (
            <span className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
              {pageFiltersActive
                ? t('siteAudits.pagesCrawledFiltered', {
                    shown: filteredPages.length,
                    total: pages.length,
                    hidden: pagesHiddenCount,
                  })
                : t('siteAudits.pagesCrawled', { count: pages.length })}
            </span>
          ) : null
        }
      >
        {runsLoading ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</p>
        ) : !activeSiteRun ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.noRunsYet')}</p>
        ) : pages.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.noPagesYet')}</p>
        ) : (
          <div className="space-y-3">
            <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-white px-1 pb-2 dark:bg-slate-950">
              <div className="grid gap-3 sm:grid-cols-2">
                <SiteAuditPageFilterTags
                  label={t('siteAudits.pagesIncludeLabel')}
                  inputId="site-audit-pages-include"
                  placeholder={t('siteAudits.pagesIncludePlaceholder')}
                  tags={pageIncludeTags}
                  onChange={setPageIncludeTags}
                />
                <SiteAuditPageFilterTags
                  label={t('siteAudits.pagesExcludeLabel')}
                  inputId="site-audit-pages-exclude"
                  placeholder={t('siteAudits.pagesExcludePlaceholder')}
                  tags={pageExcludeTags}
                  onChange={setPageExcludeTags}
                />
              </div>
            </div>
            {filteredPages.length === 0 ? (
              <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.pagesAllFiltered')}</p>
            ) : (
              <Table containerClassName="max-h-[min(60vh,32rem)] overflow-auto">
                <TableHeader className="sticky top-0 z-[1] bg-white dark:bg-slate-950">
                  <TableRow>
                    <TableHead className="w-8" />
                    {renderPageSortHead('url', t('siteAudits.pageUrl'))}
                    {renderPageSortHead('title', t('siteAudits.pageTitle'), 'hidden sm:table-cell')}
                    {renderPageSortHead('statusCode', t('siteAudits.pageStatus'))}
                    <TableHead className="w-16 text-xs font-black text-slate-400 dark:text-slate-500">
                      {t('siteAudits.pageFindings')}
                    </TableHead>
                    {renderPageSortHead('score', t('siteAudits.pageScore'))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPages.map((page, index) => {
                    const pageKey = `${page.url}-${index}`;
                    const isExpanded = expandedPageUrl === pageKey;
                    const pageFindings = Array.isArray(page.findings) ? page.findings : [];
                    return (
                      <React.Fragment key={pageKey}>
                        <TableRow
                          className={cn(pageFindings.length > 0 && 'cursor-pointer')}
                          onClick={() =>
                            pageFindings.length > 0
                              ? setExpandedPageUrl(isExpanded ? null : pageKey)
                              : undefined
                          }
                        >
                          <TableCell className="w-8">
                            {pageFindings.length > 0 ? (
                              isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[240px] font-mono text-xs">
                            <SiteAuditOutboundUrl url={page.url} textClassName="font-mono" />
                          </TableCell>
                          <TableCell className="hidden max-w-[200px] truncate text-xs sm:table-cell">
                            {page.title || '—'}
                          </TableCell>
                          <TableCell className="text-xs">{page.statusCode ?? '—'}</TableCell>
                          <TableCell className="w-16">
                            <SiteAuditPageFindingsIcons findings={pageFindings} />
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            {formatSiteAuditScore(page.score)}
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30">
                              <ul className="space-y-1 py-2">
                                {(() => {
                                  const seenFindingKeys = new Map<string, number>();
                                  return pageFindings.map((finding) => (
                                    <li
                                      key={siteAuditFindingKey(finding, seenFindingKeys)}
                                      className="flex items-start gap-2 text-xs text-foreground"
                                    >
                                      <span className="shrink-0">
                                        <SiteAuditSeverityBadge severity={finding.severity} />
                                      </span>
                                      <div className="min-w-0">
                                        <span>{finding.message}</span>
                                        {finding.url ? (
                                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            <SiteAuditOutboundUrl url={finding.url} />
                                          </p>
                                        ) : null}
                                      </div>
                                    </li>
                                  ));
                                })()}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const compareCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('siteAudits.tabs.compare')}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen
      >
        {!hasCompetitor ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.compareNoCompetitorUrl')}</p>
        ) : !comparison ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>
            {batchCompetitorRun && isSiteAuditRunActive(batchCompetitorRun)
              ? t('siteAudits.comparePending')
              : t('siteAudits.compareNoData')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">{t('siteAudits.scoreLabel')}</span>
              <span className="font-mono">
                {formatSiteAuditScore(comparison.siteScore)} {t('siteAudits.compareVs')}{' '}
                {formatSiteAuditScore(comparison.competitorScore)}
              </span>
            </div>
            {SITE_AUDIT_CATEGORY_IDS.map((categoryId) => {
              const delta = comparison.categories[categoryId];
              if (!delta) {
                return null;
              }
              const isAhead = delta.delta >= 0;
              return (
                <div key={categoryId} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {t(`siteAudits.categories.${categoryId}`)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round(delta.site)} {t('siteAudits.compareVs')}{' '}
                    {Math.round(delta.competitor)}{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        isAhead
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      ({isAhead ? '+' : ''}
                      {Math.round(delta.delta)})
                    </span>
                  </span>
                </div>
              );
            })}
            {competitorFindingCounts ? (
              <div className="space-y-1 border-t border-border/60 pt-3">
                <p className="text-xs font-semibold text-foreground">
                  {t('siteAudits.compareFindings')}
                </p>
                {(['critical', 'warning', 'info'] as const).map((severity) => (
                  <div key={severity} className="flex items-center justify-between text-xs">
                    <SiteAuditSeverityBadge severity={severity} />
                    <span className="font-mono text-muted-foreground">
                      {siteFindingCounts[severity]} {t('siteAudits.compareVs')}{' '}
                      {competitorFindingCounts[severity]}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const historyCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('siteAudits.tabs.history')}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen
      >
        {runsLoading ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</p>
        ) : siteRuns.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.noRunsYet')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('siteAudits.runStarted')}</TableHead>
                <TableHead>{t('siteAudits.runDuration')}</TableHead>
                <TableHead>{t('siteAudits.runStatusCol')}</TableHead>
                <TableHead>{t('siteAudits.pageScore')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siteRuns.map((run) => {
                const prior = findPreviousDoneSiteRun(run, siteRuns);
                const historyDiff =
                  run.status === 'done' ? computeSiteAuditRunDiff(run, prior) : null;
                const scoreDelta = historyDiff?.scoreDelta ?? null;
                const scoreDeltaLabel = formatSiteAuditScoreDelta(scoreDelta);
                const isQuick = run.summary?.siteMeta?.auditMode === 'quick';
                return (
                  <TableRow
                    key={run.id}
                    className={cn('cursor-pointer', activeSiteRun?.id === run.id && 'bg-primary/5')}
                    onClick={() => handleSelectHistoryRun(run)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelectHistoryRun(run);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {run.startedAt ? formatDateTime(run.startedAt) : '—'}
                      {isQuick ? (
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                          {t('siteAudits.auditMode.quick')}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs font-mono tabular-nums">
                      {formatSiteAuditDuration(
                        siteAuditRunDurationMs(
                          run.startedAt,
                          isSiteAuditRunActive(run) ? null : run.finishedAt,
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t(`siteAudits.runStatus.${run.status}`, { defaultValue: run.status })}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {formatSiteAuditScore(run.score)}
                      {scoreDeltaLabel ? (
                        <span
                          className={cn(
                            'ml-1 font-mono text-[11px] font-medium tabular-nums',
                            (scoreDelta ?? 0) > 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : (scoreDelta ?? 0) < 0
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-muted-foreground',
                          )}
                        >
                          {scoreDeltaLabel}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DetailSection>
    </Card>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <SiteAuditQuickContextPanel
        item={item}
        headerBelow={tabChips}
        isRunActive={isActive || isStartingRun}
        isCancelling={isCancellingRun}
        runStartedAt={activeSiteRun?.startedAt ?? null}
        onRunAudit={() => void handleRunAudit('full')}
        onQuickAudit={() => void handleRunAudit('quick')}
        onStopAudit={() => void handleStopAudit()}
      />

      {siteAuditRunError ? (
        <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
          <p className="text-sm text-destructive">{siteAuditRunError}</p>
        </Card>
      ) : null}

      {activeTab === 'overview' ? (
        <SiteAuditRunOverview
          run={activeSiteRun}
          isStarting={isStartingRun}
          isActive={isActive}
          isCancelling={isCancellingRun}
          onRunAudit={() => void handleRunAudit('full')}
          onQuickAudit={() => void handleRunAudit('quick')}
          onStopAudit={() => void handleStopAudit()}
          runDiff={runDiff}
        />
      ) : null}
      {activeTab === 'quickWins' ? (
        <SiteAuditFindingsPanel run={activeSiteRun} mode="quickWins" runsLoading={runsLoading} />
      ) : null}
      {activeTab === 'seo' ? (
        <SiteAuditFindingsPanel run={activeSiteRun} mode="seo" runsLoading={runsLoading} />
      ) : null}
      {activeTab === 'ai' ? (
        <SiteAuditFindingsPanel run={activeSiteRun} mode="ai" runsLoading={runsLoading} />
      ) : null}
      {activeTab === 'security' ? (
        <div className="space-y-4">
          <SiteAuditFindingsPanel run={activeSiteRun} mode="security" runsLoading={runsLoading} />
          <SiteAuditTechnicalView
            summary={activeSiteRun?.summary ?? null}
            runsLoading={runsLoading}
            hasRun={Boolean(activeSiteRun)}
            sections={SITE_AUDIT_TECHNICAL_SECURITY_SECTIONS}
          />
        </div>
      ) : null}
      {activeTab === 'pages' ? pagesCard : null}
      {activeTab === 'technical' ? (
        <SiteAuditTechnicalView
          summary={activeSiteRun?.summary ?? null}
          runsLoading={runsLoading}
          hasRun={Boolean(activeSiteRun)}
          sections={SITE_AUDIT_TECHNICAL_INFRA_SECTIONS}
        />
      ) : null}
      {activeTab === 'compare' ? compareCard : null}
      {activeTab === 'history' ? historyCard : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="site-audit"
          entityId={item.id}
          limit={30}
          title={t('siteAudits.tabs.activity')}
          showClearButton
          refreshKey={String(item.updatedAt ?? item.id)}
          systemId={formatDisplayNumber('site-audits', item.id)}
          collapsible
          defaultOpen
        />
      ) : null}
    </DetailLayout>
  );
};
