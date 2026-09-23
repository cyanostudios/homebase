import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Minus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_ICON_SHELL_CLASS,
  RESPONSE_DUE_URGENCY_COLORS,
  formatRequestStatusForDisplay,
  getDaysUntilResponseDue,
  getResponseDueUrgency,
  getTypeLabel,
  isRequestUnopened,
  type Request,
  type RequestStatus,
} from '../types/requests';
import type { RequestSortField, RequestSortOrder } from '../utils/requestListSort';
import {
  DEFAULT_REQUEST_TABLE_COLUMNS,
  type RequestTableColumnId,
  resolveVisibleRequestTableColumns,
} from '../utils/requestTableColumns';

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

function requestStatusIcon(status: RequestStatus): LucideIcon {
  switch (status) {
    case 'in progress':
      return Clock;
    case 'completed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    default:
      return Circle;
  }
}

function requestPriorityIcon(priority: string): LucideIcon {
  switch (priority) {
    case 'High':
      return ArrowUp;
    case 'Low':
      return ArrowDown;
    default:
      return Minus;
  }
}

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
      isRequestHighlighted != null
        ? isRequestHighlighted(request) || recentlyQuickAddedId === String(request.id)
        : isRequestUnopened(request) || recentlyQuickAddedId === String(request.id);
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
        cell: (request) => {
          const StatusIcon = requestStatusIcon(request.status);
          const statusLabel = formatRequestStatusForDisplay(request.status, t);
          const typeLabel = getTypeLabel(request.requestType, t);

          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={statusLabel} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={StatusIcon}
                    className={cn(
                      'h-5 w-5 [&_svg]:h-3 [&_svg]:w-3',
                      REQUEST_STATUS_ICON_SHELL_CLASS[request.status],
                    )}
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={request.title || undefined}
                >
                  {request.title || '—'}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 pl-6">
                <span
                  className={cn(
                    'shrink-0 text-[10px] font-extrabold leading-tight',
                    REQUEST_STATUS_COLORS[request.status],
                  )}
                >
                  {statusLabel}
                </span>
                <span className="min-w-0 truncate text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                  {typeLabel}
                </span>
              </div>
            </div>
          );
        },
      },
      status: {
        field: 'status',
        header: t('requests.form.status'),
        cell: (request) => (
          <StatusOutlineBadge
            icon={requestStatusIcon(request.status)}
            className={REQUEST_STATUS_COLORS[request.status]}
          >
            {formatRequestStatusForDisplay(request.status, t)}
          </StatusOutlineBadge>
        ),
      },
      priority: {
        field: 'priority',
        header: t('requests.form.priority'),
        cell: (request) => (
          <StatusOutlineBadge
            icon={requestPriorityIcon(request.priority)}
            className={REQUEST_PRIORITY_COLORS[request.priority]}
          >
            {request.priority}
          </StatusOutlineBadge>
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
          const DueIcon = urgency === 'red' ? AlertCircle : Calendar;
          return (
            <StatusOutlineBadge
              icon={DueIcon}
              compact
              className={RESPONSE_DUE_URGENCY_COLORS[urgency]}
            >
              {responseDueStatusLabel(daysLeft, t)}
            </StatusOutlineBadge>
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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
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
