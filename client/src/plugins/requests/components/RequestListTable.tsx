import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_SOURCE_COLORS,
  REQUEST_STATUS_COLORS,
  formatRequestStatusForDisplay,
  getTypeLabel,
  type Request,
} from '../types/requests';
import type { RequestSortField, RequestSortOrder } from '../utils/requestListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

export type RequestListTableProps = {
  requests: Request[];
  primarySort: RequestSortField;
  sortOrder: RequestSortOrder;
  onSort: (field: RequestSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (request: Request) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyQuickAddedId: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

export function RequestListTable({
  requests,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyQuickAddedId,
}: RequestListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Request, RequestSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('requests.form.title'),
        cell: (request) => (
          <span className="font-medium text-foreground">{request.title || '—'}</span>
        ),
      },
      {
        field: 'status',
        header: t('requests.form.status'),
        cell: (request) => (
          <Badge className={cn(BADGE_CLASS, REQUEST_STATUS_COLORS[request.status])}>
            {formatRequestStatusForDisplay(request.status, t)}
          </Badge>
        ),
      },
      {
        field: 'priority',
        header: t('requests.form.priority'),
        cell: (request) => (
          <Badge className={cn(BADGE_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}>
            {request.priority}
          </Badge>
        ),
      },
      {
        field: 'type',
        header: t('requests.form.requestType'),
        className: 'hidden sm:table-cell',
        cell: (request) => (
          <span className="text-xs text-muted-foreground">
            {getTypeLabel(request.requestType, t)}
          </span>
        ),
      },
      {
        field: 'source',
        header: t('requests.view.source'),
        className: 'hidden md:table-cell',
        cell: (request) => (
          <Badge className={cn(BADGE_CLASS, REQUEST_SOURCE_COLORS[request.source])}>
            {request.source === 'external'
              ? t('requests.sourceExternal')
              : t('requests.sourceInternal')}
          </Badge>
        ),
      },
      {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (request) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(request.updated_at || request.created_at)}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={requests}
      columns={columns}
      getRowId={(request) => String(request.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(request) => t('requests.openRequest') + `: ${request.title || ''}`}
      rowClassName={(request) =>
        recentlyQuickAddedId === String(request.id) ? 'bg-green-50 dark:bg-green-950/30' : undefined
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
      pluginName="requests"
      dataListItem={(request) => request}
    />
  );
}
