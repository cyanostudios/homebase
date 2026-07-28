import { Activity, Globe } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate, formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { IngestSource } from '../types/ingest';
import type { IngestColumnCount } from '../utils/ingestColumnCount';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function statusBadgeClass(status: string) {
  if (status === 'success') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  }
  if (status === 'failed') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  if (status === 'running') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  }
  return 'bg-muted text-muted-foreground';
}

export function IngestSourceListItem({
  source,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  source: IngestSource;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, meta sits on the top row; 2/3 keep meta below title/excerpt. */
  columnCount?: IngestColumnCount;
}) {
  const { t } = useTranslation();
  const updatedLabel = source.updatedAt ? formatDate(source.updatedAt) : null;
  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(source.lastFetchedAt || updatedLabel);

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {source.lastFetchedAt ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{formatDateTimeShort(source.lastFetchedAt)}</span>
        </span>
      ) : null}
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  ) : null;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input[type="checkbox"], button, [role="combobox"], [data-radix-collection-item]',
          )
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(source)}
      data-plugin-name="ingest"
      role="button"
      tabIndex={0}
      aria-label={`Open ${source.name}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <Badge className={cn(BADGE_CLASS, statusBadgeClass(source.lastFetchStatus))}>
              {source.lastFetchStatus}
            </Badge>
            {!source.isActive ? (
              <Badge
                className={cn(
                  BADGE_CLASS,
                  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {t('ingest.colActive')}: {t('common.no')}
              </Badge>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
          <Badge
            className={cn(
              BADGE_CLASS,
              'bg-slate-100 text-slate-700 uppercase dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {source.sourceType}
          </Badge>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{source.name}</h3>

        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{source.sourceUrl}</span>
        </div>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
