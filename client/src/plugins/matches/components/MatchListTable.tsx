import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';

import type { Match } from '../types/match';
import type { MatchSortField, MatchSortOrder } from '../utils/matchListSort';

import { MatchTeamBadge } from './MatchTeamBadge';

export type MatchListTableProps = {
  matches: Match[];
  primarySort: MatchSortField;
  sortOrder: MatchSortOrder;
  onSort: (field: MatchSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (match: Match) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedMatchId: string | null;
};

function formatStart(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return formatDateTimeShort(value);
}

export function MatchListTable({
  matches,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedMatchId,
}: MatchListTableProps) {
  useTimeFormat();
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Match, MatchSortField>[]>(
    () => [
      {
        field: 'start_time',
        header: t('matches.timeLabel'),
        cell: (match) => (
          <span className="tabular-nums text-xs font-medium text-foreground">
            {formatStart(match.start_time)}
          </span>
        ),
      },
      {
        field: 'home_team',
        header: t('matches.homeTeamLabel'),
        cell: (match) => (
          <span className="font-medium text-foreground">{match.home_team || '—'}</span>
        ),
      },
      {
        field: 'away_team',
        header: t('matches.awayTeamLabel'),
        cell: (match) => <span className="text-foreground">{match.away_team || '—'}</span>,
      },
      {
        field: 'team_id',
        header: t('matches.team'),
        className: 'hidden sm:table-cell',
        cell: (match) =>
          match.team_id ? (
            <MatchTeamBadge teamId={match.team_id} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        field: 'location',
        header: t('matches.locationLabel'),
        className: 'hidden sm:table-cell',
        cell: (match) => (
          <span className="text-xs text-muted-foreground">{match.location || '—'}</span>
        ),
      },
      {
        field: 'competition_name',
        header: t('matches.competitionName'),
        className: 'hidden md:table-cell',
        cell: (match) => (
          <span className="text-xs text-muted-foreground">{match.competition_name || '—'}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={matches}
      columns={columns}
      getRowId={(match) => String(match.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(_match) => t('matches.openMatch')}
      rowClassName={(match) =>
        recentlyDuplicatedMatchId === String(match.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
      pluginName="matches"
      dataListItem={(match) => match}
    />
  );
}
