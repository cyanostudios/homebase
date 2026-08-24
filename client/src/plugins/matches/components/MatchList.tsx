import {
  BarChart2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useMatches } from '../hooks/useMatches';
import { type Match } from '../types/match';
import {
  getInitialMatchColumnCount,
  resolveMatchColumnCount,
  MATCHES_COLUMN_COUNT_STORAGE_KEY,
  MATCHES_SETTINGS_KEY,
  type MatchColumnCount,
} from '../utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '../utils/matchDefaultHomeTeam';
import {
  compareMatchesByField,
  isMatchStringSortField,
  type MatchSortField,
  type MatchSortOrder,
} from '../utils/matchListSort';
import {
  matchMatchesListFilter,
  matchMatchesListFilters,
  toggleMatchListFilter,
  withoutHomeTeamFilter,
  type MatchListFilter,
  type MatchListFilterSelection,
} from '../utils/matchListFilter';
import {
  getInitialMatchListViewMode,
  persistMatchListViewModeSession,
  resolveMatchListViewMode,
  type MatchListViewMode,
} from '../utils/matchListViewMode';

import { MatchListItem } from './MatchListItem';
import { MatchListTable } from './MatchListTable';
import { MatchQuickContextPanel } from './MatchQuickContextPanel';
import { MatchSettingsView, type MatchSettingsCategory } from './MatchSettingsView';
import { MatchesStatisticsView } from './MatchesStatisticsView';

type SortField = MatchSortField;
type SortOrder = MatchSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'start_time', label: 'Time' },
  { value: 'home_team', label: 'Home team' },
  { value: 'away_team', label: 'Away team' },
  { value: 'team_id', label: 'Team' },
  { value: 'location', label: 'Location' },
  { value: 'competition_name', label: 'Competition' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
];

