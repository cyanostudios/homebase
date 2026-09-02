import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';

import type { InventoryItem } from '../types/garments';
import type { GarmentSortOrder, InventorySortField } from '../utils/garmentListSort';
import {
  DEFAULT_INVENTORY_TABLE_COLUMNS,
  type InventoryTableColumnId,
  resolveVisibleInventoryTableColumns,
} from '../utils/inventoryTableColumns';

type InventoryTableField = InventorySortField | 'material' | 'salePrice' | 'tags' | 'createdAt';

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
  visibleColumnIds?: InventoryTableColumnId[];
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
  visibleColumnIds,
}: InventoryListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleInventoryTableColumns({ tableColumns: DEFAULT_INVENTORY_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<
      InventoryTableColumnId,
      SortableListTableColumn<InventoryItem, InventoryTableField>
    > = {
      articleName: {
        field: 'articleName',
        header: t('garments.articleName'),
        cell: (item) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {item.articleName || '—'}
          </span>
        ),
      },
      brand: {
        field: 'brand',
        header: t('garments.brand'),
        className: 'hidden sm:table-cell',
        cell: (item) => <span className="text-xs text-muted-foreground">{item.brand || '—'}</span>,
      },
      tags: {
        field: 'tags',
        header: t('garments.tags'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (item) => {
          const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
          if (tags.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex max-w-[12rem] flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-5 border-border/50 px-1.5 text-[10px] font-normal"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 ? (
                <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
              ) : null}
            </div>
          );
        },
      },
      variantCount: {
        field: 'variantCount',
        header: t('garments.variantCount'),
        className: 'hidden md:table-cell',
        cell: (item) => (
          <span className="text-xs text-foreground">
            {item.variantCount ?? item.variants?.length ?? 0}
          </span>
        ),
      },
      totalQuantity: {
        field: 'totalQuantity',
        header: t('garments.totalQuantity'),
        cell: (item) => <span className="text-xs text-foreground">{item.totalQuantity ?? 0}</span>,
      },
      material: {
        field: 'material',
        header: t('garments.material'),
        className: 'hidden md:table-cell',
        sortable: false,
        cell: (item) => (
          <span className="text-xs text-muted-foreground">{item.material || '—'}</span>
        ),
      },
      salePrice: {
        field: 'salePrice',
        header: t('garments.salePrice'),
        className: 'hidden md:table-cell',
        sortable: false,
        cell: (item) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {item.salePrice != null ? item.salePrice : '—'}
          </span>
        ),
      },
      createdAt: {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (item) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(item.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (item) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(item.updatedAt) || '—'}
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
        .filter((col): col is SortableListTableColumn<InventoryItem, InventoryTableField> =>
          Boolean(col),
        ),
    [orderedVisibleIds, columnDefs],
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
      onSort={(field) => {
        if (
          field === 'material' ||
          field === 'salePrice' ||
          field === 'createdAt' ||
          field === 'tags'
        ) {
          return;
        }
        onSort(field);
      }}
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
