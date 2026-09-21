import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Circle,
  Inbox,
  LayoutGrid,
  Link2Off,
  Menu,
  Plus,
  Settings,
  SlidersHorizontal,
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
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useRegisterBrowseOrder } from '@/core/hooks/useRegisterBrowseOrder';
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
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useRequests } from '../hooks/useRequests';
import { useRequestTeams } from '../hooks/useRequestTeams';
import { getTypeLabel, isRequestUnopened } from '../types/requests';
import type { Request } from '../types/requests';
import {
  REQUEST_LIST_FILTER_INITIAL,
  requestMatchesListFilters,
  toggleRequestListFilter,
  type RequestListFilter,
  type RequestListFilterSelection,
} from '../utils/requestListFilter';
import {
  compareRequestsByField,
  isRequestAscDefaultField,
  type RequestSortField,
  type RequestSortOrder,
} from '../utils/requestListSort';
import {
  resolveVisibleRequestTableColumns,
  type RequestTableColumnId,
} from '../utils/requestTableColumns';

import { RequestBulkStatusDialog } from './RequestBulkStatusDialog';
import { RequestForm } from './RequestForm';
import { RequestListTable } from './RequestListTable';
import { RequestsSettingsView, type RequestsSettingsCategory } from './RequestsSettingsView';
import { RequestsStatisticsView } from './RequestsStatisticsView';
import { RequestView } from './RequestView';

type TypeFilter = 'all' | string;
type TeamFilter = 'all' | 'unlinked';
type SortField = RequestSortField;
type SortOrder = RequestSortOrder;

const REQUESTS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.requests.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'updated_at', labelKey: 'common.updated' },
  { value: 'responseDueAt', labelKey: 'requests.responseDue.label' },
  { value: 'created_at', labelKey: 'requests.view.created' },
  { value: 'title', labelKey: 'requests.form.title' },
  { value: 'status', labelKey: 'requests.form.status' },
  { value: 'priority', labelKey: 'requests.form.priority' },
  { value: 'type', labelKey: 'requests.form.requestType' },
];

let pendingQuickContextRequestId: string | null = null;

