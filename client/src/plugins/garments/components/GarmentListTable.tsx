import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDate } from '@/core/utils/dateFormat';

import type { GarmentList } from '../types/garments';
import type { GarmentSortField, GarmentSortOrder } from '../utils/garmentListSort';

export type GarmentListTableProps = {
  items: GarmentList[];
  primarySort: GarmentSortField;
  sortOrder: GarmentSortOrder;
  onSort: (field: GarmentSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (item: GarmentList) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
};

export function GarmentListTable({
  items,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
}: GarmentListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<GarmentList, GarmentSortField>[] => [
      {
        field: 'name',
        header: t('garments.name'),
        cell: (item) => <span className="font-medium text-foreground">{item.name || '—'}</span>,
      },
      {
        field: 'personCount',
        header: t('garments.persons'),
        className: 'hidden sm:table-cell',
        cell: (item) => (
          <span className="text-xs text-muted-foreground">
            {item.personCount ?? item.persons?.length ?? 0}
          </span>
        ),
      },
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden sm:table-cell',
        cell: (item) => (
          <span className="text-xs text-muted-foreground">{formatDate(item.updatedAt) || '—'}</span>
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
      rows={items}
      columns={columns}
      getRowId={(item) => String(item.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(item) => t('garments.openList', { name: item.name || item.id })}
      selection={selection}
      pluginName="garments"
      dataListItem={(item) => item}
    />
  );
}
