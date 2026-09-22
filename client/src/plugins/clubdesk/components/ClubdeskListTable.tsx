import { CheckCircle2, FilePenLine, ListOrdered } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';

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
  activeClubdeskId?: string | null;
  selectionEnabled?: boolean;
};

function clubdeskIdentityMeta(
  row: Clubdesk,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  const category = (row.category || '').trim();
  parts.push(category || t('clubdesk.uncategorized'));
  const count = row.stepCount ?? row.steps?.length ?? 0;
  parts.push(t('clubdesk.stepCount', { count }));
  return parts.join(' · ');
}

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
  activeClubdeskId = null,
  selectionEnabled = true,
}: ClubdeskListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Clubdesk, ClubdeskSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('clubdesk.sort.title'),
        cell: (row) => {
          const label = row.title?.trim() || '—';
          const isPublished = row.publicationStatus === 'published';
          const identityMeta = clubdeskIdentityMeta(row, t);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.clubdesk-guides')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={ListOrdered}
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
      rows={clubdesks}
      columns={columns}
      getRowId={(row) => String(row.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      isRowActive={(row) => activeClubdeskId != null && String(row.id) === String(activeClubdeskId)}
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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
