import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

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
  /** When false, the selection checkbox column is hidden (e.g. quick context open). */
  selectionEnabled?: boolean;
  activeInventoryId?: string | number | null;
  recentlyDuplicatedInventoryId?: string | null;
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
  selectionEnabled = true,
  activeInventoryId = null,
  recentlyDuplicatedInventoryId = null,
}: InventoryListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<InventoryItem, InventorySortField>[] => [
      {
        field: 'articleName',
        header: t('garments.articleName'),
        cell: (item) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {item.articleName || '—'}
          </span>
        ),
      },
      {
        field: 'brand',
        header: t('garments.brand'),
        className: 'hidden sm:table-cell',
        cell: (item) => <span className="text-xs text-muted-foreground">{item.brand || '—'}</span>,
      },
      {
        field: 'variantCount',
        header: t('garments.variantCount'),
        className: 'hidden md:table-cell',
        cell: (item) => (
          <span className="text-xs text-foreground">
            {item.variantCount ?? item.variants?.length ?? 0}
          </span>
        ),
      },
      {
        field: 'totalQuantity',
        header: t('garments.totalQuantity'),
        cell: (item) => <span className="text-xs text-foreground">{item.totalQuantity ?? 0}</span>,
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
      rows={items}
      columns={columns}
      getRowId={(item) => String(item.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(item) => t('garments.openInventory', { name: item.articleName || item.id })}
      isRowActive={(item) =>
        activeInventoryId !== null && String(item.id) === String(activeInventoryId)
      }
      rowClassName={(item) =>
        recentlyDuplicatedInventoryId === String(item.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      selection={selection}
      pluginName="garments"
      dataListItem={(item) => item}
    />
  );
}
