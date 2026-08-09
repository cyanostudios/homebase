import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDate } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import { isTeamOnBreak, TEAM_STATUS_BADGES, type Team, type TeamStatus } from '../types/teams';
import type { TeamSortField, TeamSortOrder } from '../utils/teamListSort';

export type TeamListTableProps = {
  teams: Team[];
  primarySort: TeamSortField;
  sortOrder: TeamSortOrder;
  onSort: (field: TeamSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (team: Team) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedTeamId?: string | null;
};

export function TeamListTable({
  teams,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedTeamId = null,
}: TeamListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<Team, TeamSortField>[] => [
      {
        field: 'name',
        header: t('teams.table.name'),
        cell: (team) => <span className="font-medium text-foreground">{team.name}</span>,
      },
      {
        field: 'age_group',
        header: t('teams.table.age'),
        cell: (team) => (
          <span className="text-xs text-muted-foreground">{team.age_group || '—'}</span>
        ),
      },
      {
        field: 'gender',
        header: t('teams.table.gender'),
        className: 'hidden sm:table-cell',
        cell: (team) => (
          <span className="text-xs text-muted-foreground">
            {team.gender ? t(`teams.gender.${team.gender}`) : '—'}
          </span>
        ),
      },
      {
        field: 'status',
        header: t('teams.table.status'),
        cell: (team) => {
          const statusKey: TeamStatus = isTeamOnBreak(team) ? 'break' : team.status;
          return (
            <Badge
              className={cn(
                'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                TEAM_STATUS_BADGES[statusKey],
              )}
            >
              {t(`teams.status.${statusKey}`)}
            </Badge>
          );
        },
      },
      {
        field: 'player_count',
        header: t('teams.table.players'),
        className: 'hidden md:table-cell',
        cell: (team) => (
          <span className="text-xs tabular-nums text-muted-foreground">{team.player_count}</span>
        ),
      },
      {
        field: 'updated_at',
        header: t('teams.table.updated'),
        className: 'hidden lg:table-cell',
        cell: (team) => (
          <span className="text-xs text-muted-foreground">
            {team.updated_at ? formatDate(team.updated_at) : '—'}
          </span>
        ),
      },
    ],
    [t],
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
      rows={teams}
      columns={columns}
      getRowId={(team) => String(team.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(team) => t('teams.openTeam', { name: team.name })}
      rowClassName={(team) =>
        recentlyDuplicatedTeamId === String(team.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      selection={selection}
      pluginName="teams"
      dataListItem={(team) => team}
    />
  );
}
