import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  BarChart2,
  CheckCircle2,
  LayoutGrid,
  ListPlus,
  Moon,
  PauseCircle,
  Plus,
  Settings,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useCompanionPanel } from '@/core/app/CompanionPanelContext';
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
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
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
import { resolveVisibleTeamTableColumns, type TeamTableColumnId } from '../utils/teamTableColumns';

import { TeamCard } from './TeamCard';
import { TeamListTable } from './TeamListTable';
import { TeamQuickContextPanel } from './TeamQuickContextPanel';
import { TeamsBulkCreateView } from './TeamsBulkCreateView';
import { TeamsSettingsView } from './TeamsSettingsView';
import { TeamsStatisticsView } from './TeamsStatisticsView';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

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
  useRegisterMobileSearch({
    value: search,
    onChange: setSearch,
    placeholder: t('teams.searchPlaceholder', { count: teams.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [activeFilters, setActiveFilters] = useState<TeamListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('age_group');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<TeamColumnCount>(getInitialTeamColumnCount);
  const [listViewMode, setListViewModeState] = useState<TeamListViewMode>(
    getInitialTeamListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<TeamTableColumnId[]>(() =>
    resolveVisibleTeamTableColumns(null),
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

  const { companionPlugin } = useCompanionPanel();
  const scheduleCompanionOpen = companionPlugin === 'schedule';

  useEffect(() => {
    if (scheduleCompanionOpen) {
      setPreviewTeam(null);
    }
  }, [scheduleCompanionOpen, setPreviewTeam]);

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveTeamColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as TeamColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(TEAMS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveTeamListViewMode(settings);
        setListViewModeState(nextView);
        persistTeamListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleTeamTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion, updateSettings]);

  const setColumnCount = useCallback(
    (_count: TeamColumnCount) => {
      const next = 3 as TeamColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistTeamListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(TEAMS_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
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
  const quickContextOpen = Boolean(showQuickContext && previewTeam && !scheduleCompanionOpen);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

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

  const handleOpenForView = (team: Team) => {
    markPendingAndOpen(team, () => attemptNavigation(() => openTeamForView(team)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearTeamSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (team: Team) => {
    if (selectionMode) {
      toggleTeamSelected(String(team.id));
      return;
    }
    activateRow(team, (item) => attemptNavigation(() => openTeamForView(item)));
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
    <div className={cn('plugin-teams', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.teams')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={openTeamSettings}
                  />
                  <ExpandableIconButton
                    icon={BarChart2}
                    label={t('common.statistics')}
                    variant="soft"
                    onClick={openTeamStatistics}
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
                value={search}
                onChange={setSearch}
                placeholder={t('teams.searchPlaceholder', { count: teams.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`teams.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={ListPlus}
                label={t('teams.bulkCreate')}
                variant="soft"
                onClick={openTeamBulkCreate}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('teams.addTeam')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openTeamPanel(null))}
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
              onClick={() => toggleFilter('active')}
              className={cn(
                isFilterActive('active') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('teams.status.active')}{' '}
                <span className="tabular-nums font-semibold">({stats.active})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('break')}
              className={cn(
                isFilterActive('break') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <PauseCircle className="h-3.5 w-3.5" />
              <span>
                {t('teams.status.break')}{' '}
                <span className="tabular-nums font-semibold">({stats.break})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('dormant')}
              className={cn(
                isFilterActive('dormant') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>
                {t('teams.status.dormant')}{' '}
                <span className="tabular-nums font-semibold">({stats.dormant})</span>
              </span>
            </Button>
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
                    <span className="tabular-nums font-semibold">
                      ({genderCounts[gender] ?? 0})
                    </span>
                  </span>
                </Button>
              );
            })}
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
          onConfirm={async () => {
            await deleteTeams(selectedTeamIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? t('teams.itemSingular') : t('teams.itemPlural')}
        />

        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewTeam && !scheduleCompanionOpen
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewTeam && !scheduleCompanionOpen ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
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
            <div className="flex min-w-0 flex-col gap-3">
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
                  selectionEnabled={selectionMode}
                  visibleColumnIds={visibleColumnIds}
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
                        selectionMode ? (
                          <input
                            type="checkbox"
                            checked={isSelected(team.id)}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(team.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 flex-shrink-0 cursor-pointer"
                          />
                        ) : undefined
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
    </div>
  );
}
