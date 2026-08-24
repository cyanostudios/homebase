import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  BarChart2,
  LayoutGrid,
  ListPlus,
  Plus,
  Settings,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import type { Match } from '@/plugins/matches/types/match';

import { useTeams } from '../hooks/useTeams';
import type { Team } from '../types/teams';
import { isTeamOnBreak, TEAM_GENDERS, type TeamGender } from '../types/teams';
import {
  getInitialTeamColumnCount,
  resolveTeamColumnCount,
  TEAMS_COLUMN_COUNT_STORAGE_KEY,
  TEAMS_SETTINGS_KEY,
  type TeamColumnCount,
} from '../utils/teamColumnCount';
import {
  teamMatchesListFilters,
  toggleTeamListFilter,
  type TeamListFilter,
  type TeamListFilterSelection,
} from '../utils/teamListFilter';
import {
  compareTeamsByField,
  isTeamAscDefaultField,
  type TeamSortField,
  type TeamSortOrder,
} from '../utils/teamListSort';
import {
  getInitialTeamListViewMode,
  persistTeamListViewModeSession,
  resolveTeamListViewMode,
  type TeamListViewMode,
} from '../utils/teamListViewMode';

import { TeamCard } from './TeamCard';
import { TeamListTable } from './TeamListTable';
import { TeamQuickContextPanel } from './TeamQuickContextPanel';
import { TeamsBulkCreateView } from './TeamsBulkCreateView';
import { TeamsSettingsView } from './TeamsSettingsView';
import { TeamsStatisticsView } from './TeamsStatisticsView';

type SortField = TeamSortField;
type SortOrder = TeamSortOrder;
type GenderFilter = 'all' | TeamGender;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'age_group', label: 'Age group' },
  { value: 'name', label: 'Name' },
  { value: 'gender', label: 'Gender' },
  { value: 'status', label: 'Status' },
  { value: 'player_count', label: 'Players' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
];

