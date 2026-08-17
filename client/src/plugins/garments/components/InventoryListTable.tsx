import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDate } from '@/core/utils/dateFormat';

import type { InventoryItem } from '../types/garments';
import type { GarmentSortOrder, InventorySortField } from '../utils/garmentListSort';

export type InventoryListTableProps = {
  items: InventoryItem[];
  primarySort: InventorySortField;
  sortOrder: GarmentSortOrder;
  onSort: (field: InventorySortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (item: InventoryItem) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
};

export function InventoryListTable({
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
}: InventoryListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<InventoryItem, InventorySortField>[] => [
      {
        field: 'articleName',
        header: t('garments.articleName'),
        cell: (item) => (
          <span className="font-medium text-foreground">{item.articleName || '—'}</span>
        ),
      },
      {
        field: 'brand',
        header: t('garments.brand'),
        className: 'hidden sm:table-cell',
        cell: (item) => <span className="text-xs text-muted-foreground">{item.brand || '—'}</span>,
      },
      {
        field: 'size',
        header: t('garments.size'),
        className: 'hidden md:table-cell',
        cell: (item) => <span className="text-xs text-muted-foreground">{item.size || '—'}</span>,
      },
      {
        field: 'quantity',
        header: t('garments.quantity'),
        cell: (item) => <span className="text-xs text-foreground">{item.quantity}</span>,
      },
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
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
      rowAriaLabel={(item) => t('garments.openInventory', { name: item.articleName || item.id })}
      selection={selection}
      pluginName="garments"
      dataListItem={(item) => item}
    />
  );
}
