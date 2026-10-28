/**
 * Contacts-class identity column: name + meta row (hostname · score · last run).
 * See docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md §4 "Default list row composition".
 */
import { Globe } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

import type { SiteAudit } from '../types/site-audits';
import { formatSiteAuditRelativeTime, formatSiteAuditScore } from '../utils/siteAuditFormat';
import type { SiteAuditSortField, SiteAuditSortOrder } from '../utils/siteAuditListSort';
import { getSiteAuditHostname } from '../utils/siteAuditUrl';

export type SiteAuditListTableProps = {
  items: SiteAudit[];
  primarySort: SiteAuditSortField;
  sortOrder: SiteAuditSortOrder;
  onSort: (field: SiteAuditSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (item: SiteAudit) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  selectionEnabled?: boolean;
  activeItemId?: string | number | null;
};

export function SiteAuditListTable({
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
  activeItemId = null,
}: SiteAuditListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<SiteAudit, SiteAuditSortField>[] => [
      {
        field: 'name',
        header: t('siteAudits.table.name'),
        cell: (item) => {
          const hostname = getSiteAuditHostname(item.url);
          const scoreLabel = formatSiteAuditScore(item.lastScore);
          const lastRunLabel = item.lastRunAt
            ? formatSiteAuditRelativeTime(item.lastRunAt, t)
            : t('siteAudits.neverRun');
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.site-audits')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Globe}
                    className="h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={item.name}
                >
                  {item.name || '—'}
                </span>
              </div>
              <div className="min-w-0 truncate pl-6 text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                {hostname} <span aria-hidden>·</span> {scoreLabel} <span aria-hidden>·</span>{' '}
                {lastRunLabel}
              </div>
            </div>
          );
        },
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
      rowAriaLabel={(item) => t('siteAudits.openSite', { name: item.name || item.id })}
      isRowActive={(item) => activeItemId !== null && String(item.id) === String(activeItemId)}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      selection={selection}
      pluginName="site-audits"
      dataListItem={(item) => item}
    />
  );
}
