import { Shirt } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

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
  recentlyDuplicatedListId?: string | null;
  selectionEnabled?: boolean;
  activeListId?: string | number | null;
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
  recentlyDuplicatedListId = null,
  selectionEnabled = true,
  activeListId = null,
}: GarmentListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<GarmentList, GarmentSortField>[] => [
      {
        field: 'name',
        header: t('garments.name'),
        cell: (item) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <span title={t('nav.garments-lists')} className="inline-flex shrink-0">
              <SectionCategoryIcon
                icon={Shirt}
                className="h-6 w-6 bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 [&_svg]:h-3 [&_svg]:w-3"
              />
            </span>
            <span
              className="block min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
              title={item.name || undefined}
            >
              {item.name || '—'}
            </span>
          </div>
        ),
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
      rowAriaLabel={(item) => t('garments.openList', { name: item.name || item.id })}
      rowClassName={(item) =>
        recentlyDuplicatedListId === String(item.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(item) => activeListId != null && String(item.id) === String(activeListId)}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      selection={selection}
      pluginName="garments"
      dataListItem={(item) => item}
    />
  );
}
