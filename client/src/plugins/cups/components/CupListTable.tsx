import { Star } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { Cup } from '../types/cups';
import type { CupSortField, CupSortOrder } from '../utils/cupListSort';

const CUP_VISIBLE_BADGE =
  'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
const CUP_HIDDEN_BADGE =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400';
const CUP_FEATURED_BADGE =
  'inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';

export type CupListTableProps = {
  cups: Cup[];
  primarySort: CupSortField;
  sortOrder: CupSortOrder;
  onSort: (field: CupSortField) => void;
  ingestTitleForCup: (id: string | null | undefined) => string;
  isSelected: (id: string) => boolean;
  onRowClick: (cup: Cup) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

export function CupListTable({
  cups,
  primarySort,
  sortOrder,
  onSort,
  ingestTitleForCup,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
}: CupListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Cup, CupSortField>[]>(
    () => [
      {
        field: 'name',
        header: t('cups.columnName'),
        cell: (cup) => <span className="font-medium text-foreground">{cup.name || '—'}</span>,
      },
      {
        field: 'ingest',
        header: t('cups.columnDistrict'),
        className: 'hidden sm:table-cell',
        cell: (cup) => {
          const title = ingestTitleForCup(cup.ingest_source_id).trim();
          return (
            <span className="text-xs text-muted-foreground">
              {title || (cup.ingest_source_id ? String(cup.ingest_source_id) : '—')}
            </span>
          );
        },
      },
      {
        field: 'start_date',
        header: t('cups.columnStart'),
        cell: (cup) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatDate(cup.start_date)}
          </span>
        ),
      },
      {
        field: 'location',
        header: t('cups.columnLocation'),
        className: 'hidden md:table-cell',
        cell: (cup) => <span className="text-xs text-muted-foreground">{cup.location || '—'}</span>,
      },
      {
        field: 'featured',
        header: t('cups.columnFeaturedVisible'),
        className: 'hidden md:table-cell',
        cell: (cup) => (
          <div className="flex flex-wrap items-center gap-1">
            {cup.featured ? <span className={CUP_FEATURED_BADGE}>{t('cups.featured')}</span> : null}
            <span className={cn(cup.visible ? CUP_VISIBLE_BADGE : CUP_HIDDEN_BADGE)}>
              {cup.visible ? t('common.visible') : t('common.hidden')}
            </span>
          </div>
        ),
      },
      {
        field: 'ratings_count',
        header: t('cups.columnRatings'),
        className: 'hidden lg:table-cell',
        cell: (cup) =>
          cup.ratings_count > 0 ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-xs text-foreground">
              <Star className="h-3 w-3 text-amber-500" aria-hidden />
              {cup.ratings_count}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (cup) => (
          <span className="text-xs text-muted-foreground">{formatDate(cup.updated_at)}</span>
        ),
      },
    ],
    [t, ingestTitleForCup],
  );

  return (
    <SortableListTable
      rows={cups}
      columns={columns}
      getRowId={(cup) => String(cup.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(cup) => `Open cup ${cup.name}`}
      rowClassName={(cup) =>
        cup.deleted_at !== null && cup.deleted_at !== undefined ? 'opacity-60' : undefined
      }
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
      pluginName="cups"
      dataListItem={(cup) => cup}
    />
  );
}
