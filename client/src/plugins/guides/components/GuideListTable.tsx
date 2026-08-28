import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

import type { Guide } from '../types/guides';
import { GUIDE_LIFECYCLE_COLORS } from '../types/guides';
import type { GuideSortField, GuideSortOrder } from '../utils/guideListSort';

import { GuideLanguageBadges } from './GuideLanguageBadges';

export type GuideListTableProps = {
  guides: Guide[];
  primarySort: GuideSortField;
  sortOrder: GuideSortOrder;
  onSort: (field: GuideSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (guide: Guide) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  selectionEnabled?: boolean;
};

export function GuideListTable({
  guides,
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
}: GuideListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<Guide, GuideSortField>[] => [
      {
        field: 'displayName',
        header: t('guides.colName'),
        cell: (guide) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {guide.displayName}
          </span>
        ),
      },
      {
        field: 'lifecycleStatus',
        header: t('guides.colStatus'),
        cell: (guide) => (
          <Badge className={GUIDE_LIFECYCLE_COLORS[guide.lifecycleStatus]}>
            {t(`guides.lifecycle.${guide.lifecycleStatus}`)}
          </Badge>
        ),
      },
      {
        field: 'languages',
        header: t('guides.colLanguages'),
        className: 'hidden sm:table-cell',
        cell: (guide) => (
          <GuideLanguageBadges
            languages={guide.languages ?? []}
            sourceLanguage={guide.sourceLanguage}
          />
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
      rows={guides}
      columns={columns}
      getRowId={(guide) => String(guide.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(guide) => t('guides.openPlace', { name: guide.displayName })}
      selection={selection}
      pluginName="guides"
      dataListItem={(guide) => guide}
    />
  );
}