export function MatchList() {
  const { t } = useTranslation();
  const {
    matches,
    matchesContentView,
    openMatchPanel,
    openMatchForView,
    openMatchForEdit,
    openMatchSettings,
    closeMatchSettingsView,
    openMatchStatistics,
    closeMatchStatisticsView,
    deleteMatches,
    selectedMatchIds,
    toggleMatchSelected,
    mergeIntoMatchSelection,
    selectAllMatches,
    clearMatchSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedMatchId,
  } = useMatches();
  const { teams } = useTeams();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openMatchPanel(null)),
    onSettings: () => openMatchSettings(),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('start_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<MatchColumnCount>(getInitialMatchColumnCount);
  const [listViewMode, setListViewModeState] = useState<MatchListViewMode>(
    getInitialMatchListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<MatchListFilterSelection>([]);
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [settingsCategory, setSettingsCategory] = useState<MatchSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveMatchColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveMatchListViewMode(settings);
        setListViewModeState(nextView);
        persistMatchListViewModeSession(nextView);
        const nextDefaultHomeTeam = resolveMatchDefaultHomeTeam(settings);
        setDefaultHomeTeam(nextDefaultHomeTeam);
        if (!nextDefaultHomeTeam) {
          setActiveFilters((prev) => withoutHomeTeamFilter(prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: MatchColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistMatchListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(MATCHES_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: MatchListViewMode) => {
      setListViewModeState(mode);
      persistMatchListViewModeSession(mode);
      updateSettings(MATCHES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isMatchStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isMatchStringSortField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);
  const showHomeTeamFilter = defaultHomeTeam.length > 0;

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of teams) {
      map.set(String(team.id), formatTeamLabel(team) || team.name || '');
    }
    return map;
  }, [teams]);

  const filteredAndSorted = useMemo(() => {
    const nowMs = Date.now();
    const byFilter = matches.filter((m) =>
      matchMatchesListFilters(m, activeFilters, nowMs, defaultHomeTeam),
    );

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((m) => {
      if (!needle) {
        return true;
      }
      const timeStr = m.start_time ? formatDateTimeShort(m.start_time).toLowerCase() : '';
      return (
        (m.name ?? '').toLowerCase().includes(needle) ||
        (m.home_team ?? '').toLowerCase().includes(needle) ||
        (m.away_team ?? '').toLowerCase().includes(needle) ||
        (m.location ?? '').toLowerCase().includes(needle) ||
        (m.sport_type ?? '').toLowerCase().includes(needle) ||
        (m.competition_name ?? '').toLowerCase().includes(needle) ||
        timeStr.includes(needle)
      );
    });

    return [...filtered].sort((a, b) =>
      compareMatchesByField(a, b, primarySort, sortOrder, teamNameById),
    );
  }, [matches, searchTerm, primarySort, sortOrder, activeFilters, defaultHomeTeam, teamNameById]);

  const visibleMatchIds = useMemo(
    () => filteredAndSorted.map((m) => String(m.id)),
    [filteredAndSorted],
  );

  const stats = useMemo(() => {
    const nowMs = Date.now();
    return {
      total: matches.length,
      upcoming: matches.filter((m) => matchMatchesListFilter(m, 'upcoming', nowMs)).length,
      upcoming7: matches.filter((m) => matchMatchesListFilter(m, 'upcoming7', nowMs)).length,
      upcoming14: matches.filter((m) => matchMatchesListFilter(m, 'upcoming14', nowMs)).length,
      homeTeam: showHomeTeamFilter
        ? matches.filter((m) => matchMatchesListFilter(m, 'homeTeam', nowMs, defaultHomeTeam))
            .length
        : 0,
    };
  }, [matches, defaultHomeTeam, showHomeTeamFilter]);

  const isFilterActive = (filter: MatchListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: MatchListFilter) => {
    setActiveFilters((prev) => toggleMatchListFilter(prev, filter));
  };

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleMatchIds,
      mergeIntoSelection: mergeIntoMatchSelection,
      toggleOne: toggleMatchSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleMatchIds.length > 0 && visibleMatchIds.every((id) => isSelected(id)),
    [visibleMatchIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearMatchSelection();
    } else {
      const union = Array.from(new Set([...selectedMatchIds, ...visibleMatchIds]));
      selectAllMatches(union);
    }
  };

  const {
    previewItem: previewMatch,
    setPreviewItem: setPreviewMatch,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'matches',
    items: matches,
    getItemId: (match) => String(match.id),
  });

  const handleOpenForView = (match: Match) => {
    markPendingAndOpen(match, () => attemptNavigation(() => openMatchForView(match)));
  };

  const handleRowActivate = (match: Match) => {
    activateRow(match, (item) => attemptNavigation(() => openMatchForView(item)));
  };

  const handleBulkDelete = async () => {
    if (selectedMatchIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMatches(selectedMatchIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (matchesContentView === 'settings') {
    return (
      <div className="plugin-matches min-h-full bg-background">
        <div className="px-6 py-4">
          <MatchSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeMatchSettingsView}
          />
        </div>
      </div>
    );
  }

  if (matchesContentView === 'statistics') {
    return (
      <div className="plugin-matches min-h-full bg-background">
        <div className="px-6 py-4">
          <MatchesStatisticsView onClose={closeMatchStatisticsView} />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-matches min-h-full overflow-x-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.matches')}</h2>
            <p className="text-sm text-muted-foreground">{t('matches.listDescription')}</p>
          </div>
          <div className="flex w-full flex-shrink-0 items-center gap-2 md:w-auto md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={() => openMatchSettings()}
              title={t('matches.settings')}
            >
              {t('matches.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={BarChart2}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={() => openMatchStatistics()}
              title={t('common.statistics')}
            >
              {t('common.statistics')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openMatchPanel(null))}
            >
              {t('matches.addMatch')}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            LIST_FILTER_STAT_ROW_CLASS,
            'md:grid-cols-2 md:gap-2 lg:grid-cols-4',
            showHomeTeamFilter && 'lg:grid-cols-5',
          )}
        >
          <ListFilterStatCard
            label={t('matches.filterAll')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('matches.filterUpcoming')}
            value={stats.upcoming}
            dotClassName="bg-emerald-500"
            active={isFilterActive('upcoming')}
            onClick={() => toggleFilter('upcoming')}
          />
          <ListFilterStatCard
            label={t('matches.filterUpcoming7')}
            value={stats.upcoming7}
            dotClassName="bg-indigo-500"
            active={isFilterActive('upcoming7')}
            onClick={() => toggleFilter('upcoming7')}
          />
          <ListFilterStatCard
            label={t('matches.filterUpcoming14')}
            value={stats.upcoming14}
            dotClassName="bg-amber-500"
            active={isFilterActive('upcoming14')}
            onClick={() => toggleFilter('upcoming14')}
          />
          {showHomeTeamFilter ? (
            <ListFilterStatCard
              label={defaultHomeTeam}
              value={stats.homeTeam}
              dotClassName="bg-rose-500"
              active={isFilterActive('homeTeam')}
              onClick={() => toggleFilter('homeTeam')}
            />
          ) : null}
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="matches"
          isLoading={deleting}
        />

        <div className="flex items-start gap-4">
          {showQuickContext && previewMatch ? (
            <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
              <MatchQuickContextPanel
                match={previewMatch}
                onClose={() => setPreviewMatch(null)}
                onOpenFullProfile={() => handleOpenForView(previewMatch)}
                onEdit={() => {
                  markPendingAndOpen(previewMatch, () =>
                    attemptNavigation(() => openMatchForEdit(previewMatch)),
                  );
                }}
              />
            </aside>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <ListToolbar
              selectedCount={selectedCount}
              showSelectAll={filteredAndSorted.length > 0}
              selectAll={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  icon={CheckSquare}
                  onClick={handleHeaderCheckboxChange}
                >
                  Select all
                </Button>
              }
              search={
                <ListSearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={t('matches.searchPlaceholder', { count: matches.length })}
                />
              }
              trailing={
                <>
                  {!isTableView ? (
                    <div className="mr-1 flex items-center gap-1">
                      <Select
                        value={primarySort}
                        onValueChange={(value) => handlePrimarySortChange(value as SortField)}
                      >
                        <SelectTrigger
                          className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                          aria-label="Sort by"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          position="item-aligned"
                          className="rounded-xl border-border/50 shadow-xl"
                        >
                          {SORT_FIELD_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="rounded-md text-xs"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 px-0 text-xs"
                        onClick={toggleSortOrder}
                        aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        {sortOrder === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : null}
                  <ListColumnLayoutToggle
                    columnCount={columnCount}
                    listViewMode={listViewMode}
                    onSelectColumns={setColumnCount}
                    onSelectTable={() => setListViewMode('table')}
                    columnAriaLabel={(count) => t(`matches.columns${count}`)}
                    tableAriaLabel={t('common.tableView')}
                  />
                </>
              }
              bulkActions={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={clearMatchSelection}
                    type="button"
                  >
                    {t('common.clearSelection')}
                  </Button>
                  <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {t('bulk.selected', { count: selectedCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  >
                    {t('common.delete')}
                  </Button>
                </>
              }
            />

            {filteredAndSorted.length === 0 ? (
              <ListEmptyState
                message={searchTerm ? t('matches.noMatch') : t('matches.noYet')}
                createLabel={!searchTerm ? t('matches.addMatch') : undefined}
                onCreate={
                  !searchTerm ? () => attemptNavigation(() => openMatchPanel(null)) : undefined
                }
              />
            ) : isTableView ? (
              <MatchListTable
                matches={filteredAndSorted}
                primarySort={primarySort}
                sortOrder={sortOrder}
                onSort={handleTableSort}
                isSelected={isSelected}
                onRowClick={handleRowActivate}
                activeMatchId={previewMatch?.id ?? null}
                onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                onCheckboxChange={onVisibleRowCheckboxChange}
                allVisibleSelected={allVisibleSelected}
                onHeaderCheckboxChange={handleHeaderCheckboxChange}
                recentlyDuplicatedMatchId={recentlyDuplicatedMatchId}
              />
            ) : (
              <div
                className={cn(
                  'grid gap-3',
                  effectiveColumnCount === 1 && 'grid-cols-1',
                  effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                  effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
                )}
              >
                {filteredAndSorted.map((match, index) => {
                  const matchIsSelected = isSelected(match.id);
                  return (
                    <MatchListItem
                      key={match.id}
                      match={match}
                      selected={matchIsSelected}
                      highlighted={recentlyDuplicatedMatchId === String(match.id)}
                      columnCount={effectiveCardColumnCount}
                      active={previewMatch !== null && String(previewMatch.id) === String(match.id)}
                      onClick={() => handleRowActivate(match)}
                      checkbox={
                        <input
                          type="checkbox"
                          checked={matchIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(match.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={matchIsSelected ? 'Unselect match' : 'Select match'}
                        />
                      }
                    />
                  );
                })}
              </div>
            )}

            <ListFooterBar
              meta={
                <>
                  Showing {filteredAndSorted.length} of {matches.length} Matches
                </>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
