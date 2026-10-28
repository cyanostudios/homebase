/**
 * Full-only quick context header — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md §1
 * and client/src/plugins/ingest/components/IngestSourceView.tsx (titleLeading pattern).
 */
import { Globe } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { SiteAudit } from '../types/site-audits';
import { formatSiteAuditRelativeTime, formatSiteAuditScore } from '../utils/siteAuditFormat';
import { getSiteAuditHostname, isSafeSiteAuditHttpUrl } from '../utils/siteAuditUrl';

import { SiteAuditDetailHeaderMenus } from './SiteAuditDetailHeaderMenus';

export function SiteAuditQuickContextPanel({
  item,
  headerBelow = null,
  isRunActive = false,
  isCancelling = false,
  runStartedAt = null,
  onRunAudit,
  onQuickAudit,
  onStopAudit,
}: {
  item: SiteAudit;
  /** Optional row under the title (tab chips from `SiteAuditView`). */
  headerBelow?: React.ReactNode;
  isRunActive?: boolean;
  isCancelling?: boolean;
  runStartedAt?: string | null;
  onRunAudit?: () => void;
  onQuickAudit?: () => void;
  onStopAudit?: () => void;
}) {
  const { t } = useTranslation();

  const hostname = getSiteAuditHostname(item.url);
  const scoreLabel =
    item.lastScore !== null ? formatSiteAuditScore(item.lastScore) : t('siteAudits.noScoreYet');
  const lastRunLabel = item.lastRunAt
    ? formatSiteAuditRelativeTime(item.lastRunAt, t)
    : t('siteAudits.neverRun');

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.site-audits')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Globe}
          className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {item.name || '—'}
      </h3>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <SiteAuditDetailHeaderMenus
          key={item.id}
          item={item}
          leading={titleLeading}
          isRunActive={isRunActive}
          isCancelling={isCancelling}
          runStartedAt={runStartedAt}
          onRunAudit={onRunAudit}
          onQuickAudit={onQuickAudit}
          onStopAudit={onStopAudit}
        />
        <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground">
          {isSafeSiteAuditHttpUrl(item.url) ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {hostname}
            </a>
          ) : (
            hostname
          )}{' '}
          <span aria-hidden>·</span> {t('siteAudits.scoreLabel')}: {scoreLabel}{' '}
          <span aria-hidden>·</span> {t('siteAudits.lastRunLabel')}: {lastRunLabel}
        </p>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
