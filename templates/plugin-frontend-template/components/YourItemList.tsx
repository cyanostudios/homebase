import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Plus,
  Search,
  Settings,
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

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';
import {
  getInitialYourItemColumnCount,
  resolveYourItemColumnCount,
  settingsHasYourItemColumnPreference,
  YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY,
  YOUR_ITEMS_SETTINGS_KEY,
  type YourItemColumnCount,
} from '../utils/yourItemColumnCount';
import {
  compareYourItemsByField,
  isYourItemAscDefaultField,
  type YourItemSortField,
  type YourItemSortOrder,
} from '../utils/yourItemListSort';
import {
  getInitialYourItemListViewMode,
  isYourItemListViewMode,
  persistYourItemListViewModeSession,
  resolveYourItemListViewMode,
  type YourItemListViewMode,
} from '../utils/yourItemListViewMode';

import { YourItemListItem } from './YourItemListItem';
import { YourItemListTable } from './YourItemListTable';
import { YourItemsSettingsView } from './YourItemsSettingsView';

const SORT_FIELD_OPTIONS: { value: YourItemSortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'createdAt', label: 'Created' },
  { value: 'id', label: 'ID' },
];

export const YourItemList: React.FC = () => {
  const { t } = useTranslation();
  const {
    yourItems,
    yourItemsContentView,
    openYourItemPanel,
    openYourItemForView,
    openYourItemsSettings,
    closeYourItemsSettingsView,
    deleteYourItems,
  } = useYourItems();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<YourItemSortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<YourItemSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<YourItemColumnCount>(
    getInitialYourItemColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<YourItemListViewMode>(
    getInitialYourItemListViewMode,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(YOUR_ITEMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const hasColumnPref = settingsHasYourItemColumnPreference(settings);
        const hasListViewPref = isYourItemListViewMode(settings?.listViewMode);
        if (!hasColumnPref && !hasListViewPref) {
          return;
        }
        if (hasColumnPref) {
          const next = resolveYourItemColumnCount(settings);
          setColumnCountState(next);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY, String(next));
          }
        }
        if (hasListViewPref) {
          const nextView = resolveYourItemListViewMode(settings);
          setListViewModeState(nextView);
          persistYourItemListViewModeSession(nextView);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: YourItemColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistYourItemListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(YOUR_ITEMS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: YourItemListViewMode) => {
      setListViewModeState(mode);
      persistYourItemListViewModeSession(mode);
      updateSettings(YOUR_ITEMS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: YourItemSortField) => {
    setPrimarySort(field);
    setSortOrder(isYourItemAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: YourItemSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isYourItemAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = listViewMode === 'table';

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = yourItems.filter((item) => {
      if (!needle) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(needle) || String(item.id).toLowerCase().includes(needle)
      );
    });
    return [...filtered].sort((a, b) => compareYourItemsByField(a, b, primarySort, sortOrder));
  }, [yourItems, searchTerm, primarySort, sortOrder]);

  const visibleIds = useMemo(
    () => filteredAndSorted.map((item) => String(item.id)),
    [filteredAndSorted],
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
      await deleteYourItems(selectedIds);
      clearSelection();
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: YourItem) => {
    attemptNavigation(() => openYourItemForView(item));
  };

  if (yourItemsContentView === 'settings') {
    return (
      <div className="plugin-your-items min-h-full bg-background">
        <div className="px-6 py-4">
          <YourItemsSettingsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeYourItemsSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-your-items min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">Your items</h2>
            <p className="text-sm text-muted-foreground">{yourItems.length} items</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openYourItemsSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openYourItemPanel(null))}
            >
              Add item
            </Button>
          </div>
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="items"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={filteredAndSorted.length > 0}
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
                  placeholder="Search by title or id..."
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) => handlePrimarySortChange(value as YourItemSortField)}
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
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => `${count} columns`}
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

          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm ? 'No items match your search.' : 'No items yet.'}
              createLabel={!searchTerm ? 'Add item' : undefined}
              onCreate={
                !searchTerm ? () => attemptNavigation(() => openYourItemPanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <YourItemListTable
              items={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={isSelected}
              onRowClick={handleOpenForView}
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
              {filteredAndSorted.map((item, index) => {
                const itemIsSelected = isSelected(String(item.id));
                return (
                  <YourItemListItem
                    key={item.id}
                    item={item}
                    selected={itemIsSelected}
                    onClick={() => handleOpenForView(item)}
                    columnCount={columnCount}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={itemIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(String(item.id))}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={itemIsSelected ? 'Unselect item' : 'Select item'}
                      />
                    }
                  />
                );
              })}
            </div>
          )}

          <ListFooterBar
            meta={
              <>
                Showing {filteredAndSorted.length} of {yourItems.length}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
