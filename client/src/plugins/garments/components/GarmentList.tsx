import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  LayoutGrid,
  Plus,
  Settings,
  Shirt,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

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
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
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
import { pathToNavPage } from '@/core/routing/routeMap';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList as GarmentListModel, InventoryItem } from '../types/garments';
import {
  getInitialGarmentColumnCount,
  resolveGarmentColumnCount,
  settingsHasGarmentColumnPreference,
  GARMENTS_COLUMN_COUNT_STORAGE_KEY,
  GARMENTS_SETTINGS_KEY,
  type GarmentColumnCount,
} from '../utils/garmentColumnCount';
import {
  countInventoryItemsWithTag,
  garmentListMatchesSearch,
  inventoryItemMatchesSearch,
  inventoryItemMatchesTagFilter,
} from '../utils/garmentListFilter';
import { normalizeInventoryTags } from '../utils/inventoryTags';
import {
  compareGarmentListsByField,
  compareInventoryByField,
  isGarmentAscDefaultField,
  isInventoryAscDefaultField,
  type GarmentSortField,
  type GarmentSortOrder,
  type InventorySortField,
} from '../utils/garmentListSort';
import {
  getInitialGarmentListViewMode,
  isGarmentListViewMode,
  persistGarmentListViewModeSession,
  resolveGarmentListViewMode,
  type GarmentListViewMode,
} from '../utils/garmentListViewMode';
import {
  resolveVisibleInventoryTableColumns,
  type InventoryTableColumnId,
} from '../utils/inventoryTableColumns';

import { GarmentListItem } from './GarmentListItem';
import {
  GarmentsInventorySettingsView,
  type GarmentsInventorySettingsCategory,
} from './GarmentsInventorySettingsView';
import {
  GarmentsListsSettingsView,
  type GarmentsListsSettingsCategory,
} from './GarmentsListsSettingsView';
import { InventoryBulkListsDialog } from './InventoryBulkListsDialog';
import { InventoryBulkTagsDialog } from './InventoryBulkTagsDialog';
import { GarmentListTable } from './GarmentListTable';
import { InventoryListItem } from './InventoryListItem';
import { InventoryListTable } from './InventoryListTable';
import { InventoryQuickContextPanel } from './InventoryQuickContextPanel';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

const LIST_SORT_OPTIONS: { value: GarmentSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'name', labelKey: 'garments.name' },
  { value: 'personCount', labelKey: 'garments.persons' },
  { value: 'createdAt', labelKey: 'common.created' },
];

const INVENTORY_SORT_OPTIONS: { value: InventorySortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'articleName', labelKey: 'garments.articleName' },
  { value: 'brand', labelKey: 'garments.brand' },
  { value: 'totalQuantity', labelKey: 'garments.totalQuantity' },
  { value: 'variantCount', labelKey: 'garments.variantCount' },
];

