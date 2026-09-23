import { ShoppingBag } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
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

function formatInventoryListPrice(
  price: number | null | undefined,
  currency: string,
): string | null {
  if (price == null || Number.isNaN(price)) {
    return null;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'SEK',
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency || 'SEK'}`;
  }
}

/** Brand · Qty N · price under article name (lists identity meta). */
function inventoryIdentityMeta(
  item: InventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  const brand = item.brand?.trim();
  if (brand) {
    parts.push(brand);
  }
  parts.push(t('garments.qty', { count: item.totalQuantity ?? 0 }));
  const rec = formatInventoryListPrice(item.recommendedPrice, item.currency || 'SEK');
  if (rec) {
    parts.push(rec);
  }
  return parts.join(' · ');
}

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

  const columns = useMemo((): SortableListTableColumn<InventoryItem, InventorySortField>[] => {
    return [
      {
        field: 'articleName',
        header: t('garments.articleName'),
        cell: (item) => {
          const label = item.articleName?.trim() || '—';
          const identityMeta = inventoryIdentityMeta(item, t);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.garments-inventory')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={ShoppingBag}
                    className="h-6 w-6 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={label !== '—' ? label : undefined}
                >
                  {label}
                </span>
              </div>
              <span className="min-w-0 truncate pl-7 text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                {identityMeta}
              </span>
            </div>
          );
        },
      },
    ];
  }, [t]);

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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      selection={selection}
      pluginName="garments"
      dataListItem={(item) => item}
    />
  );
}
