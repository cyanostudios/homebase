import { Trophy } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Cup } from '../types/cups';
import type { CupSortField, CupSortOrder } from '../utils/cupListSort';
import {
  DEFAULT_CUP_TABLE_COLUMNS,
  type CupTableColumnId,
  resolveVisibleCupTableColumns,
} from '../utils/cupTableColumns';

const CUP_VISIBLE_BADGE =
  'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
const CUP_HIDDEN_BADGE =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-400';
const CUP_FEATURED_BADGE =
  'inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';

type CupTableColumnField = CupSortField | 'created_at' | 'updated_at';

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
  selectionEnabled?: boolean;
  visibleColumnIds?: CupTableColumnId[];
  activeCupId?: string | null;
};

function formatStartDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleDateString();
}

function cupIdentityMeta(
  cup: Cup,
  ingestTitleForCup: (id: string | null | undefined) => string,
): string | null {
  const parts: string[] = [];
  const location = cup.location?.trim();
  if (location) {
    parts.push(location);
  }
  const start = formatStartDate(cup.start_date);
  if (start) {
    parts.push(start);
  }
  const ingestTitle = ingestTitleForCup(cup.ingest_source_id).trim();
  if (ingestTitle) {
    parts.push(ingestTitle);
  } else if (cup.ingest_source_id) {
    parts.push(String(cup.ingest_source_id));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
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
  selectionEnabled = true,
  visibleColumnIds,
  activeCupId = null,
}: CupListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleCupTableColumns({ tableColumns: DEFAULT_CUP_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<CupTableColumnId, SortableListTableColumn<Cup, CupTableColumnField>> = {
      name: {
        field: 'name',
        header: t('cups.columnName'),
        cell: (cup) => {
          const label = cup.name?.trim() || '—';
          const identityMeta = cupIdentityMeta(cup, ingestTitleForCup);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.cups')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Trophy}
                    className="h-5 w-5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={label !== '—' ? label : undefined}
                >
                  {label}
                </span>
              </div>
              {identityMeta ? (
                <span className="min-w-0 truncate pl-6 text-[10px] font-normal leading-tight tabular-nums text-slate-400 dark:text-slate-500">
                  {identityMeta}
                </span>
              ) : null}
            </div>
          );
        },
      },
      ingest: {
        field: 'ingest',
        header: t('cups.columnDistrict'),
        className: 'hidden md:table-cell',
        cell: (cup) => {
          const title = ingestTitleForCup(cup.ingest_source_id).trim();
          const label = title || (cup.ingest_source_id ? String(cup.ingest_source_id) : '—');
          return (
            <span
              className="block min-w-0 truncate text-xs text-muted-foreground"
              title={label !== '—' ? label : undefined}
            >
              {label}
            </span>
          );
        },
      },
      start_date: {
        field: 'start_date',
        header: t('cups.columnStart'),
        cell: (cup) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatStartDate(cup.start_date) || '—'}
          </span>
        ),
      },
      location: {
        field: 'location',
        header: t('cups.columnLocation'),
        className: 'hidden md:table-cell',
        cell: (cup) => (
          <span
            className="block min-w-0 truncate text-xs text-muted-foreground"
            title={cup.location || undefined}
          >
            {cup.location || '—'}
          </span>
        ),
      },
      featured: {
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
      ratings_count: {
        field: 'ratings_count',
        header: t('cups.columnRatings'),
        className: 'hidden lg:table-cell',
        cell: (cup) =>
          cup.ratings_count > 0 ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-xs text-foreground">
              {cup.ratings_count}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      created_at: {
        field: 'created_at',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (cup) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(cup.created_at) || '—'}
          </span>
        ),
      },
      updated_at: {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (cup) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(cup.updated_at) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t, ingestTitleForCup]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Cup, CupTableColumnField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={cups}
      columns={columns}
      getRowId={(cup) => String(cup.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === 'created_at' || field === 'updated_at') {
          return;
        }
        onSort(field);
      }}
      onRowClick={onRowClick}
      isRowActive={(cup) => activeCupId != null && String(cup.id) === String(activeCupId)}
      rowAriaLabel={(cup) => `Open cup ${cup.name}`}
      rowClassName={(cup) =>
        cup.deleted_at !== null && cup.deleted_at !== undefined ? 'opacity-60' : undefined
      }
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('common.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('common.unselectRow') : t('common.selectRow'),
            }
          : undefined
      }
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      pluginName="cups"
      dataListItem={(cup) => cup}
    />
  );
}
