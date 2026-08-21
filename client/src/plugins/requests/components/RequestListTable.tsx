import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_SOURCE_COLORS,
  REQUEST_STATUS_COLORS,
  RESPONSE_DUE_URGENCY_COLORS,
  formatRequestStatusForDisplay,
  getDaysUntilResponseDue,
  getResponseDueUrgency,
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
  /** When false, the selection checkbox column is hidden (e.g. quick context open). */
  selectionEnabled?: boolean;
  activeRequestId?: string | number | null;
};

function responseDueStatusLabel(
  daysLeft: number | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (daysLeft === null) {
    return t('requests.responseDue.unknown');
  }
  if (daysLeft < 0) {
    return t('requests.responseDue.overdue', { count: Math.abs(daysLeft) });
  }
  if (daysLeft === 0) {
    return t('requests.responseDue.today');
  }
  if (daysLeft === 1) {
    return t('requests.responseDue.oneDay');
  }
  return t('requests.responseDue.daysLeft', { count: daysLeft });
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
  selectionEnabled = true,
  activeRequestId = null,
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
        field: 'responseDueAt',
        header: t('requests.responseDue.label'),
        className: 'hidden lg:table-cell',
        cell: (request) => {
          const daysLeft = getDaysUntilResponseDue(request.responseDueAt);
          const urgency = getResponseDueUrgency(daysLeft);
          return (
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-1.5 text-[10px] font-medium',
                RESPONSE_DUE_URGENCY_COLORS[urgency],
              )}
            >
              {responseDueStatusLabel(daysLeft, t)}
            </Badge>
          );
        },
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
      isRowActive={(request) =>
        activeRequestId != null && String(request.id) === String(activeRequestId)
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
      pluginName="requests"
      dataListItem={(request) => request}
    />
  );
}
