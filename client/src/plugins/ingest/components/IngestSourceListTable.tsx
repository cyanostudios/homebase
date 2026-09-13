import { Globe } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { IngestSource } from '../types/ingest';
import type { IngestSortField, IngestSortOrder } from '../utils/ingestListSort';

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

export type IngestSourceListTableProps = {
  sources: IngestSource[];
  primarySort: IngestSortField;
  sortOrder: IngestSortOrder;
  onSort: (field: IngestSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (source: IngestSource) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  selectionEnabled?: boolean;
  activeSourceId?: string | number | null;
};

export function IngestSourceListTable({
  sources,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  selectionEnabled = true,
  activeSourceId = null,
}: IngestSourceListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<IngestSource, IngestSortField>[] => [
      {
        field: 'name',
        header: t('ingest.colName'),
        cell: (source) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <span title={t('nav.ingest')} className="inline-flex shrink-0">
              <SectionCategoryIcon
                icon={Globe}
                className="h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3"
              />
            </span>
            <span
              className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
              title={source.name}
            >
              {source.name}
            </span>
          </div>
        ),
      },
      {
        field: 'sourceType',
        header: t('ingest.colType'),
        cell: (source) => (
          <span
            className="block min-w-0 truncate text-xs text-muted-foreground"
            title={source.sourceType || undefined}
          >
            {source.sourceType || '—'}
          </span>
        ),
      },
      {
        field: 'isActive',
        header: t('ingest.active'),
        cell: (source) => (
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              source.isActive ? 'bg-emerald-500' : 'bg-red-500',
            )}
            title={source.isActive ? t('ingest.active') : t('ingest.inactive')}
            aria-label={source.isActive ? t('ingest.active') : t('ingest.inactive')}
          />
        ),
      },
      {
        field: 'lastFetchStatus',
        header: t('ingest.colStatus'),
        cell: (source) => (
          <Badge className={cn(BADGE_CHIP_CLASS, statusBadgeClass(source.lastFetchStatus))}>
            {source.lastFetchStatus || '—'}
          </Badge>
        ),
      },
      {
        field: 'lastFetchedAt',
        header: t('ingest.colLastFetched'),
        className: 'hidden md:table-cell',
        cell: (source) => (
          <span className="text-xs text-muted-foreground">
            {source.lastFetchedAt ? formatDateTimeShort(source.lastFetchedAt) : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  const selection: SortableListTableSelection | undefined = selectionEnabled
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
    : undefined;

  return (
    <SortableListTable
      rows={sources}
      columns={columns}
      getRowId={(source) => String(source.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(source) => t('ingest.openSource', { name: source.name })}
      selection={selection}
      pluginName="ingest"
      dataListItem={(source) => source}
      isRowActive={(source) =>
        activeSourceId != null && String(source.id) === String(activeSourceId)
      }
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
