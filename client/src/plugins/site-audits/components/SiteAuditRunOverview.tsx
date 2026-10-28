/**
 * Overview tab — score, category bars, Run audit / Quick audit / Stop, Since last run.
 * See docs/ai/design/SITE_AUDITS_UX.md.
 */
import { Loader2, Play, Square, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_EMPTY_STATE_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useSiteAuditNow } from '../hooks/useSiteAuditNow';
import { SITE_AUDIT_CATEGORY_IDS, type SiteAuditRun } from '../types/site-audits';
import { formatSiteAuditDuration, siteAuditRunDurationMs } from '../utils/siteAuditDuration';
import { formatSiteAuditScoreDelta, type SiteAuditRunDiff } from '../utils/siteAuditRunDiff';

function scoreBarColor(score: number): string {
  if (score >= 80) {
    return 'bg-emerald-500';
  }
  if (score >= 50) {
    return 'bg-amber-500';
  }
  return 'bg-red-500';
}

function deltaClass(delta: number): string {
  if (delta > 0) {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (delta < 0) {
    return 'text-red-700 dark:text-red-300';
  }
  return 'text-muted-foreground';
}

function SinceLastRunSection({ diff }: { diff: SiteAuditRunDiff }) {
  const { t } = useTranslation();
  const [listsOpen, setListsOpen] = useState(false);
  const scoreLabel = formatSiteAuditScoreDelta(diff.scoreDelta);
  const addedCount = diff.added.length;
  const resolvedCount = diff.resolved.length;

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('siteAudits.sinceLastRun.title')}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen
        titleAside={
          <span className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
            {scoreLabel ? (
              <span className={cn(diff.scoreDelta != null && deltaClass(diff.scoreDelta))}>
                {scoreLabel}
              </span>
            ) : null}
            {scoreLabel ? t('siteAudits.sectionMeta.separator') : null}
            {t('siteAudits.sinceLastRun.counts', {
              added: addedCount,
              resolved: resolvedCount,
            })}
          </span>
        }
      >
        <div className="space-y-3">
          {SITE_AUDIT_CATEGORY_IDS.map((categoryId) => {
            const delta = diff.categoryDeltas[categoryId];
            if (typeof delta !== 'number') {
              return null;
            }
            const label = formatSiteAuditScoreDelta(delta);
            return (
              <div key={categoryId} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {t(`siteAudits.categories.${categoryId}`)}
                </span>
                <span className={cn('font-mono tabular-nums', deltaClass(delta))}>{label}</span>
              </div>
            );
          })}

          {(addedCount > 0 || resolvedCount > 0) && (
            <div className="pt-1">
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setListsOpen((open) => !open)}
              >
                {listsOpen
                  ? t('siteAudits.sinceLastRun.hideLists')
                  : t('siteAudits.sinceLastRun.showLists')}
              </button>
              {listsOpen ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {t('siteAudits.sinceLastRun.added', { count: addedCount })}
                    </p>
                    {addedCount === 0 ? (
                      <p className={DETAIL_EMPTY_STATE_CLASS}>
                        {t('siteAudits.sinceLastRun.none')}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {diff.added.map((finding, index) => (
                          <li
                            key={`added-${finding.code ?? finding.message}-${index}`}
                            className="text-xs text-foreground"
                          >
                            {finding.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {t('siteAudits.sinceLastRun.resolved', { count: resolvedCount })}
                    </p>
                    {resolvedCount === 0 ? (
                      <p className={DETAIL_EMPTY_STATE_CLASS}>
                        {t('siteAudits.sinceLastRun.none')}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {diff.resolved.map((finding, index) => (
                          <li
                            key={`resolved-${finding.code ?? finding.message}-${index}`}
                            className="text-xs text-foreground"
                          >
                            {finding.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DetailSection>
    </Card>
  );
}

export function SiteAuditRunOverview({
  run,
  isStarting,
  isActive,
  isCancelling = false,
  onRunAudit,
  onQuickAudit,
  onStopAudit,
  runDiff = null,
}: {
  run: SiteAuditRun | null;
  /** True while the start-run request itself is in flight. */
  isStarting: boolean;
  /** True while the displayed run (or its competitor leg) is queued/running. */
  isActive: boolean;
  isCancelling?: boolean;
  onRunAudit: () => void;
  onQuickAudit?: () => void;
  onStopAudit?: () => void;
  runDiff?: SiteAuditRunDiff | null;
}) {
  const { t } = useTranslation();
  const now = useSiteAuditNow(isActive || isStarting);
  const elapsedLabel = formatSiteAuditDuration(
    siteAuditRunDurationMs(run?.startedAt, isActive ? null : run?.finishedAt, now),
  );

  const summary = run?.summary ?? null;
  const score = run?.score ?? summary?.score ?? null;
  const categories = summary?.categories ?? null;
  const shellOnly = Boolean(summary?.shellOnly);
  const shellOnlyPageCount =
    typeof summary?.shellOnlyPageCount === 'number' ? summary.shellOnlyPageCount : 0;
  const auditMode = summary?.siteMeta?.auditMode === 'quick' ? 'quick' : null;

  const showStop = Boolean(isActive && onStopAudit);
  const busyStart = isStarting && !isActive;
  const startDisabled = busyStart || isActive;

  return (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('siteAudits.tabs.overview')}
          className="p-4 sm:p-6"
          collapsible
          defaultOpen
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-black',
                  score !== null
                    ? cn(
                        score >= 80
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : score >= 50
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                      )
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {score !== null ? Math.round(score) : '—'}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {t('siteAudits.overallScore')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {run
                    ? t(`siteAudits.runStatus.${run.status}`, { defaultValue: run.status })
                    : t('siteAudits.neverRun')}
                  {auditMode === 'quick' ? (
                    <>
                      {' '}
                      <span aria-hidden>·</span> {t('siteAudits.auditMode.quick')}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {showStop ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={isCancelling ? Loader2 : Square}
                disabled={isCancelling}
                className={cn('h-9 shrink-0 px-4 text-xs', isCancelling && '[&_svg]:animate-spin')}
                onClick={onStopAudit}
              >
                {isCancelling
                  ? t('siteAudits.stopping')
                  : t('siteAudits.stopAuditWithTime', { time: elapsedLabel })}
              </Button>
            ) : (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={busyStart ? Loader2 : Play}
                  disabled={startDisabled}
                  className={cn('h-9 px-4 text-xs', busyStart && '[&_svg]:animate-spin')}
                  onClick={onRunAudit}
                >
                  {busyStart
                    ? t('siteAudits.runningWithTime', { time: elapsedLabel })
                    : t('siteAudits.runAudit')}
                </Button>
                {onQuickAudit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Zap}
                    disabled={startDisabled}
                    className="h-9 px-4 text-xs"
                    onClick={onQuickAudit}
                  >
                    {t('siteAudits.quickAudit')}
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {shellOnly ? (
            <p className="mt-4 rounded-md bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              {t('siteAudits.shellOnlyNote')}
            </p>
          ) : shellOnlyPageCount > 0 ? (
            <p className="mt-4 rounded-md bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              {t('siteAudits.shellOnlyPartialNote', { count: shellOnlyPageCount })}
            </p>
          ) : null}

          {categories ? (
            <div className="mt-6 space-y-3">
              {SITE_AUDIT_CATEGORY_IDS.map((categoryId) => {
                const value = categories[categoryId] ?? 0;
                return (
                  <div key={categoryId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {t(`siteAudits.categories.${categoryId}`)}
                      </span>
                      <span className="font-mono text-muted-foreground">{Math.round(value)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all', scoreBarColor(value))}
                        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !run ? (
            <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'mt-6')}>{t('siteAudits.noRunsYet')}</p>
          ) : null}
        </DetailSection>
      </Card>

      {runDiff ? <SinceLastRunSection diff={runDiff} /> : null}
    </div>
  );
}
