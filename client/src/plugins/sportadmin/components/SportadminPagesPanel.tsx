// client/src/plugins/sportadmin/components/SportadminPagesPanel.tsx
import { ArrowLeft, BookOpen, ExternalLink, FileText, Link2, Newspaper } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { ImageLightbox } from '@/core/ui/ImageLightbox';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { sportadminApi } from '../api/sportadminApi';
import type { SportadminPageItem, SportadminStatus } from '../types/sportadmin';
import { formatSportadminDateTime } from '../utils/formatSportadminDate';

import { SportadminPagesListTable, type SportadminPageSortField } from './SportadminPagesListTable';
import { SportadminSectionCard } from './SportadminSectionCard';
import { SportadminStaleBanner } from './SportadminStaleBanner';

function comparePages(a: SportadminPageItem, b: SportadminPageItem, order: 'asc' | 'desc'): number {
  const byIndex = (a.sort_index ?? 0) - (b.sort_index ?? 0);
  if (byIndex !== 0) {
    return order === 'asc' ? byIndex : -byIndex;
  }
  const cmp = String(a.title ?? '').localeCompare(String(b.title ?? ''), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  return order === 'asc' ? cmp : -cmp;
}

export function SportadminPagesPanel({ status }: { status: SportadminStatus | null }) {
  const { t } = useTranslation();
  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const [pages, setPages] = useState<SportadminPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [primarySort, setPrimarySort] = useState<SportadminPageSortField>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const configured = Boolean(status?.siteUrl);

  const loadPages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await sportadminApi.getPages();
      const list = Array.isArray(rows) ? rows : [];
      setPages(list);
      setSelectedId((prev) => (prev && list.some((row) => row.id === prev) ? prev : null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('sportadmin.pages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPages();
  }, [loadPages, status?.lastSuccessfulSync]);

  useEffect(() => {
    setImageBroken(false);
  }, [selectedId]);

  const sortedPages = useMemo(() => {
    const copy = [...pages];
    copy.sort((a, b) => comparePages(a, b, sortOrder));
    return copy;
  }, [pages, primarySort, sortOrder]);

  const selected = useMemo(
    () => (selectedId ? (pages.find((page) => page.id === selectedId) ?? null) : null),
    [selectedId, pages],
  );

  const showList = showDesktopSplit || !selected;
  const showDetail = showDesktopSplit || Boolean(selected);

  const emptyListMessage = !configured
    ? t('sportadmin.pages.emptyNotConfigured')
    : t('sportadmin.pages.emptyNoPages');

  const handleSort = (field: SportadminPageSortField) => {
    const next = nextListTableSort(primarySort, sortOrder, field, () => true);
    setPrimarySort(next.field);
    setSortOrder(next.order);
  };

  const handleSelect = (page: SportadminPageItem) => {
    setSelectedId(page.id);
  };

  const handleBack = () => {
    setSelectedId(null);
  };

  const kindLabel =
    selected?.kind != null
      ? t(`sportadmin.pages.kind.${selected.kind}`, { defaultValue: selected.kind })
      : null;

  const listPane = (
    <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
      {pages.length === 0 ? (
        <ListEmptyState message={emptyListMessage} />
      ) : (
        <SportadminPagesListTable
          pages={sortedPages}
          primarySort={primarySort}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleSelect}
          activePageId={selectedId}
        />
      )}
    </div>
  );

  const detailPane = (
    <div
      className="min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain pr-1"
      aria-label={t('sportadmin.pages.detailRegion')}
      role="region"
    >
      {!showDesktopSplit && selected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 h-8 gap-1.5 px-2 text-xs"
          onClick={handleBack}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t('sportadmin.pages.backToList')}
        </Button>
      ) : null}

      {!selected ? (
        <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.pages.selectPrompt')}</p>
      ) : (
        <>
          <SportadminSectionCard title={t('sportadmin.pages.identity')} icon={BookOpen}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {selected.source_image_url && !imageBroken ? (
                <img
                  src={selected.source_image_url}
                  alt={selected.title}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  onError={() => setImageBroken(true)}
                />
              ) : null}
              <div className="min-w-0 space-y-2">
                <p className={DETAIL_FIELD_VALUE_CLASS}>{selected.title}</p>
                {selected.heading &&
                selected.heading.trim() &&
                selected.heading.trim().toLowerCase() !== selected.title.trim().toLowerCase() ? (
                  <p className="text-sm text-muted-foreground">{selected.heading}</p>
                ) : null}
                {kindLabel ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.pages.kindLabel')}</p>
                    <p className="text-sm text-foreground">{kindLabel}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </SportadminSectionCard>

          {selected.description?.trim() || selected.description_image_url ? (
            <SportadminSectionCard title={t('sportadmin.pages.description')} icon={FileText}>
              <div className="space-y-2">
                {selected.description_image_url ? (
                  <ImageLightbox
                    src={selected.description_image_url}
                    alt={selected.title || ''}
                    resetKey={selected.id}
                    imageClassName="max-h-56 max-w-full rounded-md object-contain object-left"
                    onThumbnailError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                {selected.description?.trim() ? (
                  <RichTextContent content={selected.description} />
                ) : null}
              </div>
            </SportadminSectionCard>
          ) : null}

          {selected.news_items && selected.news_items.length > 0 ? (
            <SportadminSectionCard
              title={t('sportadmin.pages.news')}
              icon={Newspaper}
              collapsible
              defaultOpen={false}
            >
              <ul className="list-none space-y-4">
                {selected.news_items.map((row, index) => (
                  <li
                    key={row.nid ? `news-${row.nid}` : `news-${index}-${row.title}`}
                    className="space-y-2 border-b border-border/50 pb-4 last:border-0 last:pb-0"
                  >
                    {row.image_url ? (
                      <ImageLightbox
                        src={row.image_url}
                        alt={row.title || ''}
                        resetKey={`${selected.id}:${row.nid ?? index}`}
                        imageClassName="max-h-56 w-full rounded-md object-cover"
                        onThumbnailError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="min-w-0 space-y-1">
                      {row.source_url ? (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            DETAIL_ENTITY_LINK_TRIGGER_CLASS,
                            'inline-flex items-center',
                          )}
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          {row.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{row.title}</p>
                      )}
                      {row.when ? (
                        <p className="text-xs text-muted-foreground">{row.when}</p>
                      ) : null}
                      {row.body?.trim() ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {row.body}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </SportadminSectionCard>
          ) : null}

          <SportadminSectionCard title={t('sportadmin.pages.source')} icon={Link2}>
            <div className="space-y-3">
              {selected.source_url ? (
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(DETAIL_ENTITY_LINK_TRIGGER_CLASS, 'inline-flex items-center')}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {t('sportadmin.pages.openSource')}
                </a>
              ) : (
                <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.pages.noSourceUrl')}</p>
              )}
              {selected.imported_at ? (
                <div>
                  <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.pages.importedAt')}</p>
                  <p className="text-sm text-foreground">
                    {formatSportadminDateTime(selected.imported_at)}
                  </p>
                </div>
              ) : null}
              {selected.updated_at ? (
                <div>
                  <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.pages.updatedAt')}</p>
                  <p className="text-sm text-foreground">
                    {formatSportadminDateTime(selected.updated_at)}
                  </p>
                </div>
              ) : null}
            </div>
          </SportadminSectionCard>
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-2">
        <SportadminStaleBanner
          lastSuccessfulSync={status?.lastSuccessfulSync ?? null}
          lastError={status?.lastError ?? null}
        />
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
      </div>

      {!loading ? (
        <div
          className={cn(
            'min-h-0 flex-1',
            showDesktopSplit
              ? 'grid grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-2'
              : 'overflow-hidden',
          )}
        >
          {showList ? listPane : null}
          {showDetail ? detailPane : null}
        </div>
      ) : null}
    </div>
  );
}
