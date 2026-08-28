import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import {
  ESTIMATE_STATUS_COLORS,
  formatEstimateStatusForDisplay,
  type Estimate,
} from '../types/estimate';
import type { EstimateSortField, EstimateSortOrder } from '../utils/estimateListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

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
}: EstimateListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Estimate, EstimateSortField>[]>(
    () => [
      {
        field: 'estimateNumber',
        header: t('estimates.table.number'),
        cell: (estimate) => (
          <span className="font-mono text-xs font-extrabold text-foreground transition-colors group-hover:text-primary">
            {formatDisplayNumber('estimates', estimate.estimateNumber)}
          </span>
        ),
      },
      {
        field: 'contactName',
        header: t('estimates.fieldContact'),
        cell: (estimate) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {estimate.contactName || '—'}
          </span>
        ),
      },
      {
        field: 'status',
        header: t('estimates.fieldStatus'),
        cell: (estimate) => (
          <Badge
            className={cn(
              BADGE_CLASS,
              ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS],
            )}
          >
            {formatEstimateStatusForDisplay(estimate.status)}
          </Badge>
        ),
      },
      {
        field: 'total',
        header: t('estimates.table.total'),
        className: 'hidden sm:table-cell',
        cell: (estimate) => (
          <span className="tabular-nums text-xs text-foreground">
            {typeof estimate.total === 'number' ? estimate.total.toFixed(2) : estimate.total}{' '}
            {estimate.currency}
          </span>
        ),
      },
      {
        field: 'validTo',
        header: t('estimates.fieldValidTo'),
        className: 'hidden md:table-cell',
        cell: (estimate) => (
          <span className="text-xs text-muted-foreground">{formatDate(estimate.validTo)}</span>
        ),
      },
    ],
    [t],
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
