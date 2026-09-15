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
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskPriceList } from '../types/priceList';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import {
  priceListMatchesListFilters,
  togglePriceListListFilter,
  type PriceListListFilter,
  type PriceListListFilterSelection,
} from '../utils/priceListListFilter';
import {
  comparePriceListsByField,
  isPriceListAscDefaultField,
  type PriceListSortField,
  type PriceListSortOrder,
} from '../utils/priceListListSort';

import { PriceListForm } from './PriceListForm';
import { PriceListListTable } from './PriceListListTable';
import { PriceListView } from './PriceListView';

const SORT_FIELD_OPTIONS: { value: PriceListSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'clubdesk.sort.updated' },
  { value: 'title', labelKey: 'clubdesk.sort.title' },
  { value: 'createdAt', labelKey: 'clubdesk.sort.created' },
  { value: 'publicationStatus', labelKey: 'clubdesk.sort.status' },
  { value: 'currency', labelKey: 'clubdesk.priceList.currency' },
  { value: 'itemCount', labelKey: 'clubdesk.priceList.itemsCard' },
];

const PRICE_LIST_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.clubdesk.priceList.toolbar.collapsed';
const PRICE_LIST_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.clubdesk.priceList.toolbar.filtersVisible';

function readPriceListToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(PRICE_LIST_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePriceListToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PRICE_LIST_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

export const PriceListList: React.FC = () => {
  const { t } = useTranslation();
  const {
    priceLists,
    deletePriceLists,
    selectedPriceListIds,
    togglePriceListSelected,
    mergeIntoPriceListSelection,
    selectAllPriceLists,
    clearPriceListSelection,
    priceListSelectedCount,
    isPriceListSelected,
    recentlyDuplicatedPriceListId,
    openPriceListPanel,
    openPriceListForView,
    validationErrors,
    isClubdeskPanelOpen,
    panelMode,
    currentPriceList,
    closeClubdeskPanel,
    activeDomain,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openPriceListPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('clubdesk-pricelists');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<PriceListSortField>('title');
  const [sortOrder, setSortOrder] = useState<PriceListSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<PriceListListFilterSelection>([]);
  const [previewPriceList, setPreviewPriceList] = useState<ClubdeskPriceList | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readPriceListToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    PRICE_LIST_FILTERS_VISIBLE_STORAGE_KEY,
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
    activeDomain === 'priceLists' &&
    (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit &&
    isClubdeskPanelOpen &&
    activeDomain === 'priceLists' &&
    panelMode === 'view' &&
    currentPriceList != null;
  const detailPriceList = inlinePanelView ? currentPriceList : previewPriceList;
  const activePriceListId =
    (inlineForm || inlinePanelView) && currentPriceList != null
      ? currentPriceList.id
      : (previewPriceList?.id ?? null);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('clubdesk.priceList.searchPlaceholder', {
      count: priceLists.length,
    }),
  });

  useEffect(() => {
    // Keep soft preview in sync with index updates for the SAME id.
    // Index rows omit `items` — preserve a hydrated items array.
    setPreviewPriceList((current) => {
      if (!current) {
        return current;
      }
      const next = priceLists.find((item) => String(item.id) === String(current.id));
      if (!next) {
        return null;
      }
      if (next === current) {
        return current;
      }
      if (Array.isArray(next.items)) {
        return next;
      }
      if (!Array.isArray(current.items)) {
        return next;
      }
      return { ...next, items: current.items, itemCount: current.itemCount ?? next.itemCount };
    });
  }, [priceLists]);

  // Soft-selected price lists need a full getPriceList payload (index omits items).
  useEffect(() => {
    if (!previewPriceList?.id) {
      return;
    }
    const count = previewPriceList.itemCount ?? 0;
    const loaded = Array.isArray(previewPriceList.items);
    if (loaded && (previewPriceList.items!.length > 0 || count === 0)) {
      return;
    }
    const listId = previewPriceList.id;
    let cancelled = false;
    void clubdeskApi
      .getPriceList(listId)
      .then((full) => {
        if (cancelled) {
          return;
        }
        setPreviewPriceList((current) =>
          current && String(current.id) === String(full.id) ? full : current,
        );
      })
      .catch((err) => {
        console.error('Failed to hydrate price list preview:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [previewPriceList?.id, previewPriceList?.items, previewPriceList?.itemCount]);

  useEffect(() => {
    if (!showDesktopSplit || !isClubdeskPanelOpen || activeDomain !== 'priceLists') {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentPriceList) {
      setPreviewPriceList((current) => {
        const next = currentPriceList;
        if (
          current &&
          String(current.id) === String(next.id) &&
          Array.isArray(current.items) &&
          current.items.length > 0 &&
          (!Array.isArray(next.items) || next.items.length === 0)
        ) {
          return {
            ...next,
            items: current.items,
            itemCount: current.itemCount ?? next.itemCount,
          };
        }
        return next;
      });
    }
  }, [showDesktopSplit, isClubdeskPanelOpen, activeDomain, panelMode, currentPriceList]);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writePriceListToolbarCollapsed(next);
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

  const handlePrimarySortChange = (field: PriceListSortField) => {
    setPrimarySort(field);
    setSortOrder(isPriceListAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: PriceListSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isPriceListAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const sortedPriceLists = useMemo(() => {
    const byFilter = priceLists.filter((item) => priceListMatchesListFilters(item, activeFilters));

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.slug || '').toLowerCase().includes(q) ||
        (item.currency || '').toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => comparePriceListsByField(a, b, primarySort, sortOrder));
  }, [priceLists, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: PriceListListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: PriceListListFilter) => {
    setActiveFilters((prev) => togglePriceListListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: priceLists.length,
      draft: priceLists.filter((i) => i.publicationStatus === 'draft').length,
      published: priceLists.filter((i) => i.publicationStatus === 'published').length,
    }),
    [priceLists],
  );

  const visibleIds = useMemo(
    () => sortedPriceLists.map((item) => String(item.id)),
    [sortedPriceLists],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoPriceListSelection,
      toggleOne: togglePriceListSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isPriceListSelected(id)),
    [visibleIds, isPriceListSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedPriceListIds.filter((id) => !set.has(id));
      selectAllPriceLists(remaining);
    } else {
      const union = Array.from(new Set([...selectedPriceListIds, ...visibleIds]));
      selectAllPriceLists(union);
    }
  }, [allVisibleSelected, visibleIds, selectedPriceListIds, selectAllPriceLists]);

  const handleBulkDelete = async () => {
    if (selectedPriceListIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deletePriceLists(selectedPriceListIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearPriceListSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: ClubdeskPriceList) => {
    if (isCompactViewport) {
      attemptNavigation(() => openPriceListForView(item));
      return;
    }
    if (selectionMode) {
      togglePriceListSelected(String(item.id));
      return;
    }
    if (
      isClubdeskPanelOpen &&
      activeDomain === 'priceLists' &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeClubdeskPanel();
        setPreviewPriceList(item);
      });
      return;
    }
    setPreviewPriceList((current) =>
      current && String(current.id) === String(item.id) ? null : item,
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
    closeClubdeskPanel();
  }, [closeClubdeskPanel]);

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = priceListSelectedCount === 0;
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
  }, [priceListSelectedCount, t]);

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
          aria-label={t('clubdesk.priceList.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('clubdesk.priceList.sort')}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as PriceListSortField)}
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
          {sortOrder === 'asc' ? t('clubdesk.priceList.sortAsc') : t('clubdesk.priceList.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as PriceListSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.priceList.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.priceList.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={priceListSelectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedPriceLists.length === 0) {
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
                  toolbarCollapsed
                    ? t('clubdesk.priceList.expandToolbar')
                    : t('clubdesk.priceList.collapseToolbar')
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
                aria-controls="clubdesk-price-list-mail-toolbar"
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
                  id="clubdesk-price-list-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.clubdesk-price-list')}</h2>
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
                      placeholder={t('clubdesk.priceList.searchPlaceholder', {
                        count: priceLists.length,
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('clubdesk.priceList.add')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openPriceListPanel(null))}
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
            itemCount={priceListSelectedCount}
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
                {sortedPriceLists.length === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm || activeFilters.length > 0
                        ? t('clubdesk.priceList.noMatch')
                        : t('clubdesk.priceList.noYet')
                    }
                    createLabel={
                      !searchTerm && activeFilters.length === 0
                        ? t('clubdesk.priceList.add')
                        : undefined
                    }
                    onCreate={
                      !searchTerm && activeFilters.length === 0
                        ? () => attemptNavigation(() => openPriceListPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <PriceListListTable
                    priceLists={sortedPriceLists}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isPriceListSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    recentlyDuplicatedPriceListId={recentlyDuplicatedPriceListId}
                    selectionEnabled={selectionMode}
                    activePriceListId={activePriceListId}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      {t('clubdesk.priceList.showingCount', {
                        shown: sortedPriceLists.length,
                        total: priceLists.length,
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
                aria-label={t('clubdesk.priceList.quickContext.title')}
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
                    <PriceListForm ref={inlineFormRef} stacked />
                  </div>
                ) : detailPriceList ? (
                  <PriceListView priceList={detailPriceList} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('clubdesk.priceList.quickContext.emptyTitle')}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('clubdesk.priceList.quickContext.emptyHint')}
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
