import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  ListPlus,
  Menu,
  Moon,
  PauseCircle,
  Plus,
  Settings,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import type { Match } from '@/plugins/matches/types/match';

import type { TeamPayload } from '../api/teamsApi';
import { useTeams } from '../hooks/useTeams';
import type { Team } from '../types/teams';
import { isTeamOnBreak, TEAM_GENDERS, type TeamGender } from '../types/teams';
import { TEAMS_SETTINGS_KEY } from '../utils/teamColumnCount';
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
import { resolveVisibleTeamTableColumns, type TeamTableColumnId } from '../utils/teamTableColumns';

import { TeamForm } from './TeamForm';
import { TeamListTable } from './TeamListTable';
import { TeamsBulkCreateView } from './TeamsBulkCreateView';
import { TeamsSettingsView } from './TeamsSettingsView';
import { TeamsStatisticsView } from './TeamsStatisticsView';
import { TeamView } from './TeamView';

type SortField = TeamSortField;
type SortOrder = TeamSortOrder;
type GenderFilter = 'all' | TeamGender;

const TEAMS_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.teams.toolbar.collapsed';
const TEAMS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.teams.toolbar.filtersVisible';

function readTeamsToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(TEAMS_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeTeamsToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(TEAMS_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'name', labelKey: 'teams.table.name' },
  { value: 'age_group', labelKey: 'teams.table.age' },
  { value: 'gender', labelKey: 'teams.table.gender' },
  { value: 'status', labelKey: 'teams.table.status' },
  { value: 'player_count', labelKey: 'teams.table.players' },
  { value: 'updated_at', labelKey: 'teams.table.updated' },
  { value: 'created_at', labelKey: 'common.created' },
];

let pendingQuickContextTeamId: string | null = null;

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
    selectedTeamIds,
    mergeIntoTeamSelection,
    selectAllTeams,
    clearTeamSelection,
    isSelected,
    toggleTeamSelected,
    deleteTeams,
    selectedCount,
    recentlyDuplicatedTeamId,
    isTeamPanelOpen,
    panelMode,
    currentTeam,
    saveTeam,
    closeTeamPanel,
    validationErrors,
  } = useTeams();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openTeamPanel(null)),
    onSettings: openTeamSettings,
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
  const enabledPlugins = useEnabledPlugins();
  const hasMatchesPlugin = enabledPlugins.has('matches');
  const { matches } = useMatches();
  const { searchTerm: search, setSearchTerm: setSearch } = usePersistedListSearch('teams');

  useRegisterMobileSearch({
    value: search,
    onChange: setSearch,
    placeholder: t('teams.searchPlaceholder', { count: teams.length }),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [activeFilters, setActiveFilters] = useState<TeamListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [visibleColumnIds, setVisibleColumnIds] = useState<TeamTableColumnId[]>(() =>
    resolveVisibleTeamTableColumns(null),
  );
  const [previewTeam, setPreviewTeam] = useState<Team | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readTeamsToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    TEAMS_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingTeamRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isTeamPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isTeamPanelOpen && panelMode === 'view' && currentTeam != null;
  const detailTeam = inlinePanelView ? currentTeam : previewTeam;
  const activeListTeamId =
    (inlineForm || inlinePanelView) && currentTeam != null
      ? currentTeam.id
      : (previewTeam?.id ?? null);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeTeamsToolbarCollapsed(next);
      return next;
    });
  }, []);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingTeamRef.current || !pendingQuickContextTeamId) {
      return;
    }
    const restored = teams.find((team) => String(team.id) === pendingQuickContextTeamId);
    if (restored) {
      setPreviewTeam(restored);
      restoredPendingTeamRef.current = true;
      pendingQuickContextTeamId = null;
    }
  }, [teams]);

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleTeamTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewTeam) {
      return;
    }
    const next = teams.find((team) => String(team.id) === String(previewTeam.id));
    if (!next) {
      setPreviewTeam(null);
      return;
    }
    if (next !== previewTeam) {
      setPreviewTeam(next);
    }
  }, [teams, previewTeam]);

  useEffect(() => {
    if (!showDesktopSplit || !isTeamPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentTeam) {
      setPreviewTeam(currentTeam);
    }
  }, [showDesktopSplit, isTeamPanelOpen, panelMode, currentTeam]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isTeamAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isTeamAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

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

  const visibleIds = useMemo(
    () => filteredAndSorted.map((team) => String(team.id)),
    [filteredAndSorted],
  );

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

  const handleOpenForView = (team: Team) => {
    pendingQuickContextTeamId = String(team.id);
    attemptNavigation(() => openTeamForView(team));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearTeamSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (team: Team) => {
    if (isCompactViewport) {
      handleOpenForView(team);
      return;
    }
    if (selectionMode) {
      toggleTeamSelected(String(team.id));
      return;
    }
    if (
      isTeamPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeTeamPanel();
        setPreviewTeam(team);
      });
      return;
    }
    setPreviewTeam((current) => (current && String(current.id) === String(team.id) ? null : team));
  };

  const handleBulkDelete = async () => {
    if (selectedTeamIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteTeams(selectedTeamIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeTeamPanel();
  }, [closeTeamPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: TeamPayload) => {
      const ok = await saveTeam(data, currentTeam?.id);
      return ok;
    },
    [currentTeam?.id, saveTeam],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => (
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
              <span className="tabular-nums font-semibold">({genderCounts[gender] ?? 0})</span>
            </span>
          </Button>
        );
      })}
    </div>
  );

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('teams.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('teams.sort', { defaultValue: 'Sort' })}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc'
            ? t('teams.sortAsc', { defaultValue: 'Ascending' })
            : t('teams.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('teams.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('teams.sortDesc', { defaultValue: 'Descending' })}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (filteredAndSorted.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

  if (teamsContentView === 'settings') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <TeamsSettingsView onClose={closeTeamSettingsView} />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'statistics') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <TeamsStatisticsView onClose={closeTeamStatisticsView} />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'bulk') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <TeamsBulkCreateView onClose={closeTeamBulkCreate} />
        </div>
      </div>
    );
  }

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={
                  toolbarCollapsed
                    ? t('teams.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('teams.collapseToolbar', { defaultValue: 'Hide toolbar' })
                }
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="teams-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-teams flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="teams-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
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
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={search}
                      onChange={setSearch}
                      placeholder={t('teams.searchPlaceholder', { count: teams.length })}
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
                      onClick={() => attemptNavigation(() => openTeamPanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel={selectedCount === 1 ? t('teams.itemSingular') : t('teams.itemPlural')}
            isLoading={deleting}
          />

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
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
                ) : (
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
                    activeTeamId={activeListTeamId}
                    selectionEnabled={selectionMode}
                    visibleColumnIds={visibleColumnIds}
                  />
                )}

                <ListFooterBar
                  meta={t('teams.showingCount', {
                    shown: filteredAndSorted.length,
                    total: teams.length,
                  })}
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('teams.quickContext.title')}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <TeamForm
                      ref={inlineFormRef}
                      currentTeam={currentTeam}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeTeamPanel}
                      stacked
                    />
                  </div>
                ) : detailTeam ? (
                  <TeamView
                    team={detailTeam}
                    stacked
                    nextMatch={nextMatchByTeamId.get(String(detailTeam.id)) ?? null}
                  />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <TeamsStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
