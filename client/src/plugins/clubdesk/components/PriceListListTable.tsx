import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { ClubdeskPriceList } from '../types/priceList';
import type { PriceListSortField, PriceListSortOrder } from '../utils/priceListListSort';

export type PriceListListTableProps = {
  priceLists: ClubdeskPriceList[];
  primarySort: PriceListSortField;
  sortOrder: PriceListSortOrder;
  onSort: (field: PriceListSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (priceList: ClubdeskPriceList) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedPriceListId: string | null;
};

export function PriceListListTable({
  priceLists,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedPriceListId,
}: PriceListListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<ClubdeskPriceList, PriceListSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('clubdesk.sort.title'),
        cell: (row) => <span className="font-medium text-foreground">{row.title}</span>,
      },
      {
        field: 'publicationStatus',
        header: t('clubdesk.sort.status'),
        cell: (row) => {
          const isPublished = row.publicationStatus === 'published';
          return (
            <Badge
              variant={isPublished ? 'default' : 'secondary'}
              className={cn(
                'text-[10px] font-extrabold',
                isPublished &&
                  'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
              )}
            >
              {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
            </Badge>
          );
        },
      },
      {
        field: 'currency',
        header: t('clubdesk.priceList.currency'),
        className: 'hidden sm:table-cell',
        cell: (row) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {row.currency || 'SEK'}
          </span>
        ),
      },
      {
        field: 'itemCount',
        header: t('clubdesk.priceList.itemsCard'),
        className: 'hidden md:table-cell',
        cell: (row) => {
          const count = row.itemCount ?? row.items?.length ?? 0;
          return (
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('clubdesk.priceList.itemCount', { count })}
            </span>
          );
        },
      },
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={priceLists}
      columns={columns}
      getRowId={(row) => String(row.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(row) => t('clubdesk.priceList.openPriceList', { title: row.title })}
      rowClassName={(row) =>
        recentlyDuplicatedPriceListId === String(row.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      pluginName="clubdesk"
      dataListItem={(row) => row}
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
    />
  );
}
