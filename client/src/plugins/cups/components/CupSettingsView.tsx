import { FileUp, Globe, Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useCups } from '../context/CupsContext';
import type { CupSource } from '../types/cup';

interface CupSettingsViewProps {
  onBack: () => void;
}

const CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

export function CupSettingsView({ onBack }: CupSettingsViewProps) {
  const { t } = useTranslation();
  const {
    sources,
    fetchSources,
    createSource,
    deleteSource,
    scrapeSource,
    scrapeFile,
    scrapingSourceId,
  } = useCups();

  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAddUrl = async () => {
    if (!newUrl.trim()) {
      return;
    }
    setAddSourceError(null);
    setAdding(true);
    try {
      await createSource({ type: 'url', url: newUrl.trim(), label: newLabel.trim() || undefined });
      setNewUrl('');
      setNewLabel('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('cups.addSourceFailed');
      setAddSourceError(message);
    } finally {
      setAdding(false);
    }
  };

  const handleScrape = async (id: string) => {
    try {
      const result = await scrapeSource(id);
      setScrapeResult((prev) => ({
        ...prev,
        [id]: t('cups.scrapeSuccess', { count: result.inserted }),
      }));
    } catch (err: any) {
      setScrapeResult((prev) => ({
        ...prev,
        [id]: `${t('cups.scrapeError')}: ${err.message}`,
      }));
    }
  };

  const handleFileSelect = (sourceId: string) => {
    setUploadTargetId(sourceId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) {
      return;
    }
    try {
      const result = await scrapeFile(uploadTargetId, file);
      setScrapeResult((prev) => ({
        ...prev,
        [uploadTargetId]: t('cups.scrapeSuccess', { count: result.inserted }),
      }));
    } catch (err: any) {
      setScrapeResult((prev) => ({
        ...prev,
        [uploadTargetId]: `${t('cups.scrapeError')}: ${err.message}`,
      }));
    } finally {
      setUploadTargetId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="plugin-cups space-y-6">
      {/* Header row – matches SlotsSettingsView inline header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('cups.settingsTitle')}</h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={X}
          className="h-9 px-3 text-xs"
          onClick={onBack}
        >
          {t('common.close')}
        </Button>
      </div>

      {/* Add source card */}
      <Card padding="none" className={CARD_CLASS}>
        <DetailSection title={t('cups.addSource')} icon={Globe} iconPlugin="cups" className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">{t('cups.addSourceHelp')}</p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">
                {t('cups.sourceUrl')}
              </Label>
              <Input
                className="h-9 bg-background text-sm"
                type="url"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setAddSourceError(null);
                }}
                placeholder="https://distrikt.svenskfotboll.se/cuper"
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">
                {t('cups.sourceLabel')}
              </Label>
              <Input
                className="h-9 bg-background text-sm"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  setAddSourceError(null);
                }}
                placeholder={t('cups.sourceLabelPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              />
            </div>
            {addSourceError && (
              <p className="text-xs text-destructive" role="alert">
                {addSourceError}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                icon={Plus}
                className="h-9 px-3 text-xs"
                onClick={handleAddUrl}
                disabled={adding || !newUrl.trim()}
              >
                {t('cups.addSource')}
              </Button>
            </div>
          </div>
        </DetailSection>
      </Card>

      {/* Sources list */}
      {sources.length > 0 && (
        <Card padding="none" className={CARD_CLASS}>
          <DetailSection title={t('cups.sources')} icon={Globe} iconPlugin="cups" className="p-4">
            <div className="divide-y divide-border/40">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  isScraping={scrapingSourceId === source.id}
                  result={scrapeResult[source.id]}
                  onScrape={() => handleScrape(source.id)}
                  onUpload={() => handleFileSelect(source.id)}
                  onDelete={() => setDeletePendingId(source.id)}
                />
              ))}
            </div>
          </DetailSection>
        </Card>
      )}

      {sources.length === 0 && (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          {t('cups.noSources')}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.txt,.csv,text/html,text/plain,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        isOpen={!!deletePendingId}
        title={t('cups.deleteSourceTitle')}
        message={t('cups.deleteSourceMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (deletePendingId) {
            deleteSource(deletePendingId);
          }
          setDeletePendingId(null);
        }}
        onCancel={() => setDeletePendingId(null)}
      />
    </div>
  );
}

interface SourceRowProps {
  source: CupSource;
  isScraping: boolean;
  result?: string;
  onScrape: () => void;
  onUpload: () => void;
  onDelete: () => void;
}

function SourceRow({ source, isScraping, result, onScrape, onUpload, onDelete }: SourceRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {source.label && <span className="truncate text-sm font-medium">{source.label}</span>}
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-muted-foreground hover:text-foreground"
            >
              {source.url}
            </a>
          )}
          {source.last_scraped_at && (
            <span className="text-xs text-muted-foreground">
              {t('cups.lastScraped')}: {new Date(source.last_scraped_at).toLocaleString()}
              {source.last_result && ` · ${source.last_result}`}
            </span>
          )}
          {result && <span className="text-xs text-muted-foreground">{result}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={isScraping ? Loader2 : Globe}
            className={cn('h-9 px-3 text-xs', isScraping && '[&_svg]:animate-spin')}
            onClick={onScrape}
            disabled={isScraping}
            title={t('cups.scrapeNow')}
          >
            {t('cups.scrapeNow')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={FileUp}
            className="h-9 px-3 text-xs"
            onClick={onUpload}
            disabled={isScraping}
            title={t('cups.uploadFile')}
          >
            {t('cups.uploadFile')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={onDelete}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
