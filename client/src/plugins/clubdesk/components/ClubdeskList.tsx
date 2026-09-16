import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileText,
  LayoutGrid,
  Menu,
  Plus,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

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
import { pathToNavPage } from '@/core/routing/routeMap';
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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import { useClubdesk } from '../hooks/useClubdesk';
import type { Clubdesk } from '../types/clubdesk';
import {
  clubdeskMatchesListFilters,
  toggleClubdeskListFilter,
  type ClubdeskListFilter,
  type ClubdeskListFilterSelection,
} from '../utils/clubdeskListFilter';
import {
  compareClubdesksByField,
  isClubdeskAscDefaultField,
  isClubdeskStringSortField,
  type ClubdeskSortField,
  type ClubdeskSortOrder,
} from '../utils/clubdeskListSort';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import { sortCategoryNames } from '../utils/sortCategoryNames';

import { ClubdeskForm } from './ClubdeskForm';
import { ClubdeskInfoView } from './ClubdeskInfoView';
import { ClubdeskListTable } from './ClubdeskListTable';
import { ClubdeskView } from './ClubdeskView';
import { PriceListList } from './PriceListList';

const UNCATEGORIZED_FILTER = '__uncategorized__';

type CategoryFilter = 'all' | typeof UNCATEGORIZED_FILTER | string;

function clubdeskCategoryKey(category: string | null | undefined): string {
  const trimmed = (category || '').trim();
  return trimmed ? trimmed : UNCATEGORIZED_FILTER;
}

const SORT_FIELD_OPTIONS: { value: ClubdeskSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'clubdesk.sort.updated' },
  { value: 'title', labelKey: 'clubdesk.sort.title' },
  { value: 'createdAt', labelKey: 'clubdesk.sort.created' },
  { value: 'publicationStatus', labelKey: 'clubdesk.sort.status' },
];

const GUIDES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.clubdesk.guides.toolbar.filtersVisible';

export const ClubdeskList: React.FC = () => {
  const location = useLocation();
  const page = pathToNavPage(location.pathname);
  if (page === 'clubdesk-price-list') {
    return <PriceListList />;
  }
  if (page === 'clubdesk-info') {
    return <ClubdeskInfoView />;
  }
  return <ClubdeskGuidesList />;
};

