import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import { isTeamOnBreak, TEAM_STATUS_BADGES, type Team, type TeamStatus } from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';
import type { TeamSortField, TeamSortOrder } from '../utils/teamListSort';
import {
  DEFAULT_TEAM_TABLE_COLUMNS,
  type TeamTableColumnId,
  resolveVisibleTeamTableColumns,
} from '../utils/teamTableColumns';

import { TeamSeriesTeamBadges } from './TeamSeriesTeamBadges';

type TeamTableColumnField = TeamSortField | 'series_teams' | 'playing_format';

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
  activeTeamId?: string | number | null;
  selectionEnabled?: boolean;
  visibleColumnIds?: TeamTableColumnId[];
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
  activeTeamId = null,
  selectionEnabled = true,
  visibleColumnIds,
}: TeamListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleTeamTableColumns({ tableColumns: DEFAULT_TEAM_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<TeamTableColumnId, SortableListTableColumn<Team, TeamTableColumnField>> = {
      age_group: {
        field: 'age_group',
        header: t('teams.table.age'),
        cell: (team) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {formatTeamLabel(team) || '—'}
          </span>
        ),
      },
      name: {
        field: 'name',
        header: t('teams.table.name'),
        className: 'hidden sm:table-cell',
        cell: (team) => <span className="text-xs text-muted-foreground">{team.name || '—'}</span>,
      },
      gender: {
        field: 'gender',
        header: t('teams.table.gender'),
        className: 'hidden sm:table-cell',
        cell: (team) => (
          <span className="text-xs text-muted-foreground">
            {team.gender ? t(`teams.gender.${team.gender}`) : '—'}
          </span>
        ),
      },
      status: {
        field: 'status',
        header: t('teams.table.status'),
        cell: (team) => {
          const statusKey: TeamStatus = isTeamOnBreak(team) ? 'break' : team.status;
          return (
            <Badge
              className={cn(
                'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold',
                TEAM_STATUS_BADGES[statusKey],
              )}
            >
              {t(`teams.status.${statusKey}`)}
            </Badge>
          );
        },
      },
      series_teams: {
        field: 'series_teams',
        header: t('teams.table.seriesTeams'),
        sortable: false,
        className: 'hidden md:table-cell',
        cell: (team) => (
          <TeamSeriesTeamBadges
            team={team}
            empty={<span className="text-xs text-muted-foreground">—</span>}
          />
        ),
      },
      player_count: {
        field: 'player_count',
        header: t('teams.table.players'),
        className: 'hidden md:table-cell',
        cell: (team) => (
          <span className="text-xs tabular-nums text-muted-foreground">{team.player_count}</span>
        ),
      },
      playing_format: {
        field: 'playing_format',
        header: t('teams.form.playingFormatLabel'),
        sortable: false,
        className: 'hidden md:table-cell',
        cell: (team) => (
          <span className="text-xs text-muted-foreground">{team.playing_format || '—'}</span>
        ),
      },
      created_at: {
        field: 'created_at',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (team) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(team.created_at) || '—'}
          </span>
        ),
      },
      updated_at: {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (team) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(team.updated_at) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Team, TeamTableColumnField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
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
      rows={teams}
      columns={columns}
      getRowId={(team) => String(team.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === 'series_teams' || field === 'playing_format') {
          return;
        }
        onSort(field);
      }}
      onRowClick={onRowClick}
      rowAriaLabel={(team) => t('teams.openTeam', { name: formatTeamLabel(team) || team.name })}
      isRowActive={(team) =>
        activeTeamId !== null &&
        activeTeamId !== undefined &&
        String(team.id) === String(activeTeamId)
      }
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
