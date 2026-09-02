import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_STATUS_COLORS,
  RESPONSE_DUE_URGENCY_COLORS,
  formatRequestStatusForDisplay,
  getDaysUntilResponseDue,
  getResponseDueUrgency,
  getTypeLabel,
  isRequestUnopened,
  type Request,
} from '../types/requests';
import type { RequestSortField, RequestSortOrder } from '../utils/requestListSort';
import {
  DEFAULT_REQUEST_TABLE_COLUMNS,
  type RequestTableColumnId,
  resolveVisibleRequestTableColumns,
} from '../utils/requestTableColumns';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

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
  isRequestHighlighted?: (request: Request) => boolean;
  /** When false, the selection checkbox column is hidden (e.g. quick context open). */
  selectionEnabled?: boolean;
  activeRequestId?: string | number | null;
  visibleColumnIds?: RequestTableColumnId[];
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
  isRequestHighlighted,
  selectionEnabled = true,
  activeRequestId = null,
  visibleColumnIds,
}: RequestListTableProps) {
  const { t } = useTranslation();

  const getHighlightClass = (request: Request) => {
    const highlighted =
      isRequestHighlighted?.(request) ??
      (isRequestUnopened(request) || recentlyQuickAddedId === String(request.id));
    return highlighted ? 'bg-green-50 dark:bg-green-950/30' : undefined;
  };

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleRequestTableColumns({ tableColumns: DEFAULT_REQUEST_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<RequestTableColumnId, SortableListTableColumn<Request, RequestSortField>> = {
      title: {
        field: 'title',
        header: t('requests.form.title'),
        cell: (request) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {request.title || '—'}
          </span>
        ),
      },
      status: {
        field: 'status',
        header: t('requests.form.status'),
        cell: (request) => (
          <Badge className={cn(BADGE_CLASS, REQUEST_STATUS_COLORS[request.status])}>
            {formatRequestStatusForDisplay(request.status, t)}
          </Badge>
        ),
      },
      priority: {
        field: 'priority',
        header: t('requests.form.priority'),
        cell: (request) => (
          <Badge className={cn(BADGE_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}>
            {request.priority}
          </Badge>
        ),
      },
      type: {
        field: 'type',
        header: t('requests.form.requestType'),
        className: 'hidden sm:table-cell',
        cell: (request) => (
          <span className="text-xs text-muted-foreground">
            {getTypeLabel(request.requestType, t)}
          </span>
        ),
      },
      responseDueAt: {
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
                'h-5 border-transparent px-1.5 text-[10px] font-extrabold',
                RESPONSE_DUE_URGENCY_COLORS[urgency],
              )}
            >
              {responseDueStatusLabel(daysLeft, t)}
            </Badge>
          );
        },
      },
      source: {
        field: 'source',
        header: t('requests.form.source'),
        className: 'hidden md:table-cell',
        cell: (request) => (
          <span className="text-xs capitalize text-muted-foreground">{request.source || '—'}</span>
        ),
      },
      created_at: {
        field: 'created_at',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (request) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(request.created_at) || '—'}
          </span>
        ),
      },
      updated_at: {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (request) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(request.updated_at) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Request, RequestSortField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
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
      rowClassName={(request) => getHighlightClass(request)}
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
