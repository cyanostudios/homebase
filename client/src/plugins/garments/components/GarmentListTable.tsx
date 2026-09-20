import { Shirt } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

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

function garmentListIdentityMeta(
  item: GarmentList,
  teamLabelById: Map<string, string>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  if (item.teamId != null && String(item.teamId).trim() !== '') {
    const teamLabel = teamLabelById.get(String(item.teamId))?.trim();
    if (teamLabel) {
      parts.push(teamLabel);
    }
  }
  const personCount = item.personCount ?? item.persons?.length ?? 0;
  parts.push(t('garments.personCount', { count: personCount }));
  return parts.join(' · ');
}

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
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();

  const teamLabelById = useMemo(() => {
    const map = new Map<string, string>();
    if (!hasTeams) {
      return map;
    }
    for (const team of teams) {
      map.set(String(team.id), formatTeamLabel(team) || team.name || '');
    }
    return map;
  }, [hasTeams, teams]);

  const columns = useMemo(
    (): SortableListTableColumn<GarmentList, GarmentSortField>[] => [
      {
        field: 'name',
        header: t('garments.name'),
        cell: (item) => {
          const label = item.name?.trim() || '—';
          const identityMeta = garmentListIdentityMeta(item, teamLabelById, t);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.garments-lists')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Shirt}
                    className="h-6 w-6 bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 [&_svg]:h-3 [&_svg]:w-3"
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
    ],
    [t, teamLabelById],
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