export function RequestList() {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const teams = useRequestTeams();
  const {
    requests,
    requestTypes,
    requestsContentView,
    openRequestPanel,
    openRequestForView,
    openRequestSettings,
    closeRequestSettingsView,
    selectedRequestIds,
    mergeIntoRequestSelection,
    clearRequestSelection,
    isSelected,
    toggleRequestSelected,
    deleteRequests,
    selectedCount,
    createRequest,
    saveRequest,
    markRequestViewed,
    setBrowseOrderIds,
    isRequestPanelOpen,
    panelMode,
    currentRequest,
    closeRequestPanel,
    validationErrors,
  } = useRequests();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openRequestPanel(null)),
    onSettings: () => attemptNavigation(() => openRequestSettings()),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm: search, setSearchTerm: setSearch } = usePersistedListSearch('requests');
  useRegisterMobileSearch({
    value: search,
    onChange: setSearch,
    placeholder: t('requests.searchPlaceholder', { count: requests.length }),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [activeFilters, setActiveFilters] = useState<RequestListFilterSelection>(
    REQUEST_LIST_FILTER_INITIAL,
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<RequestTableColumnId[]>(() =>
    resolveVisibleRequestTableColumns(null),
  );
  const [settingsCategory, setSettingsCategory] = useState<RequestsSettingsCategory>('types');
  const [primarySort, setPrimarySort] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [previewRequest, setPreviewRequest] = useState<Request | null>(null);
  const [recentlyQuickAddedId, setRecentlyQuickAddedId] = useState<string | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    REQUESTS_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingRequestRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isRequestPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isRequestPanelOpen && panelMode === 'view' && currentRequest != null;
  const detailRequest = inlinePanelView ? currentRequest : previewRequest;
  const activeListRequestId =
    (inlineForm || inlinePanelView) && currentRequest != null
      ? currentRequest.id
      : (previewRequest?.id ?? null);

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
    if (restoredPendingRequestRef.current || !pendingQuickContextRequestId) {
      return;
    }
    const restored = requests.find(
      (request) => String(request.id) === pendingQuickContextRequestId,
    );
    if (restored) {
      setPreviewRequest(restored);
      restoredPendingRequestRef.current = true;
      pendingQuickContextRequestId = null;
    }
  }, [requests]);

  useEffect(() => {
    let cancelled = false;
    getSettings('requests')
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleRequestTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewRequest) {
      return;
    }
    const next = requests.find((request) => String(request.id) === String(previewRequest.id));
    if (!next) {
      setPreviewRequest(null);
      return;
    }
    if (next !== previewRequest) {
      setPreviewRequest(next);
    }
  }, [requests, previewRequest]);

  useEffect(() => {
    if (!showDesktopSplit || !isRequestPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentRequest) {
      setPreviewRequest(currentRequest);
    }
  }, [showDesktopSplit, isRequestPanelOpen, panelMode, currentRequest]);

  useEffect(() => {
    if (previewRequest) {
      void markRequestViewed(previewRequest.id);
    }
  }, [markRequestViewed, previewRequest]);

  const teamById = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(Number(team.id), formatTeamLabel(team) || team.name);
    }
    return map;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (!requestMatchesListFilters(req, activeFilters)) {
        return false;
      }
      if (typeFilter !== 'all' && req.requestType !== typeFilter) {
        return false;
      }
      if (teamFilter === 'unlinked' && req.teamId != null) {
        return false;
      }
      if (!q) {
        return true;
      }
      const teamName = req.teamId ? teamById.get(req.teamId) || '' : '';
      return [req.title, req.description, req.submitterName, teamName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [requests, search, activeFilters, typeFilter, teamFilter, teamById]);

  const isFilterActive = (filter: RequestListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: RequestListFilter) => {
    setActiveFilters((prev) => toggleRequestListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      all: requests.length,
      active: requests.filter((r) => r.status === 'not started' || r.status === 'in progress')
        .length,
      unlinked: requests.filter((r) => r.teamId == null).length,
    }),
    [requests],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: requests.length };
    for (const request of requests) {
      if (request.requestType) {
        counts[request.requestType] = (counts[request.requestType] ?? 0) + 1;
      }
    }
    return counts;
  }, [requests]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => compareRequestsByField(a, b, primarySort, sortOrder));
    return list;
  }, [filtered, primarySort, sortOrder]);

  const visibleIds = useMemo(() => sorted.map((r) => r.id), [sorted]);

  useRegisterBrowseOrder(setBrowseOrderIds, visibleIds);

  const selectedRequests = useMemo(
    () => requests.filter((r) => selectedRequestIds.includes(r.id)),
    [requests, selectedRequestIds],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isRequestAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isRequestAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const allVisibleSelected = sorted.length > 0 && sorted.every((request) => isSelected(request.id));

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearRequestSelection();
    } else {
      mergeIntoRequestSelection(sorted.map((r) => r.id));
    }
  };

  const handleOpenForView = (request: Request) => {
    pendingQuickContextRequestId = String(request.id);
    setRecentlyQuickAddedId(null);
    attemptNavigation(() => openRequestForView(request));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearRequestSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (request: Request) => {
    if (isCompactViewport) {
      handleOpenForView(request);
      return;
    }
    if (selectionMode) {
      toggleRequestSelected(String(request.id));
      return;
    }
    setRecentlyQuickAddedId(null);
    if (
      isRequestPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeRequestPanel();
        setPreviewRequest(request);
      });
      return;
    }
    setPreviewRequest((current) =>
      current && String(current.id) === String(request.id) ? null : request,
    );
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeRequestPanel();
  }, [closeRequestPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveRequest>[0]) => {
      const ok = await saveRequest(data);
      return ok;
    },
    [saveRequest],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const request = await createRequest({ title });
      setRecentlyQuickAddedId(String(request.id));
    },
    [createRequest],
  );

  const isRequestHighlighted = useCallback((request: Request) => isRequestUnopened(request), []);

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'status',
        label: t('requests.bulkStatusAction'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkStatusDialog(true),
      },
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
          {t('requests.filterAll')}{' '}
          <span className="tabular-nums font-semibold">({stats.all})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('active')}
        className={cn(
          isFilterActive('active') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <Circle className="h-3.5 w-3.5" />
        <span>
          {t('requests.statActive')}{' '}
          <span className="tabular-nums font-semibold">({stats.active})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setTeamFilter(teamFilter === 'unlinked' ? 'all' : 'unlinked')}
        className={cn(
          teamFilter === 'unlinked' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <Link2Off className="h-3.5 w-3.5" />
        <span>
          {t('requests.statNotRelated')}{' '}
          <span className="tabular-nums font-semibold">({stats.unlinked})</span>
        </span>
      </Button>
      {requestTypes.map((type) => {
        const typeKey = type.key;
        const isActive = typeFilter === typeKey;
        return (
          <Button
            key={typeKey}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTypeFilter(isActive ? 'all' : typeKey)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>
              {getTypeLabel(typeKey, t)}{' '}
              <span className="tabular-nums font-semibold">({typeCounts[typeKey] ?? 0})</span>
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
          aria-label={t('requests.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('requests.sort')}</span>
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
          {sortOrder === 'asc' ? t('requests.sortAsc') : t('requests.sortDesc')}
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
            {t('requests.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('requests.sortDesc')}
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
    if (sorted.length === 0) {
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

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoRequestSelection,
      toggleOne: toggleRequestSelected,
    });

  if (requestsContentView === 'settings') {
    return (
      <div className="plugin-requests min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <RequestsSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            onClose={closeRequestSettingsView}
          />
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
                  toolbarCollapsed ? t('requests.expandToolbar') : t('requests.collapseToolbar')
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
                aria-controls="requests-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailRequest || inlineForm);

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-requests flex min-h-0 flex-1 flex-col',
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
                  id="requests-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.requests')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openRequestSettings())}
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
                    <RoundExpandableQuickAdd
                      icon={Inbox}
                      label={t('requests.quickAdd')}
                      placeholder={t('requests.quickAddPlaceholder')}
                      onCreate={handleQuickCreate}
                      defaultExpanded
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                    />
                    <RoundExpandableSearch
                      value={search}
                      onChange={setSearch}
                      placeholder={t('requests.searchPlaceholder', { count: requests.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('requests.addRequest')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openRequestPanel(null))}
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
            onConfirm={async () => {
              await deleteRequests(selectedRequestIds);
              setShowBulkDeleteModal(false);
            }}
            itemCount={selectedCount}
            itemLabel={selectedCount === 1 ? t('requests.itemSingular') : t('requests.itemPlural')}
          />
          <RequestBulkStatusDialog
            isOpen={showBulkStatusDialog}
            onClose={() => setShowBulkStatusDialog(false)}
            selectedRequests={selectedRequests}
            saveRequest={saveRequest}
            onSuccess={clearRequestSelection}
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
                {sorted.length === 0 ? (
                  <ListEmptyState
                    message={
                      requests.length === 0 ? t('requests.noYet') : t('requests.noMatchTitle')
                    }
                    createLabel={requests.length === 0 ? t('requests.addRequest') : undefined}
                    onCreate={
                      requests.length === 0
                        ? () => attemptNavigation(() => openRequestPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <RequestListTable
                    requests={sorted}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    recentlyQuickAddedId={recentlyQuickAddedId}
                    isRequestHighlighted={isRequestHighlighted}
                    selectionEnabled={selectionMode}
                    activeRequestId={activeListRequestId}
                    visibleColumnIds={visibleColumnIds}
                  />
                )}

                <ListFooterBar
                  meta={t('requests.showingCount', {
                    shown: sorted.length,
                    total: requests.length,
                  })}
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('requests.quickContext.title', { defaultValue: 'Quick context' })}
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
                    <RequestForm
                      ref={inlineFormRef}
                      currentRequest={currentRequest}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeRequestPanel}
                      stacked
                    />
                  </div>
                ) : detailRequest ? (
                  <RequestView request={detailRequest} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <RequestsStatisticsView />
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
