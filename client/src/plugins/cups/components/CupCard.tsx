import { CalendarDays, ChevronRight, MapPin, Rss } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Cup } from '../types/cups';

const CUP_VISIBLE_BADGE =
  'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
const CUP_HIDDEN_BADGE =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400';
const CUP_FEATURED_BADGE =
  'inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
const CUP_REMOVED_BADGE =
  'inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400';

export function CupCard({
  cup,
  selected,
  onClick,
  checkbox,
  ingestTitle,
}: {
  cup: Cup;
  selected?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  ingestTitle?: string | null;
}) {
  const { t } = useTranslation();
  const isRemoved = cup.deleted_at !== null && cup.deleted_at !== undefined;
  const startLabel = cup.start_date ? new Date(cup.start_date).toLocaleDateString() : null;
  const updatedLabel = cup.updated_at ? new Date(cup.updated_at).toLocaleDateString() : null;

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        isRemoved && 'opacity-60',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      role="button"
      aria-label={`Open cup ${cup.name}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {checkbox}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{cup.name || '—'}</h3>
              {cup.organizer ? (
                <p className="truncate text-xs text-muted-foreground">{cup.organizer}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            {isRemoved ? (
              <span className={CUP_REMOVED_BADGE}>Removed</span>
            ) : (
              <>
                <span className={cup.visible ? CUP_VISIBLE_BADGE : CUP_HIDDEN_BADGE}>
                  {cup.visible ? t('common.visible') : t('common.hidden')}
                </span>
                {cup.featured ? (
                  <span className={CUP_FEATURED_BADGE}>{t('cups.featured')}</span>
                ) : null}
              </>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate font-medium text-foreground/80">
              {cup.location || '—'}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate">{startLabel || '—'}</span>
          </div>
          {ingestTitle ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Rss className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="min-w-0 truncate">{ingestTitle}</span>
            </div>
          ) : null}
        </div>

        {updatedLabel ? (
          <div className="mt-auto border-t border-border/60 pt-2.5">
            <span className="text-xs text-muted-foreground">
              {t('common.updated')}: {updatedLabel}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
