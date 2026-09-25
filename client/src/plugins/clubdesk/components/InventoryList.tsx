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
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskInventoryItem } from '../types/inventory';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import {
  inventoryMatchesListFilters,
  toggleInventoryListFilter,
  type InventoryListFilter,
  type InventoryListFilterSelection,
} from '../utils/inventoryListFilter';
import {
  compareInventoryByField,
  isInventoryAscDefaultField,
  type InventorySortField,
  type InventorySortOrder,
} from '../utils/inventoryListSort';

import {
  ClubdeskInventorySettingsView,
  type ClubdeskInventorySettingsCategory,
} from './ClubdeskInventorySettingsView';
import { InventoryForm } from './InventoryForm';
import { InventoryListTable } from './InventoryListTable';
import { InventoryView } from './InventoryView';

type InventoryContentView = 'list' | 'settings';

const SORT_FIELD_OPTIONS: { value: InventorySortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'clubdesk.sort.updated' },
  { value: 'articleName', labelKey: 'clubdesk.inventory.articleName' },
  { value: 'createdAt', labelKey: 'clubdesk.sort.created' },
  { value: 'publicationStatus', labelKey: 'clubdesk.sort.status' },
];

const INVENTORY_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.clubdesk.inventory.toolbar.filtersVisible';

export const InventoryList: React.FC = () => {
  const { t } = useTranslation();
  const {
    inventoryItems,
    deleteInventoryItems,
    selectedInventoryIds,
    toggleInventorySelected,
    mergeIntoInventorySelection,
    selectAllInventory,
    clearInventorySelection,
    inventorySelectedCount,
    isInventorySelected,
    recentlyDuplicatedInventoryId,
    openInventoryPanel,
    openInventoryForView,
    validationErrors,
    isClubdeskPanelOpen,
    panelMode,
    currentInventoryItem,
    closeClubdeskPanel,
    activeDomain,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [contentView, setContentView] = useState<InventoryContentView>('list');
  const [inventorySettingsCategory, setInventorySettingsCategory] =
    useState<ClubdeskInventorySettingsCategory>('tags');

  const openInventorySettings = useCallback(() => {
    setContentView('settings');
  }, []);

  const closeInventorySettings = useCallback(() => {
    setContentView('list');
  }, []);

  useMobileActions({
    onAdd: () => attemptNavigation(() => openInventoryPanel(null)),
    onSettings: () => attemptNavigation(() => openInventorySettings()),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('clubdesk-inventory');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<InventorySortField>('articleName');
  const [sortOrder, setSortOrder] = useState<InventorySortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<InventoryListFilterSelection>([]);
  const [previewItem, setPreviewItem] = useState<ClubdeskInventoryItem | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    INVENTORY_FILTERS_VISIBLE_STORAGE_KEY,
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
    activeDomain === 'inventory' &&
    (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit &&
    isClubdeskPanelOpen &&
    activeDomain === 'inventory' &&
    panelMode === 'view' &&
    currentInventoryItem != null;
  const detailInventory = inlinePanelView ? currentInventoryItem : previewItem;
  const activeInventoryId =
    (inlineForm || inlinePanelView) && currentInventoryItem != null
      ? currentInventoryItem.id
      : (previewItem?.id ?? null);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('clubdesk.inventory.searchPlaceholder', {
      count: inventoryItems.length,
    }),
  });

  useEffect(() => {
    // Keep soft preview in sync with index updates for the SAME id.
    // Index rows omit `items` — preserve a hydrated items array.
    setPreviewItem((current) => {
      if (!current) {
        return current;
      }
      const next = inventoryItems.find((item) => String(item.id) === String(current.id));
      if (!next) {
        return null;
      }
      if (next === current) {
        return current;
      }
      if (Array.isArray(next.variants)) {
        return next;
      }
      if (!Array.isArray(current.variants)) {
        return next;
      }
      return {
        ...next,
        variants: current.variants,
        variantCount: current.variantCount ?? next.variantCount,
      };
    });
  }, [inventoryItems]);

  // Soft-selected price lists need a full getInventoryItem payload (index omits items).
  useEffect(() => {
    if (!previewItem?.id) {
      return;
    }
    const count = previewItem.variantCount ?? 0;
    const loaded = Array.isArray(previewItem.variants);
    if (loaded && (previewItem.variants!.length > 0 || count === 0)) {
      return;
    }
    const listId = previewItem.id;
    let cancelled = false;
    void clubdeskApi
      .getInventoryItem(listId)
      .then((full) => {
        if (cancelled) {
          return;
        }
        setPreviewItem((current) =>
          current && String(current.id) === String(full.id) ? full : current,
        );
      })
      .catch((err) => {
        console.error('Failed to hydrate price list preview:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [previewItem?.id, previewItem?.variants, previewItem?.variantCount]);

  useEffect(() => {
    if (!showDesktopSplit || !isClubdeskPanelOpen || activeDomain !== 'inventory') {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentInventoryItem) {
      setPreviewItem((current) => {
        const next = currentInventoryItem;
        if (
          current &&
          String(current.id) === String(next.id) &&
          Array.isArray(current.variants) &&
          current.variants.length > 0 &&
          (!Array.isArray(next.variants) || next.variants.length === 0)
        ) {
          return {
            ...next,
            variants: current.variants,
            variantCount: current.variantCount ?? next.variantCount,
          };
        }
        return next;
      });
    }
  }, [showDesktopSplit, isClubdeskPanelOpen, activeDomain, panelMode, currentInventoryItem]);

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

  const handlePrimarySortChange = (field: InventorySortField) => {
    setPrimarySort(field);
    setSortOrder(isInventoryAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: InventorySortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isInventoryAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const sortedInventorys = useMemo(() => {
    const byFilter = inventoryItems.filter((item) =>
      inventoryMatchesListFilters(item, activeFilters),
    );

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (item) =>
        item.articleName.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.slug || '').toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareInventoryByField(a, b, primarySort, sortOrder));
  }, [inventoryItems, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: InventoryListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: InventoryListFilter) => {
    setActiveFilters((prev) => toggleInventoryListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: inventoryItems.length,
      draft: inventoryItems.filter((i) => i.publicationStatus === 'draft').length,
      published: inventoryItems.filter((i) => i.publicationStatus === 'published').length,
    }),
    [inventoryItems],
  );

  const visibleIds = useMemo(
    () => sortedInventorys.map((item) => String(item.id)),
    [sortedInventorys],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoInventorySelection,
      toggleOne: toggleInventorySelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isInventorySelected(id)),
    [visibleIds, isInventorySelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedInventoryIds.filter((id) => !set.has(id));
      selectAllInventory(remaining);
    } else {
      const union = Array.from(new Set([...selectedInventoryIds, ...visibleIds]));
      selectAllInventory(union);
    }
  }, [allVisibleSelected, visibleIds, selectedInventoryIds, selectAllInventory]);

  const handleBulkDelete = async () => {
    if (selectedInventoryIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteInventoryItems(selectedInventoryIds);
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
    clearInventorySelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: ClubdeskInventoryItem) => {
    if (isCompactViewport) {
      attemptNavigation(() => openInventoryForView(item));
      return;
    }
    if (selectionMode) {
      toggleInventorySelected(String(item.id));
      return;
    }
    if (
      isClubdeskPanelOpen &&
      activeDomain === 'inventory' &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeClubdeskPanel();
        setPreviewItem(item);
      });
      return;
    }
    setPreviewItem((current) => (current && String(current.id) === String(item.id) ? null : item));
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
    const disabled = inventorySelectedCount === 0;
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
  }, [inventorySelectedCount, t]);

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
          aria-label={t('clubdesk.inventory.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('clubdesk.inventory.sort')}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as InventorySortField)}
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
          {sortOrder === 'asc' ? t('clubdesk.inventory.sortAsc') : t('clubdesk.inventory.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as InventorySortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.inventory.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('clubdesk.inventory.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={inventorySelectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedInventorys.length === 0) {
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

  if (contentView === 'settings') {
    return (
      <div className="plugin-clubdesk min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <ClubdeskInventorySettingsView
            selectedCategory={inventorySettingsCategory}
            onSelectedCategoryChange={setInventorySettingsCategory}
            onClose={closeInventorySettings}
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
                  toolbarCollapsed
                    ? t('clubdesk.inventory.expandToolbar')
                    : t('clubdesk.inventory.collapseToolbar')
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
                aria-controls="clubdesk-inventory-mail-toolbar"
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
                  id="clubdesk-inventory-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.clubdesk-inventory')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openInventorySettings())}
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
                      placeholder={t('clubdesk.inventory.searchPlaceholder', {
                        count: inventoryItems.length,
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('clubdesk.inventory.add')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openInventoryPanel(null))}
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
            itemCount={inventorySelectedCount}
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
                {sortedInventorys.length === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm || activeFilters.length > 0
                        ? t('clubdesk.inventory.noMatch')
                        : t('clubdesk.inventory.noYet')
                    }
                    createLabel={
                      !searchTerm && activeFilters.length === 0
                        ? t('clubdesk.inventory.add')
                        : undefined
                    }
                    onCreate={
                      !searchTerm && activeFilters.length === 0
                        ? () => attemptNavigation(() => openInventoryPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <InventoryListTable
                    items={sortedInventorys}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isInventorySelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    recentlyDuplicatedInventoryId={recentlyDuplicatedInventoryId}
                    selectionEnabled={selectionMode}
                    activeInventoryId={activeInventoryId}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      {t('clubdesk.inventory.showingCount', {
                        shown: sortedInventorys.length,
                        total: inventoryItems.length,
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
                aria-label={t('clubdesk.inventory.previewTitle')}
                aria-live="polite"
              >
                {inlineForm ? (
                  <InventoryForm
                    ref={inlineFormRef}
                    stacked
                    headerTrailing={
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                        className="flex shrink-0 items-center gap-1"
                      />
                    }
                  />
                ) : detailInventory ? (
                  <InventoryView inventory={detailInventory} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('clubdesk.inventory.quickContext.emptyTitle')}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('clubdesk.inventory.quickContext.emptyHint')}
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
