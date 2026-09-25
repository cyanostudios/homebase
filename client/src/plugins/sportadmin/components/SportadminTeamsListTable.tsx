// client/src/plugins/sportadmin/components/SportadminTeamsListTable.tsx
import { Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';

import type { SportadminTeamItem } from '../types/sportadmin';

export type SportadminTeamSortField = 'name';

function teamMetaLine(team: SportadminTeamItem): string {
  return [team.category, team.age_group]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(' · ');
}

export type SportadminTeamsListTableProps = {
  teams: SportadminTeamItem[];
  primarySort: SportadminTeamSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SportadminTeamSortField) => void;
  onRowClick: (team: SportadminTeamItem) => void;
  activeTeamId?: string | null;
};

export function SportadminTeamsListTable({
  teams,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  activeTeamId = null,
}: SportadminTeamsListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo((): SortableListTableColumn<
    SportadminTeamItem,
    SportadminTeamSortField
  >[] => {
    return [
      {
        field: 'name',
        header: t('sportadmin.teams.columnName'),
        cell: (team) => {
          const label = team.name?.trim() || '—';
          const meta = teamMetaLine(team);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('sportadmin.categories.teams')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Users}
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
      rows={teams}
      columns={columns}
      getRowId={(team) => team.id}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(team) => {
        const meta = teamMetaLine(team);
        return meta ? `${team.name}, ${meta}` : team.name;
      }}
      pluginName="sportadmin"
      dataListItem={(team) => team}
      isRowActive={(team) => activeTeamId != null && team.id === activeTeamId}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
