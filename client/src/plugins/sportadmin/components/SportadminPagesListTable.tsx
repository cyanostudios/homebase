// client/src/plugins/sportadmin/components/SportadminPagesListTable.tsx
import { BookOpen } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';

import type { SportadminPageItem } from '../types/sportadmin';

export type SportadminPageSortField = 'title';

function pageMetaLine(page: SportadminPageItem, kindLabel: string): string {
  return page.kind ? kindLabel : '';
}

export type SportadminPagesListTableProps = {
  pages: SportadminPageItem[];
  primarySort: SportadminPageSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SportadminPageSortField) => void;
  onRowClick: (page: SportadminPageItem) => void;
  activePageId?: string | null;
};

export function SportadminPagesListTable({
  pages,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  activePageId = null,
}: SportadminPagesListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo((): SortableListTableColumn<
    SportadminPageItem,
    SportadminPageSortField
  >[] => {
    return [
      {
        field: 'title',
        header: t('sportadmin.pages.columnTitle'),
        cell: (page) => {
          const label = page.title?.trim() || '—';
          const kindKey = page.kind ? `sportadmin.pages.kind.${page.kind}` : null;
          const kindLabel = kindKey && page.kind ? t(kindKey, { defaultValue: page.kind }) : '';
          const meta = pageMetaLine(page, kindLabel);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('sportadmin.categories.pages')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={BookOpen}
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
              {meta ? (
                <span className="min-w-0 truncate pl-[2.625rem] text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                  {meta}
                </span>
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [t]);

  return (
    <SortableListTable
      rows={pages}
      columns={columns}
      getRowId={(page) => page.id}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(page) => page.title}
      pluginName="sportadmin"
      dataListItem={(page) => page}
      isRowActive={(page) => activePageId != null && page.id === activePageId}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
