import {
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  Menu,
  Plus,
  Power,
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

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';
import {
  ingestMatchesListFilters,
  toggleIngestListFilter,
  type IngestListFilter,
  type IngestListFilterSelection,
} from '../utils/ingestListFilter';
import {
  compareIngestByField,
  isIngestAscDefaultField,
  type IngestSortField,
  type IngestSortOrder,
} from '../utils/ingestListSort';

import { IngestSourceForm } from './IngestSourceForm';
import { IngestSourceListTable } from './IngestSourceListTable';
import { IngestSourceView } from './IngestSourceView';
import { IngestStatisticsView } from './IngestStatisticsView';

type SortField = IngestSortField;
type SortOrder = IngestSortOrder;

const INGEST_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.ingest.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'name', labelKey: 'ingest.colName' },
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'sourceType', labelKey: 'ingest.colType' },
  { value: 'isActive', labelKey: 'ingest.active' },
  { value: 'lastFetchStatus', labelKey: 'ingest.colStatus' },
  { value: 'lastFetchedAt', labelKey: 'ingest.colLastFetched' },
];

let pendingPreviewSourceId: string | null = null;

export const IngestSourceList: React.FC = () => {
  const { t } = useTranslation();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const {
    ingest,
    openIngestPanel,
    openIngestForView,
    validationErrors,
    selectedIngestIds,
    toggleIngestSelected,
    mergeIntoIngestSelection,
    selectAllIngest,
    clearIngestSelection,
    selectedCount,
    isSelected,
    deleteIngestSources,
    isIngestPanelOpen,
    panelMode,
    currentIngest,
    saveIngest,
    closeIngestPanel,
    loadIngestRuns,
    isSaving,
  } = useIngest();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openIngestPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('ingest');
  const [selectionMode, setSelectionMode] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('ingest.searchPlaceholder', { count: ingest.length }),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<IngestListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewSource, setPreviewSource] = useState<IngestSource | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    INGEST_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingSourceRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isIngestPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isIngestPanelOpen && panelMode === 'view' && currentIngest != null;
  const detailSource = inlinePanelView ? currentIngest : previewSource;
  const activeListSourceId =
    (inlineForm || inlinePanelView) && currentIngest != null
      ? currentIngest.id
      : (previewSource?.id ?? null);

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
    if (restoredPendingSourceRef.current || !pendingPreviewSourceId) {
      return;
    }
    const restored = ingest.find((source) => String(source.id) === pendingPreviewSourceId);
    if (restored) {
      setPreviewSource(restored);
      restoredPendingSourceRef.current = true;
      pendingPreviewSourceId = null;
    }
  }, [ingest]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isIngestAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isIngestAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = ingest.filter((s) => ingestMatchesListFilters(s, activeFilters));

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((s) => {
      if (!needle) {
        return true;
      }
      return (
        s.name.toLowerCase().includes(needle) ||
        s.sourceUrl.toLowerCase().includes(needle) ||
        s.sourceType.toLowerCase().includes(needle) ||
        s.lastFetchStatus.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => compareIngestByField(a, b, primarySort, sortOrder));
  }, [ingest, searchTerm, primarySort, sortOrder, activeFilters]);

  const stats = useMemo(
    () => ({
      total: ingest.length,
      active: ingest.filter((s) => Boolean(s.isActive)).length,
      success: ingest.filter((s) => s.lastFetchStatus === 'success').length,
      failed: ingest.filter((s) => s.lastFetchStatus === 'failed').length,
    }),
    [ingest],
  );

  const isFilterActive = (filter: IngestListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: IngestListFilter) => {
    setActiveFilters((prev) => toggleIngestListFilter(prev, filter));
  };

  useEffect(() => {
    if (!previewSource) {
      return;
    }
    const next = ingest.find((source) => String(source.id) === String(previewSource.id));
    if (!next) {
      setPreviewSource(null);
      return;
    }
    if (next !== previewSource) {
      setPreviewSource(next);
    }
  }, [ingest, previewSource]);

  useEffect(() => {
    if (!showDesktopSplit || !isIngestPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentIngest) {
      setPreviewSource(currentIngest);
    }
  }, [showDesktopSplit, isIngestPanelOpen, panelMode, currentIngest]);

  useEffect(() => {
    if (!detailSource || inlineForm) {
      return;
    }
    void loadIngestRuns(String(detailSource.id));
  }, [detailSource?.id, inlineForm, loadIngestRuns]);

  const visibleSourceIds = useMemo(
    () => filteredAndSorted.map((s) => String(s.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleSourceIds,
      mergeIntoSelection: mergeIntoIngestSelection,
      toggleOne: (id) => toggleIngestSelected(String(id)),
    });

  const allVisibleSelected = useMemo(
    () => visibleSourceIds.length > 0 && visibleSourceIds.every((id) => isSelected(id)),
    [visibleSourceIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleSourceIds);
      const remaining = selectedIngestIds.filter((id) => !set.has(id));
      selectAllIngest(remaining);
    } else {
      selectAllIngest(Array.from(new Set([...selectedIngestIds, ...visibleSourceIds])));
    }
  }, [allVisibleSelected, visibleSourceIds, selectedIngestIds, selectAllIngest]);

  const handleOpenForView = (row: IngestSource) => {
    pendingPreviewSourceId = String(row.id);
    attemptNavigation(() => openIngestForView(row));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearIngestSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (row: IngestSource) => {
    if (isCompactViewport) {
      handleOpenForView(row);
      return;
    }
    if (selectionMode) {
      toggleIngestSelected(String(row.id));
      return;
    }
    if (
      isIngestPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeIngestPanel();
        setPreviewSource(row);
      });
      return;
    }
    setPreviewSource((current) => (current && String(current.id) === String(row.id) ? null : row));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeIngestPanel();
  }, [closeIngestPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await saveIngest(data);
      return ok;
    },
    [saveIngest],
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

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteIngestSources(selectedIngestIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteIngestSources, selectedIngestIds]);

  const generalError = validationErrors.find((e) => e.field === 'general');

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('ingest.stats.total', { defaultValue: 'Total' }),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'active',
        active: isFilterActive('active'),
        icon: Power,
        label: t('ingest.active'),
        count: stats.active,
        onClick: () => toggleFilter('active'),
      },
      {
        key: 'success',
        active: isFilterActive('success'),
        icon: CheckCircle2,
        label: t('ingest.stats.success', { defaultValue: 'Success' }),
        count: stats.success,
        onClick: () => toggleFilter('success'),
      },
      {
        key: 'failed',
        active: isFilterActive('failed'),
        icon: XCircle,
        label: t('ingest.stats.failed', { defaultValue: 'Failed' }),
        count: stats.failed,
        onClick: () => toggleFilter('failed'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

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
          aria-label={t('ingest.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('ingest.sort', { defaultValue: 'Sort' })}</span>
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
            ? t('ingest.sortAsc', { defaultValue: 'Ascending' })
            : t('ingest.sortDesc', { defaultValue: 'Descending' })}
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
            {t('ingest.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('ingest.sortDesc', { defaultValue: 'Descending' })}
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
                label={toolbarCollapsed ? t('ingest.expandToolbar') : t('ingest.collapseToolbar')}
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="ingest-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailSource || inlineForm);

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-ingest flex min-h-0 flex-1 flex-col',
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
                  id="ingest-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.ingest')}</h2>
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
                      placeholder={t('ingest.searchPlaceholder', { count: ingest.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('ingest.addSource')}
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                      onClick={() => attemptNavigation(() => openIngestPanel(null))}
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

          {generalError ? (
            <p className="text-sm text-destructive" role="alert">
              {generalError.message}
            </p>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel="ingest sources"
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
                    message={searchTerm.trim() ? t('ingest.noMatch') : t('ingest.noYet')}
                    createLabel={!searchTerm.trim() ? t('ingest.addSource') : undefined}
                    onCreate={
                      !searchTerm.trim()
                        ? () => attemptNavigation(() => openIngestPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <IngestSourceListTable
                    sources={filteredAndSorted}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={(id) => isSelected(id)}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    selectionEnabled={selectionMode}
                    activeSourceId={activeListSourceId}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      Showing {filteredAndSorted.length} of {ingest.length} Sources
                    </>
                  }
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('ingest.quickContext.title', { defaultValue: 'Source details' })}
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
                    <IngestSourceForm
                      ref={inlineFormRef}
                      currentIngest={currentIngest}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeIngestPanel}
                      isSubmitting={isSaving}
                      stacked
                    />
                  </div>
                ) : detailSource ? (
                  <IngestSourceView ingest={detailSource} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <IngestStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
