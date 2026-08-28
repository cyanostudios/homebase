import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

import type { YourItem } from '../types/your-items';
import type { YourItemSortField, YourItemSortOrder } from '../utils/yourItemListSort';

export type YourItemListTableProps = {
  items: YourItem[];
  primarySort: YourItemSortField;
  sortOrder: YourItemSortOrder;
  onSort: (field: YourItemSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (item: YourItem) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
};

export function YourItemListTable({
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
}: YourItemListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<YourItem, YourItemSortField>[] => [
      {
        field: 'title',
        header: 'Title',
        cell: (item) => <span className="font-medium text-foreground">{item.title || '—'}</span>,
      },
    ],
    [],
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
      rowAriaLabel={(item) => `Open ${item.title || item.id}`}
      selection={selection}
      pluginName="your-items"
      dataListItem={(item) => item}
    />
  );
}
