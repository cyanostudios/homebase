import { FileText, Globe, History, Info } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDateTime } from '@/core/utils/dateFormat';

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';

import { IngestSourceDetailHeaderMenus } from './IngestSourceDetailHeaderMenus';

type IngestSourceViewTab = 'information' | 'excerpt' | 'runs' | 'activity';

const INGEST_SOURCE_VIEW_TABS: IngestSourceViewTab[] = [
  'information',
  'excerpt',
  'runs',
  'activity',
];

function parseIngestSourceViewTab(value: string | null): IngestSourceViewTab {
  if (value && INGEST_SOURCE_VIEW_TABS.includes(value as IngestSourceViewTab)) {
    return value as IngestSourceViewTab;
  }
  return 'information';
}

interface IngestSourceViewProps {
  ingest?: IngestSource | null;
  item?: IngestSource | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const IngestSourceView: React.FC<IngestSourceViewProps> = ({
  ingest: ingestProp,
  item,
  stacked: _stacked = false,
}) => {
  const source = ingestProp ?? item ?? null;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseIngestSourceViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: IngestSourceViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
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
  const { ingestRuns, runsLoading } = useIngest();

  const latestRunForExcerpt = useMemo(() => {
    const r = ingestRuns[0];
    if (!r || r.status === 'running') {
      return null;
    }
    return r;
  }, [ingestRuns]);

  const runsCount = ingestRuns.length > 0 ? ingestRuns.length : null;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('ingest.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'excerpt' as const,
        label: t('ingest.tabs.excerpt'),
        icon: FileText,
        count: null as number | null,
      },
      {
        id: 'runs' as const,
        label: t('ingest.tabs.runs'),
        icon: History,
        count: runsCount,
      },
      {
        id: 'activity' as const,
        label: t('ingest.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [runsCount, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  if (!source) {
    return null;
  }

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.ingest')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Globe}
          className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {source.name || '—'}
      </h3>
    </div>
  );

  const informationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
      <DetailSection
        title={t('ingest.tabs.information')}
        icon={Info}
        iconPlugin="ingest"
        subtleTitle
        className="p-4 sm:p-6"
      >
        <div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('ingest.sourceType')}</span>
            <span className="font-extrabold text-foreground">{source.sourceType}</span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('ingest.fetchMethod')}</span>
            <span className="truncate text-right font-mono font-extrabold text-foreground">
              {source.fetchMethod}
            </span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('ingest.active')}</span>
            <span className="font-extrabold text-foreground">
              {source.isActive ? t('common.yes') : t('common.no')}
            </span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('ingest.lastFetch')}</span>
            <span className="text-right font-extrabold text-foreground">
              {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : '—'}
            </span>
          </div>
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">{t('ingest.lastStatus')}</span>
            <span className="font-extrabold text-foreground">{source.lastFetchStatus}</span>
          </div>
          {source.notes ? (
            <div className="space-y-1 border-t border-border/50 pt-2">
              <div className={DETAIL_FIELD_LABEL_CLASS}>{t('ingest.notes')}</div>
              <p className="line-clamp-6 whitespace-pre-wrap text-xs text-foreground">
                {source.notes}
              </p>
            </div>
          ) : null}
          <div className="space-y-1 border-t border-border/50 pt-4 mt-2">
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('ingest.sourceUrl')}</div>
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono break-all text-plugin plugin-ingest hover:underline"
            >
              {source.sourceUrl}
            </a>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const hasExcerptContent =
    latestRunForExcerpt != null &&
    (latestRunForExcerpt.rawExcerpt || latestRunForExcerpt.errorMessage);

  const excerptCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
      <DetailSection
        title={t('ingest.tabs.excerpt')}
        icon={FileText}
        iconPlugin="ingest"
        subtleTitle
        className="p-4 sm:p-6"
      >
        {hasExcerptContent && latestRunForExcerpt ? (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {formatDateTime(latestRunForExcerpt.startedAt)} ·{' '}
              <span className="font-mono">{latestRunForExcerpt.fetchMethod ?? '—'}</span> · HTTP{' '}
              {latestRunForExcerpt.httpStatus ?? '—'}
            </p>
            {latestRunForExcerpt.errorMessage ? (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/10 p-3 max-h-64 overflow-y-auto text-destructive">
                {latestRunForExcerpt.errorMessage}
              </pre>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 max-h-64 overflow-y-auto border border-border/60">
                {latestRunForExcerpt.rawExcerpt}
              </pre>
            )}
          </>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('ingest.tabs.excerptEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  const runsCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
      <DetailSection
        title={t('ingest.tabs.runs')}
        icon={History}
        iconPlugin="ingest"
        subtleTitle
        className="p-4 sm:p-6"
      >
        {runsLoading ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</p>
        ) : ingestRuns.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('ingest.noRuns')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ingest.runStarted')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ingest.runFetchMethod')}</TableHead>
                <TableHead>{t('ingest.runStatus')}</TableHead>
                <TableHead className="hidden sm:table-cell">HTTP</TableHead>
                <TableHead className="hidden md:table-cell">{t('ingest.runExcerpt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingestRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTime(run.startedAt)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {run.fetchMethod ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs">{run.status}</TableCell>
                  <TableCell className="hidden text-xs sm:table-cell">
                    {run.httpStatus ?? '—'}
                  </TableCell>
                  <TableCell className="hidden max-w-[240px] truncate text-xs md:table-cell">
                    {run.errorMessage || run.rawExcerpt || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>
    </Card>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <IngestSourceDetailHeaderMenus source={source} leading={titleLeading} />
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'excerpt' ? excerptCard : null}
      {activeTab === 'runs' ? runsCard : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="ingest"
          entityId={source.id}
          limit={30}
          title={t('ingest.activity')}
          showClearButton
          refreshKey={String(source.updatedAt ?? source.id)}
          systemId={formatDisplayNumber('ingest', source.id)}
        />
      ) : null}
    </DetailLayout>
  );
};
