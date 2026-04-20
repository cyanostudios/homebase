import {
  Edit,
  ExternalLink,
  FileText,
  Globe,
  History,
  Info,
  Play,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { ingestApi } from '../api/ingestApi';
import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';

const INGEST_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';
const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

interface IngestSourceViewProps {
  ingest?: IngestSource | null;
  item?: IngestSource | null;
  /** Injected from panel renderer so run always resolves even if context alias drifts. */
  runIngestImport?: (sourceId: string) => Promise<void>;
}

export const IngestSourceView: React.FC<IngestSourceViewProps> = ({
  ingest: ingestProp,
  item,
  runIngestImport: runIngestImportFromPanel,
}) => {
  const source = ingestProp ?? item ?? null;
  const { t } = useTranslation();
  const {
    openIngestSourceForEdit,
    deleteIngestSource,
    getDeleteMessage,
    ingestRuns,
    runsLoading,
    importRunning,
    loadIngestRuns,
    loadIngestSources,
    runIngestImport,
    runIngestSource,
  } = useIngest();

  const runFetch = useMemo(() => {
    const fromPanel = runIngestImportFromPanel;
    const fromCtx = runIngestImport ?? runIngestSource;
    if (typeof fromPanel === 'function') {
      return fromPanel;
    }
    if (typeof fromCtx === 'function') {
      return fromCtx;
    }
    return async (sourceId: string) => {
      await ingestApi.runImport(sourceId);
      await loadIngestSources();
      await loadIngestRuns(sourceId);
    };
  }, [
    loadIngestRuns,
    loadIngestSources,
    runIngestImport,
    runIngestImportFromPanel,
    runIngestSource,
  ]);

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteIngestSource(source.id);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={cn(INGEST_DETAIL_CARD_CLASS, 'plugin-ingest')}>
              <DetailSection
                title={t('ingest.quickActions')}
                icon={Zap}
                iconPlugin="ingest"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Edit
                        {...props}
                        className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
                      />
                    )}
                    className={quickActionButtonClass}
                    onClick={() => openIngestSourceForEdit(source)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Trash2
                        {...props}
                        className={cn(props.className, 'text-red-600 dark:text-red-400')}
                      />
                    )}
                    className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setShowDelete(true)}
                  >
                    {t('common.delete')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Play
                        {...props}
                        className={cn(props.className, 'text-green-600 dark:text-green-400')}
                      />
                    )}
                    className={cn(quickActionButtonClass, 'text-green-600 dark:text-green-400')}
                    disabled={importRunning || !source.isActive}
                    onClick={() => void runFetch(source.id)}
                  >
                    {importRunning ? t('ingest.running') : t('ingest.runImport')}
                  </Button>
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'sm' }),
                      quickActionButtonClass,
                      'inline-flex items-center gap-2',
                    )}
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    {t('ingest.openUrl')}
                  </a>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={cn(INGEST_DETAIL_CARD_CLASS, 'plugin-ingest')}>
              <DetailSection
                title={t('ingest.information')}
                icon={Info}
                iconPlugin="ingest"
                className="p-4"
              >
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('ingest.colId')}</span>
                    <span className="font-mono font-medium text-right truncate">
                      {formatDisplayNumber('ingest', source.id)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('ingest.sourceType')}</span>
                    <span className="font-medium">{source.sourceType}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">
                      {t('ingest.fetchMethod')}
                    </span>
                    <span className="font-mono font-medium text-right truncate">
                      {source.fetchMethod}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('ingest.active')}</span>
                    <span className="font-medium">
                      {source.isActive ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('ingest.lastFetch')}</span>
                    <span className="font-medium text-right">
                      {source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('ingest.lastStatus')}</span>
                    <span className="font-medium">{source.lastFetchStatus}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3 pt-2 border-t border-border/50">
                    <span className="text-muted-foreground shrink-0">{t('common.created')}</span>
                    <span className="font-medium">
                      {new Date(source.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{t('common.updated')}</span>
                    <span className="font-medium">
                      {new Date(source.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {source.notes && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {t('ingest.notes')}
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-6">
                        {source.notes}
                      </p>
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="ingest"
              entityId={source.id}
              limit={30}
              title={t('ingest.activity')}
              showClearButton
              refreshKey={String(source.updatedAt ?? source.id)}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={cn(INGEST_DETAIL_CARD_CLASS, 'plugin-ingest')}>
            <DetailSection
              title={t('ingest.sectionDetails')}
              icon={Globe}
              iconPlugin="ingest"
              className="p-6"
            >
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                  {t('ingest.sourceUrl')}
                </div>
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
              <Card padding="none" className={cn(INGEST_DETAIL_CARD_CLASS, 'plugin-ingest')}>
                <DetailSection
                  title={t('ingest.latestExcerptTitle')}
                  icon={FileText}
                  iconPlugin="ingest"
                  className="p-4 sm:p-6"
                >
                  <p className="text-xs text-muted-foreground mb-2">
                    {new Date(latestRunForExcerpt.startedAt).toLocaleString()} ·{' '}
                    <span className="font-mono">{latestRunForExcerpt.fetchMethod ?? '—'}</span> ·
                    HTTP {latestRunForExcerpt.httpStatus ?? '—'}
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

          <Card padding="none" className={cn(INGEST_DETAIL_CARD_CLASS, 'plugin-ingest')}>
            <DetailSection
              title={t('ingest.runsTitle')}
              icon={History}
              iconPlugin="ingest"
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
                      <TableHead className="hidden md:table-cell">
                        {t('ingest.runExcerpt')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingestRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(run.startedAt).toLocaleString()}
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

      <ConfirmDialog
        isOpen={showDelete}
        title={t('ingest.deleteTitle')}
        message={getDeleteMessage(source)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
        variant="danger"
        confirmDisabled={deleting}
      />
    </>
  );
};
