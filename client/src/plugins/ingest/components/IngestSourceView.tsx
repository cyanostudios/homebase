import { FileText, Globe, History, Info } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDateTime } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';

interface IngestSourceViewProps {
  ingest?: IngestSource | null;
  item?: IngestSource | null;
}

export const IngestSourceView: React.FC<IngestSourceViewProps> = ({ ingest: ingestProp, item }) => {
  const source = ingestProp ?? item ?? null;
  const { t } = useTranslation();
  const { ingestRuns, runsLoading } = useIngest();

  const latestRunForExcerpt = useMemo(() => {
    const r = ingestRuns[0];
    if (!r || r.status === 'running') {
      return null;
    }
    return r;
  }, [ingestRuns]);

  if (!source) {
    return null;
  }

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-4">
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
            <DetailSection
              title={t('ingest.information')}
              icon={Info}
              iconPlugin="ingest"
              subtleTitle
              className="p-4"
              collapsible
            >
              <div>
                <div className={DETAIL_INFO_ROW_CLASS}>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('ingest.sourceType')}
                  </span>
                  <span className="font-extrabold text-foreground">{source.sourceType}</span>
                </div>
                <div className={DETAIL_INFO_ROW_CLASS}>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('ingest.fetchMethod')}
                  </span>
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
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('ingest.lastFetch')}
                  </span>
                  <span className="text-right font-extrabold text-foreground">
                    {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : '—'}
                  </span>
                </div>
                <div className={DETAIL_INFO_ROW_CLASS}>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('ingest.lastStatus')}
                  </span>
                  <span className="font-extrabold text-foreground">{source.lastFetchStatus}</span>
                </div>
                {source.notes && (
                  <div className="space-y-1 border-t border-border/50 pt-2">
                    <div className={DETAIL_FIELD_LABEL_CLASS}>{t('ingest.notes')}</div>
                    <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-6">
                      {source.notes}
                    </p>
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      <div className="space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
          <DetailSection
            title={t('ingest.sectionDetails')}
            icon={Globe}
            iconPlugin="ingest"
            subtleTitle
            className="p-6"
          >
            <div>
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
          </DetailSection>
        </Card>

        {latestRunForExcerpt &&
          (latestRunForExcerpt.rawExcerpt || latestRunForExcerpt.errorMessage) && (
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
              <DetailSection
                title={t('ingest.latestExcerptTitle')}
                icon={FileText}
                iconPlugin="ingest"
                subtleTitle
                className="p-4 sm:p-6"
              >
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
              </DetailSection>
            </Card>
          )}

        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ingest')}>
          <DetailSection
            title={t('ingest.runsTitle')}
            icon={History}
            iconPlugin="ingest"
            subtleTitle
            className="p-4 sm:p-6"
          >
            {runsLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : ingestRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('ingest.noRuns')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ingest.runStarted')}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t('ingest.runFetchMethod')}
                    </TableHead>
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
      </div>
    </DetailLayout>
  );
};
