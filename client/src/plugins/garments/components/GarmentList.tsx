import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Package,
  Plus,
  Search,
  Settings,
  Shirt,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
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
import { garmentListMatchesSearch, inventoryItemMatchesSearch } from '../utils/garmentListFilter';
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

import { GarmentListItem } from './GarmentListItem';
import { GarmentListTable } from './GarmentListTable';
import { GarmentSettingsView } from './GarmentSettingsView';
import { InventoryListItem } from './InventoryListItem';
import { InventoryListTable } from './InventoryListTable';

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
  { value: 'quantity', labelKey: 'garments.quantity' },
];

export const GarmentList: React.FC = () => {
  const { t } = useTranslation();
  const {
    garmentLists,
    inventoryItems,
    garmentsContentView,
    openGarmentPanel,
    openGarmentForView,
    openInventoryPanel,
    openInventoryForView,
    openGarmentsSettings,
    closeGarmentSettingsView,
    openGarmentsInventory,
    openGarmentsLists,
    deleteGarments,
    deleteInventoryItems,
  } = useGarments();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const isInventory = garmentsContentView === 'inventory';

  const [searchTerm, setSearchTerm] = useState('');
  const [listSort, setListSort] = useState<GarmentSortField>('updatedAt');
  const [inventorySort, setInventorySort] = useState<InventorySortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<GarmentSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<GarmentColumnCount>(
    getInitialGarmentColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<GarmentListViewMode>(
    getInitialGarmentListViewMode,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setSearchTerm('');
  }, [garmentsContentView]);

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const hasColumnPref = settingsHasGarmentColumnPreference(settings);
        const hasListViewPref = isGarmentListViewMode(settings?.listViewMode);
        if (!hasColumnPref && !hasListViewPref) {
          return;
        }
        if (hasColumnPref) {
          const next = resolveGarmentColumnCount(settings);
          setColumnCountState(next);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY, String(next));
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
    (count: GarmentColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistGarmentListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(GARMENTS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
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

  const isTableView = listViewMode === 'table';

  const filteredLists = useMemo(() => {
    const filtered = garmentLists.filter((item) => garmentListMatchesSearch(item, searchTerm));
    return [...filtered].sort((a, b) => compareGarmentListsByField(a, b, listSort, sortOrder));
  }, [garmentLists, searchTerm, listSort, sortOrder]);

  const filteredInventory = useMemo(() => {
    const filtered = inventoryItems.filter((item) => inventoryItemMatchesSearch(item, searchTerm));
    return [...filtered].sort((a, b) => compareInventoryByField(a, b, inventorySort, sortOrder));
  }, [inventoryItems, searchTerm, inventorySort, sortOrder]);

  const visibleIds = useMemo(
    () => (isInventory ? filteredInventory : filteredLists).map((item) => String(item.id)),
    [filteredInventory, filteredLists, isInventory],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);
  const selectedCount = selectedIds.length;

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

  const handleOpenInventory = (item: InventoryItem) => {
    attemptNavigation(() => openInventoryForView(item));
  };

  if (garmentsContentView === 'settings') {
    return (
      <div className="plugin-garments min-h-full bg-background">
        <div className="px-6 py-4">
          <GarmentSettingsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeGarmentSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const totalCount = isInventory ? inventoryItems.length : garmentLists.length;
  const filteredCount = isInventory ? filteredInventory.length : filteredLists.length;

  return (
    <div className="plugin-garments min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.garments')}</h2>
            <p className="text-sm text-muted-foreground">
              {isInventory
                ? t('garments.inventoryCount', { count: totalCount })
                : t('garments.listCount', { count: totalCount })}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant={garmentsContentView === 'lists' ? 'secondary' : 'ghost'}
              size="sm"
              icon={Shirt}
              className="h-9 px-2.5 text-xs"
              onClick={openGarmentsLists}
            >
              {t('garments.listsTab')}
            </Button>
            <Button
              variant={isInventory ? 'secondary' : 'ghost'}
              size="sm"
              icon={Package}
              className="h-9 px-2.5 text-xs"
              onClick={openGarmentsInventory}
            >
              {t('garments.inventoryTab')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openGarmentsSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() =>
                attemptNavigation(() =>
                  isInventory ? openInventoryPanel(null) : openGarmentPanel(null),
                )
              }
            >
              {isInventory ? t('garments.addInventory') : t('garments.addList')}
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

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={filteredCount > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={handleHeaderCheckboxChange}
              >
                {t('common.selectAll')}
              </Button>
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={
                    isInventory ? t('garments.searchInventory') : t('garments.searchLists')
                  }
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    {isInventory ? (
                      <Select
                        value={inventorySort}
                        onValueChange={(value) =>
                          handleInventorySortChange(value as InventorySortField)
                        }
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
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => t('garments.columnsAria', { count })}
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
                  onClick={clearSelection}
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

          {filteredCount === 0 ? (
            <ListEmptyState
              message={
                searchTerm
                  ? t('garments.noSearchResults')
                  : isInventory
                    ? t('garments.noInventoryYet')
                    : t('garments.noListsYet')
              }
              createLabel={
                !searchTerm
                  ? isInventory
                    ? t('garments.addInventory')
                    : t('garments.addList')
                  : undefined
              }
              onCreate={
                !searchTerm
                  ? () =>
                      attemptNavigation(() =>
                        isInventory ? openInventoryPanel(null) : openGarmentPanel(null),
                      )
                  : undefined
              }
            />
          ) : isInventory ? (
            isTableView ? (
              <InventoryListTable
                items={filteredInventory}
                primarySort={inventorySort}
                sortOrder={sortOrder}
                onSort={handleTableSortInventory}
                isSelected={isSelected}
                onRowClick={handleOpenInventory}
                onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                onCheckboxChange={onVisibleRowCheckboxChange}
                allVisibleSelected={allVisibleSelected}
                onHeaderCheckboxChange={handleHeaderCheckboxChange}
              />
            ) : (
              <div
                className={cn(
                  'grid gap-3',
                  columnCount === 1 && 'grid-cols-1',
                  columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                  columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
                )}
              >
                {filteredInventory.map((item, index) => {
                  const itemIsSelected = isSelected(String(item.id));
                  return (
                    <InventoryListItem
                      key={item.id}
                      item={item}
                      selected={itemIsSelected}
                      onClick={() => handleOpenInventory(item)}
                      columnCount={columnCount}
                      checkbox={
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
                      }
                    />
                  );
                })}
              </div>
            )
          ) : isTableView ? (
            <GarmentListTable
              items={filteredLists}
              primarySort={listSort}
              sortOrder={sortOrder}
              onSort={handleTableSortList}
              isSelected={isSelected}
              onRowClick={handleOpenList}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredLists.map((item, index) => {
                const itemIsSelected = isSelected(String(item.id));
                return (
                  <GarmentListItem
                    key={item.id}
                    item={item}
                    selected={itemIsSelected}
                    onClick={() => handleOpenList(item)}
                    columnCount={columnCount}
                    checkbox={
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
    </div>
  );
};