export function TeamList() {
  const { t } = useTranslation();
  const {
    teams,
    teamsContentView,
    openTeamPanel,
    openTeamSettings,
    closeTeamSettingsView,
    openTeamStatistics,
    closeTeamStatisticsView,
    openTeamBulkCreate,
    closeTeamBulkCreate,
    openTeamForView,
    openTeamForEdit,
    selectedTeamIds,
    mergeIntoTeamSelection,
    selectAllTeams,
    clearTeamSelection,
    isSelected,
    toggleTeamSelected,
    deleteTeams,
    selectedCount,
    recentlyDuplicatedTeamId,
  } = useTeams();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openTeamPanel(null)),
    onSettings: openTeamSettings,
  });

  const enabledPlugins = useEnabledPlugins();
  const hasMatchesPlugin = enabledPlugins.has('matches');
  const { matches } = useMatches();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [activeFilters, setActiveFilters] = useState<TeamListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [primarySort, setPrimarySort] = useState<SortField>('age_group');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<TeamColumnCount>(getInitialTeamColumnCount);
  const [listViewMode, setListViewModeState] = useState<TeamListViewMode>(
    getInitialTeamListViewMode,
  );

  const {
    previewItem: previewTeam,
    setPreviewItem: setPreviewTeam,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'teams',
    items: teams,
    getItemId: (team) => String(team.id),
  });

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then(
        (settings: { activeSeason?: string; columnCount?: unknown; listViewMode?: unknown }) => {
          if (cancelled) {
            return;
          }
          setActiveSeason(String(settings?.activeSeason || new Date().getFullYear()));
          const next = resolveTeamColumnCount(settings);
          setColumnCountState(next);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(next));
          }
          const nextView = resolveTeamListViewMode(settings);
          setListViewModeState(nextView);
          persistTeamListViewModeSession(nextView);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setActiveSeason(String(new Date().getFullYear()));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: TeamColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistTeamListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(TEAMS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: TeamListViewMode) => {
      setListViewModeState(mode);
      persistTeamListViewModeSession(mode);
      updateSettings(TEAMS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isTeamAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isTeamAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = teams.filter((team) => {
      if (genderFilter !== 'all' && team.gender !== genderFilter) {
        return false;
      }
      if (!teamMatchesListFilters(team, activeFilters)) {
        return false;
      }
      if (!q) {
        return true;
      }
      const genderLabel = team.gender ? t(`teams.gender.${team.gender}`) : '';
      return [team.name, team.age_group, genderLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    return [...filtered].sort((a, b) => compareTeamsByField(a, b, primarySort, sortOrder));
  }, [teams, search, genderFilter, activeFilters, t, primarySort, sortOrder]);

  const handleOpenForView = (team: Team) => {
    markPendingAndOpen(team, () => attemptNavigation(() => openTeamForView(team)));
  };

  const handleRowActivate = (team: Team) => {
    activateRow(team, (item) => attemptNavigation(() => openTeamForView(item)));
  };

  const isFilterActive = (filter: TeamListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: TeamListFilter) => {
    setActiveFilters((prev) => toggleTeamListFilter(prev, filter));
  };

  const stats = useMemo(() => {
    let active = 0;
    let breakCount = 0;
    let dormant = 0;
    for (const team of teams) {
      if (isTeamOnBreak(team)) {
        breakCount += 1;
      } else if (team.status === 'dormant') {
        dormant += 1;
      } else if (team.status === 'active') {
        active += 1;
      }
    }
    return { active, break: breakCount, dormant };
  }, [teams]);

  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: teams.length };
    for (const team of teams) {
      if (team.gender) {
        counts[team.gender] = (counts[team.gender] ?? 0) + 1;
      }
    }
    return counts;
  }, [teams]);

  const nextMatchByTeamId = useMemo(() => {
    const map = new Map<string, Match>();
    if (!hasMatchesPlugin) {
      return map;
    }
    const now = Date.now();
    for (const match of matches) {
      if (!match.team_id || match.is_canceled) {
        continue;
      }
      const start = new Date(match.start_time).getTime();
      if (Number.isNaN(start) || start < now) {
        continue;
      }
      const teamId = String(match.team_id);
      const existing = map.get(teamId);
      if (!existing || match.start_time.localeCompare(existing.start_time) < 0) {
        map.set(teamId, match);
      }
    }
    return map;
  }, [hasMatchesPlugin, matches]);

  const visibleIds = useMemo(() => filteredAndSorted.map((team) => team.id), [filteredAndSorted]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoTeamSelection,
      toggleOne: toggleTeamSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearTeamSelection();
    } else {
      selectAllTeams(visibleIds);
    }
  };

  if (teamsContentView === 'settings') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsSettingsView onClose={closeTeamSettingsView} />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'statistics') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsStatisticsView onClose={closeTeamStatisticsView} />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'bulk') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsBulkCreateView onClose={closeTeamBulkCreate} />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-teams min-h-full overflow-x-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.teams')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('teams.listDescription', { count: teams.length, season: activeSeason })}
            </p>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center justify-end gap-2 md:w-auto md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={openTeamSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={BarChart2}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={openTeamStatistics}
              title={t('common.statistics')}
            >
              {t('common.statistics')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={ListPlus}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={openTeamBulkCreate}
              title={t('teams.bulkCreate')}
            >
              {t('teams.bulkCreate')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openTeamPanel(null))}
            >
              {t('teams.addTeam')}
            </Button>
          </div>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-3')}>
          <ListFilterStatCard
            label={t('teams.status.active')}
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={isFilterActive('active')}
            onClick={() => toggleFilter('active')}
          />
          <ListFilterStatCard
            label={t('teams.status.break')}
            value={stats.break}
            dotClassName="bg-orange-500"
            active={isFilterActive('break')}
            onClick={() => toggleFilter('break')}
          />
          <ListFilterStatCard
            label={t('teams.status.dormant')}
            value={stats.dormant}
            dotClassName="bg-amber-500"
            active={isFilterActive('dormant')}
            onClick={() => toggleFilter('dormant')}
          />
        </div>

        <div className="-mx-1 flex flex-nowrap items-center gap-1 overflow-x-auto px-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGenderFilter('all')}
            className={cn(
              genderFilter === 'all' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>
              {t('teams.filterAll')}{' '}
              <span className="tabular-nums font-semibold">({genderCounts.all})</span>
            </span>
          </Button>
          {TEAM_GENDERS.map((gender) => {
            const isActive = genderFilter === gender;
            return (
              <Button
                key={gender}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGenderFilter(isActive ? 'all' : gender)}
                className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                <Users className="h-3.5 w-3.5" />
                <span>
                  {t(`teams.gender.${gender}`)}{' '}
                  <span className="tabular-nums font-semibold">({genderCounts[gender] ?? 0})</span>
                </span>
              </Button>
            );
          })}
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            await deleteTeams(selectedTeamIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? t('teams.itemSingular') : t('teams.itemPlural')}
        />

        <div className="flex items-start gap-4">
          {showQuickContext && previewTeam ? (
            <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
              <TeamQuickContextPanel
                team={previewTeam}
                nextMatch={nextMatchByTeamId.get(String(previewTeam.id)) ?? null}
                onClose={() => setPreviewTeam(null)}
                onOpenFullProfile={() => handleOpenForView(previewTeam)}
                onEdit={() => {
                  markPendingAndOpen(previewTeam, () =>
                    attemptNavigation(() => openTeamForEdit(previewTeam)),
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
                  value={search}
                  onChange={setSearch}
                  placeholder={t('teams.searchPlaceholder', { count: teams.length })}
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
                    columnAriaLabel={(count) => t(`teams.columns${count}`)}
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
                    onClick={clearTeamSelection}
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
                message={teams.length === 0 ? t('teams.noYet') : t('teams.noMatch')}
                createLabel={teams.length === 0 ? t('teams.addTeam') : undefined}
                onCreate={
                  teams.length === 0
                    ? () => attemptNavigation(() => openTeamPanel(null))
                    : undefined
                }
              />
            ) : isTableView ? (
              <TeamListTable
                teams={filteredAndSorted}
                primarySort={primarySort}
                sortOrder={sortOrder}
                onSort={handleTableSort}
                isSelected={isSelected}
                onRowClick={handleRowActivate}
                onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                onCheckboxChange={onVisibleRowCheckboxChange}
                allVisibleSelected={allVisibleSelected}
                onHeaderCheckboxChange={handleHeaderCheckboxChange}
                recentlyDuplicatedTeamId={recentlyDuplicatedTeamId}
                activeTeamId={previewTeam?.id ?? null}
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
                {filteredAndSorted.map((team, index) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    selected={isSelected(team.id)}
                    highlighted={recentlyDuplicatedTeamId === String(team.id)}
                    active={
                      previewTeam !== null &&
                      previewTeam !== undefined &&
                      String(previewTeam.id) === String(team.id)
                    }
                    onClick={() => handleRowActivate(team)}
                    columnCount={effectiveCardColumnCount}
                    nextMatch={nextMatchByTeamId.get(String(team.id)) ?? null}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={isSelected(team.id)}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(team.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 flex-shrink-0 cursor-pointer"
                      />
                    }
                  />
                ))}
              </div>
            )}

            <ListFooterBar
              meta={t('teams.showingCount', {
                shown: filteredAndSorted.length,
                total: teams.length,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
