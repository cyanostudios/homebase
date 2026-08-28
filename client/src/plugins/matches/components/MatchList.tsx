import {
  BarChart2,
  Calendar,
  CalendarDays,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Home,
  LayoutGrid,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
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
  matchMatchesListFilter,
  matchMatchesListFilters,
  toggleMatchListFilter,
  withoutHomeTeamFilter,
  type MatchListFilter,
  type MatchListFilterSelection,
} from '../utils/matchListFilter';
import {
  compareMatchesByField,
  isMatchAscDefaultField,
  type MatchSortField,
  type MatchSortOrder,
} from '../utils/matchListSort';
import {
  getInitialMatchListViewMode,
  persistMatchListViewModeSession,
  resolveMatchListViewMode,
  type MatchListViewMode,
} from '../utils/matchListViewMode';

import { MatchesStatisticsView } from './MatchesStatisticsView';
import { MatchListItem } from './MatchListItem';
import { MatchListTable } from './MatchListTable';
import { MatchQuickContextPanel } from './MatchQuickContextPanel';
import { MatchSettingsView, type MatchSettingsCategory } from './MatchSettingsView';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

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
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('matches.searchPlaceholder', { count: matches.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('start_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<MatchColumnCount>(getInitialMatchColumnCount);
  const [listViewMode, setListViewModeState] = useState<MatchListViewMode>(
    getInitialMatchListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<MatchListFilterSelection>([]);
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [settingsCategory, setSettingsCategory] = useState<MatchSettingsCategory>('api');

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveMatchColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as MatchColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(MATCHES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
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
    (_count: MatchColumnCount) => {
      const next = 3 as MatchColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistMatchListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(MATCHES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
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
    setSortOrder(isMatchAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isMatchAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
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

  const visibleMatchIds = useMemo(
    () => filteredAndSorted.map((m) => String(m.id)),
    [filteredAndSorted],
  );

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

  const quickContextOpen = Boolean(showQuickContext && previewMatch);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (match: Match) => {
    markPendingAndOpen(match, () => attemptNavigation(() => openMatchForView(match)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearMatchSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (match: Match) => {
    if (selectionMode) {
      toggleMatchSelected(String(match.id));
      return;
    }
    activateRow(match, (item) => attemptNavigation(() => openMatchForView(item)));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t]);

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
    <div className={cn('plugin-matches', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.matches')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('matches.settings')}
                    variant="soft"
                    onClick={() => openMatchSettings()}
                  />
                  <ExpandableIconButton
                    icon={BarChart2}
                    label={t('common.statistics')}
                    variant="soft"
                    onClick={() => openMatchStatistics()}
                  />
                  {filteredAndSorted.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('matches.searchPlaceholder', { count: matches.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`matches.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('matches.addMatch')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openMatchPanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                {t('matches.filterAll')}{' '}
                <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('upcoming')}
              className={cn(
                isFilterActive('upcoming') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {t('matches.filterUpcoming')}{' '}
                <span className="tabular-nums font-semibold">({stats.upcoming})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('upcoming7')}
              className={cn(
                isFilterActive('upcoming7')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {t('matches.filterUpcoming7')}{' '}
                <span className="tabular-nums font-semibold">({stats.upcoming7})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('upcoming14')}
              className={cn(
                isFilterActive('upcoming14')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {t('matches.filterUpcoming14')}{' '}
                <span className="tabular-nums font-semibold">({stats.upcoming14})</span>
              </span>
            </Button>
            {showHomeTeamFilter ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleFilter('homeTeam')}
                className={cn(
                  isFilterActive('homeTeam')
                    ? LIST_FILTER_CHIP_ACTIVE_CLASS
                    : LIST_FILTER_CHIP_CLASS,
                )}
              >
                <Home className="h-3.5 w-3.5" />
                <span>
                  {defaultHomeTeam}{' '}
                  <span className="tabular-nums font-semibold">({stats.homeTeam})</span>
                </span>
              </Button>
            ) : null}
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
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
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="matches"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewMatch ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewMatch ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
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
            <div className="flex min-w-0 flex-col gap-3">
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
                  selectionEnabled={selectionMode}
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
                        active={
                          previewMatch !== null && String(previewMatch.id) === String(match.id)
                        }
                        onClick={() => handleRowActivate(match)}
                        checkbox={
                          selectionMode ? (
                            <input
                              type="checkbox"
                              checked={matchIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(match.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              aria-label={matchIsSelected ? 'Unselect match' : 'Select match'}
                            />
                          ) : undefined
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
    </div>
  );
}
