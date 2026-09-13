import {
  BarChart2,
  Calendar,
  CalendarDays,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Home,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  Trash2,
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
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useMatchContext } from '../context/MatchContext';
import { useMatches } from '../hooks/useMatches';
import { type Match } from '../types/match';
import { MATCHES_SETTINGS_KEY } from '../utils/matchColumnCount';
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
  resolveVisibleMatchTableColumns,
  type MatchTableColumnId,
} from '../utils/matchTableColumns';

import { MatchForm } from './MatchForm';
import { MatchListTable } from './MatchListTable';
import { MatchSettingsView, type MatchSettingsCategory } from './MatchSettingsView';
import { MatchesStatisticsView } from './MatchesStatisticsView';
import { MatchView } from './MatchView';

type SortField = MatchSortField;
type SortOrder = MatchSortOrder;

const MATCHES_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.matches.toolbar.collapsed';
const MATCHES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.matches.toolbar.filtersVisible';

function readMatchesToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(MATCHES_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMatchesToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(MATCHES_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'start_time', labelKey: 'matches.timeLabel' },
  { value: 'home_team', labelKey: 'matches.homeTeamLabel' },
  { value: 'away_team', labelKey: 'matches.awayTeamLabel' },
  { value: 'team_id', labelKey: 'matches.team' },
  { value: 'location', labelKey: 'matches.locationLabel' },
  { value: 'competition_name', labelKey: 'matches.competitionName' },
  { value: 'updated_at', labelKey: 'matches.updated' },
  { value: 'created_at', labelKey: 'matches.created' },
];

let pendingQuickContextMatchId: string | null = null;

export function MatchList() {
  const { t } = useTranslation();
  const {
    matches,
    matchesContentView,
    openMatchPanel,
    openMatchForView,
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
    isMatchPanelOpen,
    panelMode,
    currentMatch,
    saveMatch,
    closeMatchPanel,
    validationErrors,
  } = useMatches();
  const { teams } = useTeams();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openMatchPanel(null)),
    onSettings: () => openMatchSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = useMatchContext();
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
  const [activeFilters, setActiveFilters] = useState<MatchListFilterSelection>([]);
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [settingsCategory, setSettingsCategory] = useState<MatchSettingsCategory>('columns');
  const [visibleColumnIds, setVisibleColumnIds] = useState<MatchTableColumnId[]>(() =>
    resolveVisibleMatchTableColumns(null),
  );
  const [previewMatch, setPreviewMatch] = useState<Match | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readMatchesToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    MATCHES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingMatchRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isMatchPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isMatchPanelOpen && panelMode === 'view' && currentMatch != null;
  const detailMatch = inlinePanelView ? currentMatch : previewMatch;
  const activeListMatchId =
    (inlineForm || inlinePanelView) && currentMatch != null
      ? currentMatch.id
      : (previewMatch?.id ?? null);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeMatchesToolbarCollapsed(next);
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
    if (restoredPendingMatchRef.current || !pendingQuickContextMatchId) {
      return;
    }
    const restored = matches.find((match) => String(match.id) === pendingQuickContextMatchId);
    if (restored) {
      setPreviewMatch(restored);
      restoredPendingMatchRef.current = true;
      pendingQuickContextMatchId = null;
    }
  }, [matches]);

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const nextDefaultHomeTeam = resolveMatchDefaultHomeTeam(settings);
        setDefaultHomeTeam(nextDefaultHomeTeam);
        if (!nextDefaultHomeTeam) {
          setActiveFilters((prev) => withoutHomeTeamFilter(prev));
        }
        setVisibleColumnIds(resolveVisibleMatchTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewMatch) {
      return;
    }
    const next = matches.find((match) => String(match.id) === String(previewMatch.id));
    if (!next) {
      setPreviewMatch(null);
      return;
    }
    if (next !== previewMatch) {
      setPreviewMatch(next);
    }
  }, [matches, previewMatch]);

  useEffect(() => {
    if (!showDesktopSplit || !isMatchPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentMatch) {
      setPreviewMatch(currentMatch);
    }
  }, [showDesktopSplit, isMatchPanelOpen, panelMode, currentMatch]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isMatchAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isMatchAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

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

  const handleOpenForView = (match: Match) => {
    pendingQuickContextMatchId = String(match.id);
    attemptNavigation(() => openMatchForView(match));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearMatchSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (match: Match) => {
    if (isCompactViewport) {
      handleOpenForView(match);
      return;
    }
    if (selectionMode) {
      toggleMatchSelected(String(match.id));
      return;
    }
    if (
      isMatchPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeMatchPanel();
        setPreviewMatch(match);
      });
      return;
    }
    setPreviewMatch((current) =>
      current && String(current.id) === String(match.id) ? null : match,
    );
  };

  const handleBulkDelete = async () => {
    if (selectedMatchIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMatches(selectedMatchIds);
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
    closeMatchPanel();
  }, [closeMatchPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await saveMatch(data, currentMatch?.id);
      return ok;
    },
    [currentMatch?.id, saveMatch],
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
          isFilterActive('upcoming7') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
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
          isFilterActive('upcoming14') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
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
            isFilterActive('homeTeam') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
          )}
        >
          <Home className="h-3.5 w-3.5" />
          <span>
            {defaultHomeTeam} <span className="tabular-nums font-semibold">({stats.homeTeam})</span>
          </span>
        </Button>
      ) : null}
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
          aria-label={t('matches.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('matches.sort', { defaultValue: 'Sort' })}</span>
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
            ? t('matches.sortAsc', { defaultValue: 'Ascending' })
            : t('matches.sortDesc', { defaultValue: 'Descending' })}
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
            {t('matches.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('matches.sortDesc', { defaultValue: 'Descending' })}
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

  if (matchesContentView === 'settings') {
    return (
      <div className="plugin-matches min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
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
        <div className="px-4 py-4 md:px-6">
          <MatchesStatisticsView onClose={closeMatchStatisticsView} />
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
                    ? t('matches.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('matches.collapseToolbar', { defaultValue: 'Hide toolbar' })
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
                aria-controls="matches-mail-toolbar"
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
          'plugin-matches flex min-h-0 flex-1 flex-col',
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
                  id="matches-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
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
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('matches.searchPlaceholder', { count: matches.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('matches.addMatch')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openMatchPanel(null))}
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
            itemLabel="matches"
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
                    message={searchTerm ? t('matches.noMatch') : t('matches.noYet')}
                    createLabel={!searchTerm ? t('matches.addMatch') : undefined}
                    onCreate={
                      !searchTerm ? () => attemptNavigation(() => openMatchPanel(null)) : undefined
                    }
                  />
                ) : (
                  <MatchListTable
                    matches={filteredAndSorted}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    recentlyDuplicatedMatchId={recentlyDuplicatedMatchId}
                    activeMatchId={activeListMatchId}
                    selectionEnabled={selectionMode}
                    visibleColumnIds={visibleColumnIds}
                  />
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('matches.quickContext.title', { defaultValue: 'Quick context' })}
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
                    <MatchForm
                      ref={inlineFormRef}
                      currentMatch={currentMatch}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeMatchPanel}
                      stacked
                    />
                  </div>
                ) : detailMatch ? (
                  <MatchView match={detailMatch} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <MatchesStatisticsView />
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