export const GarmentList: React.FC = () => {
  const { t } = useTranslation();
  const {
    garmentLists,
    inventoryItems,
    openGarmentPanel,
    openGarmentForView,
    openInventoryPanel,
    openInventoryForView,
    openInventoryForEdit,
    updateInventoryVariantQuantity,
    isSaving,
    deleteGarments,
    deleteInventoryItems,
    assignInventoryItemToList,
    unassignInventoryItemFromList,
    applyTagToInventoryItem,
    clearTagsFromInventoryItem,
    recentlyDuplicatedInventoryId,
    recentlyDuplicatedListId,
    garmentsContentView,
    openGarmentsSettings,
    closeGarmentsSettingsView,
  } = useGarments();
  const location = useLocation();
  const garmentsNavPage = pathToNavPage(location.pathname);
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const isInventory = garmentsNavPage === 'garments-inventory';

  const [inventorySettingsCategory, setInventorySettingsCategory] =
    useState<GarmentsInventorySettingsCategory>('tags');
  const [listsSettingsCategory, setListsSettingsCategory] =
    useState<GarmentsListsSettingsCategory>('customColumns');

  useMobileActions({
    onAdd: () =>
      attemptNavigation(() => (isInventory ? openInventoryPanel(null) : openGarmentPanel(null))),
    onSettings: () => openGarmentsSettings(isInventory ? 'inventory' : 'lists'),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('garments');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: isInventory ? t('garments.searchInventory') : t('garments.searchLists'),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [listSort, setListSort] = useState<GarmentSortField>('updatedAt');
  const [inventorySort, setInventorySort] = useState<InventorySortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<GarmentSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<GarmentColumnCount>(
    getInitialGarmentColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<GarmentListViewMode>(
    getInitialGarmentListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<InventoryTableColumnId[]>(() =>
    resolveVisibleInventoryTableColumns(null),
  );
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [inventoryTagFilter, setInventoryTagFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkListsDialog, setShowBulkListsDialog] = useState(false);
  const [showBulkTagsDialog, setShowBulkTagsDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    previewItem: previewInventory,
    setPreviewItem: setPreviewInventory,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'garments-inventory',
    items: inventoryItems,
    getItemId: (item) => String(item.id),
  });

  useEffect(() => {
    setSelectedIds([]);
    setSearchTerm('');
    setInventoryTagFilter(null);
  }, [garmentsNavPage]);

  useEffect(() => {
    if (!isInventory) {
      setPreviewInventory(null);
    }
  }, [isInventory, setPreviewInventory]);

  useEffect(() => {
    if (inventoryTagFilter && !availableTags.includes(inventoryTagFilter)) {
      setInventoryTagFilter(null);
    }
  }, [availableTags, inventoryTagFilter]);

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setAvailableTags(normalizeInventoryTags(settings?.tags));
        setVisibleColumnIds(resolveVisibleInventoryTableColumns(settings));
        const hasColumnPref = settingsHasGarmentColumnPreference(settings);
        const hasListViewPref = isGarmentListViewMode(settings?.listViewMode);
        if (!hasColumnPref && !hasListViewPref) {
          return;
        }
        if (hasColumnPref) {
          const resolved = resolveGarmentColumnCount(settings);
          const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as GarmentColumnCount;
          setColumnCountState(next);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY, String(next));
          }
          if (next !== resolved) {
            updateSettings(GARMENTS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
          }
        }
        if (hasListViewPref) {
          const nextView = resolveGarmentListViewMode(settings);
          setListViewModeState(nextView);
          persistGarmentListViewModeSession(nextView);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: GarmentColumnCount) => {
      const next = 3 as GarmentColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistGarmentListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(GARMENTS_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: GarmentListViewMode) => {
      setListViewModeState(mode);
      persistGarmentListViewModeSession(mode);
      updateSettings(GARMENTS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handleListSortChange = (field: GarmentSortField) => {
    setListSort(field);
    setSortOrder(isGarmentAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleInventorySortChange = (field: InventorySortField) => {
    setInventorySort(field);
    setSortOrder(isInventoryAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSortList = useCallback(
    (field: GarmentSortField) => {
      const next = nextListTableSort(listSort, sortOrder, field, isGarmentAscDefaultField);
      setListSort(next.field);
      setSortOrder(next.order);
    },
    [listSort, sortOrder],
  );

  const handleTableSortInventory = useCallback(
    (field: InventorySortField) => {
      const next = nextListTableSort(inventorySort, sortOrder, field, isInventoryAscDefaultField);
      setInventorySort(next.field);
      setSortOrder(next.order);
    },
    [inventorySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const quickContextOpen = Boolean(showQuickContext && previewInventory);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const filteredLists = useMemo(() => {
    const filtered = garmentLists.filter((item) => garmentListMatchesSearch(item, searchTerm));
    return [...filtered].sort((a, b) => compareGarmentListsByField(a, b, listSort, sortOrder));
  }, [garmentLists, searchTerm, listSort, sortOrder]);

  const filteredInventory = useMemo(() => {
    const filtered = inventoryItems.filter(
      (item) =>
        inventoryItemMatchesTagFilter(item, inventoryTagFilter) &&
        inventoryItemMatchesSearch(item, searchTerm),
    );
    return [...filtered].sort((a, b) => compareInventoryByField(a, b, inventorySort, sortOrder));
  }, [inventoryItems, inventorySort, inventoryTagFilter, searchTerm, sortOrder]);

  const inventoryTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of availableTags) {
      counts[tag] = countInventoryItemsWithTag(inventoryItems, tag);
    }
    return counts;
  }, [availableTags, inventoryItems]);

  const visibleIds = useMemo(
    () => (isInventory ? filteredInventory : filteredLists).map((item) => String(item.id)),
    [filteredInventory, filteredLists, isInventory],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);
  const selectedCount = selectedIds.length;

  const selectedInventoryItems = useMemo(
    () => inventoryItems.filter((item) => selectedSet.has(String(item.id))),
    [inventoryItems, selectedSet],
  );

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const mergeIntoSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id)),
    [visibleIds, selectedSet],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection,
      toggleOne,
    });

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      setSelectedIds(visibleIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      if (isInventory) {
        await deleteInventoryItems(selectedIds);
      } else {
        await deleteGarments(selectedIds);
      }
      clearSelection();
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenList = (list: GarmentListModel) => {
    attemptNavigation(() => openGarmentForView(list));
  };

  const handleListRowActivate = (list: GarmentListModel) => {
    if (selectionMode) {
      toggleOne(String(list.id));
      return;
    }
    handleOpenList(list);
  };

  const handleOpenInventoryForView = (item: InventoryItem) => {
    markPendingAndOpen(item, () => attemptNavigation(() => openInventoryForView(item)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: InventoryItem) => {
    if (selectionMode) {
      toggleOne(String(item.id));
      return;
    }
    activateRow(item, (next) => attemptNavigation(() => openInventoryForView(next)));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    const actions: BulkActionRoundItem[] = [];
    if (isInventory) {
      actions.push({
        key: 'tags',
        label: t('garments.bulkTagsAction'),
        icon: Tag,
        disabled,
        onClick: () => setShowBulkTagsDialog(true),
      });
      actions.push({
        key: 'lists',
        label: t('garments.bulkListsAction'),
        icon: Shirt,
        disabled,
        onClick: () => setShowBulkListsDialog(true),
      });
    }
    actions.push({
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      disabled,
      tone: 'destructive',
      onClick: () => setShowBulkDeleteModal(true),
    });
    return actions;
  }, [isInventory, selectedCount, t]);

  const totalCount = isInventory ? inventoryItems.length : garmentLists.length;
  const filteredCount = isInventory ? filteredInventory.length : filteredLists.length;

  if (garmentsContentView === 'settings') {
    return (
      <div className="plugin-garments min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          {isInventory ? (
            <GarmentsInventorySettingsView
              selectedCategory={inventorySettingsCategory}
              onSelectedCategoryChange={setInventorySettingsCategory}
              renderCategoryButtonsInline
              onClose={closeGarmentsSettingsView}
            />
          ) : (
            <GarmentsListsSettingsView
              selectedCategory={listsSettingsCategory}
              onSelectedCategoryChange={setListsSettingsCategory}
              renderCategoryButtonsInline
              onClose={closeGarmentsSettingsView}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-garments', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                    {t(isInventory ? 'nav.garments-inventory' : 'nav.garments-lists')}
                  </h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={() => openGarmentsSettings(isInventory ? 'inventory' : 'lists')}
                  />
                  {filteredCount > 0 ? (
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
                placeholder={
                  isInventory ? t('garments.searchInventory') : t('garments.searchLists')
                }
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t('garments.columnsAria', { count })}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={isInventory ? t('garments.addInventory') : t('garments.addList')}
                variant="soft"
                alwaysExpanded
                onClick={() =>
                  attemptNavigation(() =>
                    isInventory ? openInventoryPanel(null) : openGarmentPanel(null),
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            {isInventory ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInventoryTagFilter(null)}
                  className={cn(
                    inventoryTagFilter == null
                      ? LIST_FILTER_CHIP_ACTIVE_CLASS
                      : LIST_FILTER_CHIP_CLASS,
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>
                    {t('garments.filterAll')}{' '}
                    <span className="tabular-nums font-semibold">({inventoryItems.length})</span>
                  </span>
                </Button>
                {availableTags.map((tag) => {
                  const isActive = inventoryTagFilter === tag;
                  return (
                    <Button
                      key={tag}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setInventoryTagFilter(isActive ? null : tag)}
                      className={cn(
                        isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                      )}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>
                        {tag}{' '}
                        <span className="tabular-nums font-semibold">
                          ({inventoryTagCounts[tag] ?? 0})
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </>
            ) : null}
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            {isInventory ? (
              <Select
                value={inventorySort}
                onValueChange={(value) => handleInventorySortChange(value as InventorySortField)}
              >
                <SelectTrigger
                  className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                  aria-label={t('garments.sortBy')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="item-aligned"
                  className="rounded-xl border-border/50 shadow-xl"
                >
                  {INVENTORY_SORT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="rounded-md text-xs"
                    >
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={listSort}
                onValueChange={(value) => handleListSortChange(value as GarmentSortField)}
              >
                <SelectTrigger
                  className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                  aria-label={t('garments.sortBy')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="item-aligned"
                  className="rounded-xl border-border/50 shadow-xl"
                >
                  {LIST_SORT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="rounded-md text-xs"
                    >
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0 text-xs"
              onClick={toggleSortOrder}
              aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
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
          itemLabel={isInventory ? t('garments.inventoryItems') : t('garments.lists')}
          isLoading={deleting}
        />

        {isInventory ? (
          <>
            <InventoryBulkTagsDialog
              isOpen={showBulkTagsDialog}
              onClose={() => setShowBulkTagsDialog(false)}
              selectedItems={selectedInventoryItems}
              availableTags={availableTags}
              applyTagToInventoryItem={applyTagToInventoryItem}
              clearTagsFromInventoryItem={clearTagsFromInventoryItem}
              onSuccess={clearSelection}
            />
            <InventoryBulkListsDialog
              isOpen={showBulkListsDialog}
              onClose={() => setShowBulkListsDialog(false)}
              selectedItems={selectedInventoryItems}
              garmentLists={garmentLists}
              assignInventoryItemToList={assignInventoryItemToList}
              unassignInventoryItemFromList={unassignInventoryItemFromList}
              onSuccess={clearSelection}
            />
          </>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3">
          {isInventory ? (
            <div
              className={cn(
                'grid items-start gap-4',
                showQuickContext && previewInventory ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
              )}
            >
              {showQuickContext && previewInventory ? (
                <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
                  <InventoryQuickContextPanel
                    item={previewInventory}
                    onClose={() => setPreviewInventory(null)}
                    onOpenFullProfile={() => handleOpenInventoryForView(previewInventory)}
                    onEdit={() => {
                      markPendingAndOpen(previewInventory, () =>
                        attemptNavigation(() => openInventoryForEdit(previewInventory)),
                      );
                    }}
                    onVariantQuantityChange={async (variantId, quantity) => {
                      await updateInventoryVariantQuantity(
                        previewInventory.id,
                        variantId,
                        quantity,
                      );
                    }}
                    quantitySaving={isSaving}
                  />
                </aside>
              ) : null}
              <div className="flex min-w-0 flex-col gap-3">
                {filteredCount === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm ? t('garments.noSearchResults') : t('garments.noInventoryYet')
                    }
                    createLabel={!searchTerm ? t('garments.addInventory') : undefined}
                    onCreate={
                      !searchTerm
                        ? () => attemptNavigation(() => openInventoryPanel(null))
                        : undefined
                    }
                  />
                ) : isTableView ? (
                  <InventoryListTable
                    items={filteredInventory}
                    primarySort={inventorySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSortInventory}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    selectionEnabled={selectionMode}
                    activeInventoryId={previewInventory?.id ?? null}
                    recentlyDuplicatedInventoryId={recentlyDuplicatedInventoryId}
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
                    {filteredInventory.map((item, index) => {
                      const itemIsSelected = isSelected(String(item.id));
                      return (
                        <InventoryListItem
                          key={item.id}
                          item={item}
                          selected={itemIsSelected}
                          highlighted={recentlyDuplicatedInventoryId === String(item.id)}
                          active={
                            previewInventory !== null &&
                            String(previewInventory.id) === String(item.id)
                          }
                          onClick={() => handleRowActivate(item)}
                          columnCount={effectiveCardColumnCount}
                          checkbox={
                            selectionMode ? (
                              <input
                                type="checkbox"
                                checked={itemIsSelected}
                                onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                                onChange={() => onVisibleRowCheckboxChange(String(item.id))}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 cursor-pointer"
                                aria-label={
                                  itemIsSelected ? t('common.unselectRow') : t('common.selectRow')
                                }
                              />
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
                <ListFooterBar
                  meta={<>{t('garments.showingOf', { shown: filteredCount, total: totalCount })}</>}
                />
              </div>
            </div>
          ) : filteredCount === 0 ? (
            <ListEmptyState
              message={searchTerm ? t('garments.noSearchResults') : t('garments.noListsYet')}
              createLabel={!searchTerm ? t('garments.addList') : undefined}
              onCreate={
                !searchTerm ? () => attemptNavigation(() => openGarmentPanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <GarmentListTable
              items={filteredLists}
              primarySort={listSort}
              sortOrder={sortOrder}
              onSort={handleTableSortList}
              isSelected={isSelected}
              onRowClick={handleListRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              recentlyDuplicatedListId={recentlyDuplicatedListId}
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
              {filteredLists.map((item, index) => {
                const itemIsSelected = isSelected(String(item.id));
                return (
                  <GarmentListItem
                    key={item.id}
                    item={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedListId === String(item.id)}
                    onClick={() => handleListRowActivate(item)}
                    columnCount={effectiveCardColumnCount}
                    checkbox={
                      selectionMode ? (
                        <input
                          type="checkbox"
                          checked={itemIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(String(item.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={
                            itemIsSelected ? t('common.unselectRow') : t('common.selectRow')
                          }
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )}

          {!isInventory ? (
            <ListFooterBar
              meta={<>{t('garments.showingOf', { shown: filteredCount, total: totalCount })}</>}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