const ClubdeskGuidesList: React.FC = () => {
  const { t } = useTranslation();
  const {
    clubdesk,
    categories,
    openClubdeskForView,
    deleteClubdesks,
    selectedClubdeskIds,
    toggleClubdeskSelected,
    mergeIntoClubdeskSelection,
    selectAllClubdesks,
    clearClubdeskSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedClubdeskId,
    openClubdeskPanel,
    validationErrors,
    isClubdeskPanelOpen,
    panelMode,
    currentClubdesk,
    closeClubdeskPanel,
    saveClubdesk,
    activeDomain,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openClubdeskPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('clubdesk');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<ClubdeskSortField>('title');
  const [sortOrder, setSortOrder] = useState<ClubdeskSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<ClubdeskListFilterSelection>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [previewClubdesk, setPreviewClubdesk] = useState<Clubdesk | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    GUIDES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit &&
    isClubdeskPanelOpen &&
    activeDomain === 'guides' &&
    (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit &&
    isClubdeskPanelOpen &&
    activeDomain === 'guides' &&
    panelMode === 'view' &&
    currentClubdesk != null;
  const detailClubdesk = inlinePanelView ? currentClubdesk : previewClubdesk;
  const activeClubdeskId =
    (inlineForm || inlinePanelView) && currentClubdesk != null
      ? currentClubdesk.id
      : (previewClubdesk?.id ?? null);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('clubdesk.searchPlaceholder', {
      count: clubdesk.length,
    }),
  });

  useEffect(() => {
    // Keep soft preview in sync with index updates for the SAME id.
    // Index rows omit `steps` — preserve a hydrated steps array.
    setPreviewClubdesk((current) => {
      if (!current) {
        return current;
      }
      const next = clubdesk.find((item) => String(item.id) === String(current.id));
      if (!next) {
        return null;
      }
      if (next === current) {
        return current;
      }
      if (Array.isArray(next.steps)) {
        return next;
      }
      if (!Array.isArray(current.steps)) {
        return next;
      }
      return { ...next, steps: current.steps, stepCount: current.stepCount ?? next.stepCount };
    });
  }, [clubdesk]);

  // Soft-selected guides need a full getClubdesk payload (index omits steps).
  useEffect(() => {
    if (!previewClubdesk?.id) {
      return;
    }
    const count = previewClubdesk.stepCount ?? 0;
    const loaded = Array.isArray(previewClubdesk.steps);
    if (loaded && (previewClubdesk.steps!.length > 0 || count === 0)) {
      return;
    }
    const guideId = previewClubdesk.id;
    let cancelled = false;
    void clubdeskApi
      .getClubdesk(guideId)
      .then((full) => {
        if (cancelled) {
          return;
        }
        setPreviewClubdesk((current) =>
          current && String(current.id) === String(full.id) ? full : current,
        );
      })
      .catch((err) => {
        console.error('Failed to hydrate clubdesk guide preview:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [previewClubdesk?.id, previewClubdesk?.steps, previewClubdesk?.stepCount]);

  useEffect(() => {
    if (!showDesktopSplit || !isClubdeskPanelOpen || activeDomain !== 'guides') {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentClubdesk) {
      setPreviewClubdesk((current) => {
        const next = currentClubdesk;
        if (
          current &&
          String(current.id) === String(next.id) &&
          Array.isArray(current.steps) &&
          current.steps.length > 0 &&
          (!Array.isArray(next.steps) || next.steps.length === 0)
        ) {
          return {
            ...next,
            steps: current.steps,
            stepCount: current.stepCount ?? next.stepCount,
          };
        }
        return next;
      });
    }
  }, [showDesktopSplit, isClubdeskPanelOpen, activeDomain, panelMode, currentClubdesk]);

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

  const handlePrimarySortChange = (field: ClubdeskSortField) => {
    setPrimarySort(field);
    setSortOrder(isClubdeskStringSortField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: ClubdeskSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isClubdeskAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const catalogOrder = useMemo(() => categories.map((c) => c.name), [categories]);

  const sortedClubdesks = useMemo(() => {
    const byFilter = clubdesk.filter((item) => clubdeskMatchesListFilters(item, activeFilters));

    const byCategory =
      categoryFilter === 'all'
        ? byFilter
        : byFilter.filter((item) => clubdeskCategoryKey(item.category) === categoryFilter);

    const q = searchTerm.toLowerCase();
    const filtered = byCategory.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.slug || '').toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareClubdesksByField(a, b, primarySort, sortOrder));
  }, [clubdesk, searchTerm, primarySort, sortOrder, activeFilters, categoryFilter]);

  const isFilterActive = (filter: ClubdeskListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: ClubdeskListFilter) => {
    setActiveFilters((prev) => toggleClubdeskListFilter(prev, filter));
  };

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of clubdesk) {
      const key = clubdeskCategoryKey(item.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const namedKeys = Array.from(counts.keys()).filter((key) => key !== UNCATEGORIZED_FILTER);
    const orderedKeys = sortCategoryNames(namedKeys, catalogOrder, UNCATEGORIZED_FILTER);
    const options: Array<{ key: string; count: number }> = orderedKeys.map((key) => ({
      key,
      count: counts.get(key) ?? 0,
    }));
    const uncategorizedCount = counts.get(UNCATEGORIZED_FILTER) ?? 0;
    if (uncategorizedCount > 0) {
      options.push({ key: UNCATEGORIZED_FILTER, count: uncategorizedCount });
    }
    return options;
  }, [clubdesk, catalogOrder]);

  const visibleIds = useMemo(
    () => sortedClubdesks.map((item) => String(item.id)),
    [sortedClubdesks],
  );

  const stats = useMemo(
    () => ({
      total: clubdesk.length,
      draft: clubdesk.filter((i) => i.publicationStatus === 'draft').length,
      published: clubdesk.filter((i) => i.publicationStatus === 'published').length,
    }),
    [clubdesk],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoClubdeskSelection,
      toggleOne: toggleClubdeskSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedClubdeskIds.filter((id) => !set.has(id));
      selectAllClubdesks(remaining);
    } else {
      const union = Array.from(new Set([...selectedClubdeskIds, ...visibleIds]));
      selectAllClubdesks(union);
    }
  }, [allVisibleSelected, visibleIds, selectedClubdeskIds, selectAllClubdesks]);

  const handleBulkDelete = async () => {
    if (selectedClubdeskIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteClubdesks(selectedClubdeskIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRowActivate = (item: Clubdesk) => {
    if (isCompactViewport) {
      attemptNavigation(() => openClubdeskForView(item));
      return;
    }
    if (selectionMode) {
      toggleClubdeskSelected(String(item.id));
      return;
    }
    if (
      isClubdeskPanelOpen &&
      activeDomain === 'guides' &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeClubdeskPanel();
        setPreviewClubdesk(item);
      });
      return;
    }
    setPreviewClubdesk((current) =>
      current && String(current.id) === String(item.id) ? null : item,
    );
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearClubdeskSelection();
    setSelectionMode(false);
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeClubdeskPanel();
  }, [closeClubdeskPanel]);

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

  const listStatusError = getClubdeskListStatusErrorMessage(validationErrors);

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
          {t('clubdesk.filter.all')}{' '}
          <span className="tabular-nums font-semibold">({stats.total})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('draft')}
        className={cn(
          isFilterActive('draft') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        <span>
          {t('clubdesk.filter.draft')}{' '}
          <span className="tabular-nums font-semibold">({stats.draft})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('published')}
        className={cn(
          isFilterActive('published') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          {t('clubdesk.filter.published')}{' '}
          <span className="tabular-nums font-semibold">({stats.published})</span>
        </span>
      </Button>
      {categoryOptions.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              categoryFilter === 'all' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>
              {t('clubdesk.filter.all')}{' '}
              <span className="tabular-nums font-semibold">({stats.total})</span>
            </span>
          </Button>
          {categoryOptions.map((option) => {
            const isActive = categoryFilter === option.key;
            const label =
              option.key === UNCATEGORIZED_FILTER ? t('clubdesk.uncategorized') : option.key;
            return (
              <Button
                key={option.key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCategoryFilter(isActive ? 'all' : option.key)}
                className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                <Tag className="h-3.5 w-3.5" />
                <span>
                  {label} <span className="tabular-nums font-semibold">({option.count})</span>
                </span>
              </Button>
            );
          })}
        </>
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
          aria-label={t('clubdesk.sortBy')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('clubdesk.sortBy')}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as ClubdeskSortField)}
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
          {sortOrder === 'asc' ? t('clubdesk.sortAsc') : t('clubdesk.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as ClubdeskSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.sortDesc')}
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
    if (sortedClubdesks.length === 0) {
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
                label={
                  toolbarCollapsed ? t('clubdesk.expandToolbar') : t('clubdesk.collapseToolbar')
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
                aria-controls="clubdesk-guides-mail-toolbar"
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
          'plugin-clubdesk flex min-h-0 flex-1 flex-col',
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
                  id="clubdesk-guides-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.clubdesk-guides')}</h2>
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
                      placeholder={t('clubdesk.searchPlaceholder', {
                        count: clubdesk.length,
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('clubdesk.addClubdesk')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openClubdeskPanel(null))}
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

          {listStatusError ? (
            <p className="shrink-0 text-sm text-destructive" role="alert">
              {listStatusError}
            </p>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel="clubdesk"
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
                {sortedClubdesks.length === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm || activeFilters.length > 0 || categoryFilter !== 'all'
                        ? t('clubdesk.noMatch')
                        : t('clubdesk.noYet')
                    }
                    createLabel={
                      !searchTerm && activeFilters.length === 0 && categoryFilter === 'all'
                        ? t('clubdesk.addClubdesk')
                        : undefined
                    }
                    onCreate={
                      !searchTerm && activeFilters.length === 0 && categoryFilter === 'all'
                        ? () => attemptNavigation(() => openClubdeskPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <ClubdeskListTable
                    clubdesks={sortedClubdesks}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    recentlyDuplicatedClubdeskId={recentlyDuplicatedClubdeskId}
                    selectionEnabled={selectionMode}
                    activeClubdeskId={activeClubdeskId}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      {t('clubdesk.showingCount', {
                        shown: sortedClubdesks.length,
                        total: clubdesk.length,
                      })}
                    </>
                  }
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('clubdesk.quickContext.title')}
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
                    <ClubdeskForm
                      ref={inlineFormRef}
                      currentClubdesk={currentClubdesk}
                      onSave={saveClubdesk}
                      onCancel={closeClubdeskPanel}
                      stacked
                    />
                  </div>
                ) : detailClubdesk ? (
                  <ClubdeskView clubdesk={detailClubdesk} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('clubdesk.quickContext.emptyTitle')}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('clubdesk.quickContext.emptyHint')}
                    </p>
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
