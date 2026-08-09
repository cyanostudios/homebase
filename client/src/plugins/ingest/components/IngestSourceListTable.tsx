import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDate, formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { IngestSource } from '../types/ingest';
import type { IngestSortField, IngestSortOrder } from '../utils/ingestListSort';

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
}: IngestSourceListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<IngestSource, IngestSortField>[] => [
      {
        field: 'name',
        header: t('ingest.colName'),
        cell: (source) => <span className="font-medium text-foreground">{source.name}</span>,
      },
      {
        field: 'sourceType',
        header: t('ingest.colType'),
        cell: (source) => (
          <span className="text-xs text-muted-foreground">{source.sourceType || '—'}</span>
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
          <Badge className={cn(BADGE_CLASS, statusBadgeClass(source.lastFetchStatus))}>
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
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (source) => (
          <span className="text-xs text-muted-foreground">
            {source.updatedAt ? formatDate(source.updatedAt) : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  const selection: SortableListTableSelection = {
    isSelected,
    onCheckboxMouseDown,
    onCheckboxChange,
    allVisibleSelected,
    onHeaderCheckboxChange,
    selectAllAriaLabel: t('common.selectAllVisible'),
    selectRowAriaLabel: (selected) => (selected ? t('common.unselectRow') : t('common.selectRow')),
  };

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
    />
  );
}
