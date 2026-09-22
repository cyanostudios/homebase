import { CheckCircle2, FilePenLine, Tags } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';

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
  activePriceListId?: string | null;
  selectionEnabled?: boolean;
};

function priceListIdentityMeta(
  row: ClubdeskPriceList,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  const currency = (row.currency || 'SEK').trim();
  if (currency) {
    parts.push(currency);
  }
  const count = row.itemCount ?? row.items?.length ?? 0;
  parts.push(t('clubdesk.priceList.itemCount', { count }));
  return parts.join(' · ');
}

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
  activePriceListId = null,
  selectionEnabled = true,
}: PriceListListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<ClubdeskPriceList, PriceListSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('clubdesk.sort.title'),
        cell: (row) => {
          const label = row.title?.trim() || '—';
          const isPublished = row.publicationStatus === 'published';
          const identityMeta = priceListIdentityMeta(row, t);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.clubdesk-price-list')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Tags}
                    className="h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={label !== '—' ? label : undefined}
                >
                  {label}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 pl-6">
                <StatusOutlineBadge
                  compact
                  icon={isPublished ? CheckCircle2 : FilePenLine}
                  className={
                    isPublished ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted
                  }
                >
                  {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
                </StatusOutlineBadge>
                <span className="min-w-0 truncate text-[10px] font-normal leading-tight tabular-nums text-slate-400 dark:text-slate-500">
                  {identityMeta}
                </span>
              </div>
            </div>
          );
        },
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
      isRowActive={(row) =>
        activePriceListId != null && String(row.id) === String(activePriceListId)
      }
      rowAriaLabel={(row) => t('clubdesk.priceList.openPriceList', { title: row.title })}
      rowClassName={(row) =>
        recentlyDuplicatedPriceListId === String(row.id)
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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
