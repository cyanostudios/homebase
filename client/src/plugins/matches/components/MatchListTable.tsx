import { Trophy } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';

import type { Match } from '../types/match';
import type { MatchSortField, MatchSortOrder } from '../utils/matchListSort';
import {
  DEFAULT_MATCH_TABLE_COLUMNS,
  type MatchTableColumnId,
  resolveVisibleMatchTableColumns,
} from '../utils/matchTableColumns';

import { MatchTeamBadge } from './MatchTeamBadge';

type MatchTableColumnField = MatchSortField | 'matchup';

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
  activeMatchId?: string | number | null;
  selectionEnabled?: boolean;
  visibleColumnIds?: MatchTableColumnId[];
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
  activeMatchId = null,
  selectionEnabled = true,
  visibleColumnIds,
}: MatchListTableProps) {
  useTimeFormat();
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleMatchTableColumns({ tableColumns: DEFAULT_MATCH_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<
      MatchTableColumnId,
      SortableListTableColumn<Match, MatchTableColumnField>
    > = {
      matchup: {
        field: 'matchup',
        header: t('matches.matchupLabel'),
        className: 'md:hidden',
        sortable: false,
        cell: (match) => {
          const label = `${match.home_team || '—'} – ${match.away_team || '—'}`;
          return (
            <div className="flex min-w-0 items-center gap-1.5">
              <span title={t('nav.match')} className="inline-flex shrink-0">
                <SectionCategoryIcon
                  icon={Trophy}
                  className="h-5 w-5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-3 [&_svg]:w-3"
                />
              </span>
              <span
                className="min-w-0 truncate font-extrabold text-foreground transition-colors group-hover:text-primary"
                title={label}
              >
                {label}
              </span>
            </div>
          );
        },
      },
      start_time: {
        field: 'start_time',
        header: t('matches.timeLabel'),
        cell: (match) => (
          <span className="tabular-nums text-xs font-medium text-foreground">
            {formatStart(match.start_time)}
          </span>
        ),
      },
      home_team: {
        field: 'home_team',
        header: t('matches.homeTeamLabel'),
        className: 'hidden md:table-cell',
        cell: (match) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <span title={t('nav.match')} className="inline-flex shrink-0">
              <SectionCategoryIcon
                icon={Trophy}
                className="h-5 w-5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-3 [&_svg]:w-3"
              />
            </span>
            <span
              className="min-w-0 truncate font-medium text-foreground"
              title={match.home_team || undefined}
            >
              {match.home_team || '—'}
            </span>
          </div>
        ),
      },
      away_team: {
        field: 'away_team',
        header: t('matches.awayTeamLabel'),
        className: 'hidden md:table-cell',
        cell: (match) => (
          <span
            className="block min-w-0 truncate text-foreground"
            title={match.away_team || undefined}
          >
            {match.away_team || '—'}
          </span>
        ),
      },
      team_id: {
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
      location: {
        field: 'location',
        header: t('matches.locationLabel'),
        className: 'hidden sm:table-cell',
        cell: (match) => (
          <span className="text-xs text-muted-foreground">{match.location || '—'}</span>
        ),
      },
      competition_name: {
        field: 'competition_name',
        header: t('matches.competitionName'),
        className: 'hidden md:table-cell',
        cell: (match) => (
          <span className="text-xs text-muted-foreground">{match.competition_name || '—'}</span>
        ),
      },
      created_at: {
        field: 'created_at',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (match) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(match.created_at) || '—'}
          </span>
        ),
      },
      updated_at: {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (match) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(match.updated_at) || '—'}
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
        .filter((col): col is SortableListTableColumn<Match, MatchTableColumnField> =>
          Boolean(col),
        ),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={matches}
      columns={columns}
      getRowId={(match) => String(match.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === 'matchup') {
          return;
        }
        onSort(field);
      }}
      onRowClick={onRowClick}
      rowAriaLabel={(_match) => t('matches.openMatch')}
      rowClassName={(match) =>
        recentlyDuplicatedMatchId === String(match.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(match) => activeMatchId != null && String(match.id) === String(activeMatchId)}
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
      pluginName="matches"
      dataListItem={(match) => match}
    />
  );
}
