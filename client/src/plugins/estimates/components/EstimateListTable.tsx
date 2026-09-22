import { User, Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '@/plugins/contacts/types/contacts';
import { formatInvoiceMoney } from '@/plugins/invoices/utils/formatInvoiceAmount';

import {
  ESTIMATE_STATUS_COLORS,
  formatEstimateStatusForDisplay,
  type Estimate,
} from '../types/estimate';
import type { EstimateSortField, EstimateSortOrder } from '../utils/estimateListSort';
import {
  DEFAULT_ESTIMATE_TABLE_COLUMNS,
  type EstimateTableColumnId,
  resolveVisibleEstimateTableColumns,
} from '../utils/estimateTableColumns';

export type EstimateListTableProps = {
  estimates: Estimate[];
  primarySort: EstimateSortField;
  sortOrder: EstimateSortOrder;
  onSort: (field: EstimateSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (estimate: Estimate) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedEstimateId: string | null;
  selectionEnabled?: boolean;
  activeEstimateId?: string | number | null;
  visibleColumnIds?: EstimateTableColumnId[];
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

export function EstimateListTable({
  estimates,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedEstimateId,
  selectionEnabled = true,
  activeEstimateId = null,
  visibleColumnIds,
}: EstimateListTableProps) {
  const { t } = useTranslation();
  const { contacts } = useApp();

  const contactTypeById = useMemo(() => {
    const map = new Map<string, 'company' | 'private'>();
    for (const contact of contacts ?? []) {
      if (contact?.id == null || !contact.contactType) {
        continue;
      }
      map.set(String(contact.id), contact.contactType === 'private' ? 'private' : 'company');
    }
    return map;
  }, [contacts]);

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleEstimateTableColumns({ tableColumns: DEFAULT_ESTIMATE_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<
      EstimateTableColumnId,
      SortableListTableColumn<Estimate, EstimateSortField>
    > = {
      estimateNumber: {
        field: 'estimateNumber',
        header: t('estimates.table.number'),
        cell: (estimate) => {
          const number = formatDisplayNumber('estimates', estimate.estimateNumber);
          const contactName = estimate.contactName?.trim() || '';
          const contactType =
            estimate.contactId != null
              ? contactTypeById.get(String(estimate.contactId))
              : undefined;
          const typeLabel = contactType
            ? t(`contacts.type.${contactType}`, {
                defaultValue: contactType === 'private' ? 'Private' : 'Company',
              })
            : null;
          const status = estimate.status || 'draft';
          const totalLabel = formatInvoiceMoney(estimate.total, estimate.currency || 'SEK');
          const updatedLabel = estimate.updatedAt ? formatDateTimeShort(estimate.updatedAt) : null;
          const TypeIcon =
            contactType === 'private' ? User : contactType === 'company' ? Users : null;
          const hasSubtitle = Boolean(totalLabel || updatedLabel);

          const numberRow = (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="min-w-0 truncate font-mono text-xs font-extrabold text-foreground transition-colors group-hover:text-primary"
                title={number}
              >
                {number}
              </span>
              {TypeIcon ? (
                <span title={typeLabel ?? undefined} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={TypeIcon}
                    className={cn(
                      'h-5 w-5 [&_svg]:h-3 [&_svg]:w-3',
                      contactType ? CONTACT_TYPE_ICON_SHELL_CLASS[contactType] : undefined,
                    )}
                  />
                </span>
              ) : null}
              {contactName ? (
                <span
                  className="min-w-0 truncate text-xs font-medium text-foreground"
                  title={contactName}
                >
                  {contactName}
                </span>
              ) : null}
              <Badge
                className={cn(
                  'shrink-0',
                  BADGE_CHIP_CLASS,
                  ESTIMATE_STATUS_COLORS[status as keyof typeof ESTIMATE_STATUS_COLORS],
                )}
              >
                {formatEstimateStatusForDisplay(status)}
              </Badge>
            </div>
          );

          if (!hasSubtitle) {
            return numberRow;
          }

          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              {numberRow}
              <div className="flex min-w-0 items-center gap-1.5">
                {totalLabel ? (
                  <span className="shrink-0 tabular-nums text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                    {totalLabel}
                  </span>
                ) : null}
                {updatedLabel ? (
                  <span className="shrink-0 tabular-nums text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                    {t('common.updated')} {updatedLabel}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      contactName: {
        field: 'contactName',
        header: t('estimates.fieldContact'),
        cell: (estimate) => (
          <span
            className="block min-w-0 truncate font-extrabold text-foreground transition-colors group-hover:text-primary"
            title={estimate.contactName || undefined}
          >
            {estimate.contactName || '—'}
          </span>
        ),
      },
      status: {
        field: 'status',
        header: t('estimates.fieldStatus'),
        cell: (estimate) => (
          <Badge
            className={cn(
              BADGE_CHIP_CLASS,
              ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS],
            )}
          >
            {formatEstimateStatusForDisplay(estimate.status)}
          </Badge>
        ),
      },
      total: {
        field: 'total',
        header: t('estimates.table.total'),
        className: 'hidden sm:table-cell',
        cell: (estimate) => (
          <span className="tabular-nums text-xs text-foreground">
            {formatInvoiceMoney(estimate.total, estimate.currency || 'SEK')}
          </span>
        ),
      },
      validTo: {
        field: 'validTo',
        header: t('estimates.fieldValidTo'),
        className: 'hidden md:table-cell',
        cell: (estimate) => (
          <span className="text-xs text-muted-foreground">{formatDate(estimate.validTo)}</span>
        ),
      },
      createdAt: {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (estimate) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(estimate.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (estimate) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(estimate.updatedAt) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [contactTypeById, t]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Estimate, EstimateSortField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={estimates}
      columns={columns}
      getRowId={(estimate) => String(estimate.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(estimate) =>
        t('estimates.openEstimate', {
          defaultValue: `Open estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}`,
          number: formatDisplayNumber('estimates', estimate.estimateNumber),
        })
      }
      rowClassName={(estimate) =>
        recentlyDuplicatedEstimateId === String(estimate.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(estimate) =>
        activeEstimateId != null && String(estimate.id) === String(activeEstimateId)
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
      pluginName="estimates"
      dataListItem={(estimate) => estimate}
    />
  );
}
