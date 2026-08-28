import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { Clubdesk } from '../types/clubdesk';
import type { ClubdeskSortField, ClubdeskSortOrder } from '../utils/clubdeskListSort';

export type ClubdeskListTableProps = {
  clubdesks: Clubdesk[];
  primarySort: ClubdeskSortField;
  sortOrder: ClubdeskSortOrder;
  onSort: (field: ClubdeskSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (clubdesk: Clubdesk) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedClubdeskId: string | null;
  selectionEnabled?: boolean;
};

export function ClubdeskListTable({
  clubdesks,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedClubdeskId,
  selectionEnabled = true,
}: ClubdeskListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Clubdesk, ClubdeskSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('clubdesk.sort.title'),
        cell: (row) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {row.title}
          </span>
        ),
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
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={clubdesks}
      columns={columns}
      getRowId={(row) => String(row.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(row) => t('clubdesk.openClubdesk', { title: row.title })}
      rowClassName={(row) =>
        recentlyDuplicatedClubdeskId === String(row.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      pluginName="clubdesk"
      dataListItem={(row) => row}
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
    />
  );
}
