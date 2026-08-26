import { CalendarDays, MapPin, Rss, Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { Cup } from '../types/cups';
import type { CupColumnCount } from '../utils/cupColumnCount';

const CUP_VISIBLE_BADGE =
  'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
const CUP_HIDDEN_BADGE =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-400';
const CUP_FEATURED_BADGE =
  'inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
const CUP_REMOVED_BADGE =
  'inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-600 dark:bg-red-950/40 dark:text-red-400';

export function CupListItem({
  cup,
  selected,
  highlighted,
  onClick,
  checkbox,
  ingestTitle,
  columnCount = 1,
}: {
  cup: Cup;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  ingestTitle?: string | null;
  /** When 1, meta sits in the top area after title; 2/3 keep meta below. */
  columnCount?: CupColumnCount;
}) {
  const { t } = useTranslation();
  const isRemoved = cup.deleted_at !== null && cup.deleted_at !== undefined;
  const startLabel = cup.start_date ? new Date(cup.start_date).toLocaleDateString() : null;
  const updatedLabel = cup.updated_at ? new Date(cup.updated_at).toLocaleDateString() : null;
  const metaOnTop = columnCount === 1;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate font-medium text-foreground/80">{cup.location || '—'}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{startLabel || '—'}</span>
      </span>
      {ingestTitle ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Rss className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{ingestTitle}</span>
        </span>
      ) : null}
      {cup.ratings_count > 0 ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 tabular-nums">
          <Star className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" aria-hidden />
          <span>{cup.ratings_count}</span>
        </span>
      ) : null}
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  );

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
        isRemoved && 'opacity-60',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(cup)}
      data-plugin-name="cups"
      role="button"
      tabIndex={0}
      aria-label={`Open cup ${cup.name}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            <div className="min-w-0 flex-1">
              <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>
                {cup.name || '—'}
              </h3>
              {cup.organizer ? (
                <p className="truncate text-xs text-muted-foreground">{cup.organizer}</p>
              ) : null}
              {metaOnTop ? metaRow : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {isRemoved ? (
              <span className={CUP_REMOVED_BADGE}>Removed</span>
            ) : (
              <>
                <span className={cup.visible ? CUP_VISIBLE_BADGE : CUP_HIDDEN_BADGE}>
                  {cup.visible ? t('common.visible') : t('common.hidden')}
                </span>
                {cup.featured ? (
                  <span className={CUP_FEATURED_BADGE}>
                    <Star className="mr-0.5 h-2.5 w-2.5" aria-hidden />
                    {t('cups.featured')}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
