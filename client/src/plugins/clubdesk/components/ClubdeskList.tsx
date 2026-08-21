import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  LayoutGrid,
  Plus,
  Settings,
  Tag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
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
import { pathToNavPage } from '@/core/routing/routeMap';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { PublicationStatus } from '../types/clubdesk';
import {
  getInitialClubdeskColumnCount,
  CLUBDESK_COLUMN_COUNT_STORAGE_KEY,
  CLUBDESK_SETTINGS_KEY,
  resolveClubdeskColumnCount,
  type ClubdeskColumnCount,
} from '../utils/clubdeskColumnCount';
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
import {
  getInitialClubdeskListViewMode,
  persistClubdeskListViewModeSession,
  resolveClubdeskListViewMode,
  type ClubdeskListViewMode,
} from '../utils/clubdeskListViewMode';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import { sortCategoryNames } from '../utils/sortCategoryNames';

import { ClubdeskListItem } from './ClubdeskListItem';
import { ClubdeskListTable } from './ClubdeskListTable';
import { ClubdeskInfoView } from './ClubdeskInfoView';
import { ClubdeskSettingsView } from './ClubdeskSettingsView';
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
    updateClubdeskPublicationStatus,
    updateClubdeskFeatured,
    validationErrors,
    reorderClubdesksInCategory,
    isSaving,
    clubdeskContentView,
    clubdeskSettingsTab,
    openClubdeskSettings,
    closeClubdeskSettingsView,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsTab, setSettingsTab] = useState(clubdeskSettingsTab);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [primarySort, setPrimarySort] = useState<ClubdeskSortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<ClubdeskSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<ClubdeskColumnCount>(
    getInitialClubdeskColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<ClubdeskListViewMode>(
    getInitialClubdeskListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<ClubdeskListFilterSelection>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    setSettingsTab(clubdeskSettingsTab);
  }, [clubdeskSettingsTab]);

  useEffect(() => {
    let cancelled = false;
    getSettings(CLUBDESK_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveClubdeskColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveClubdeskListViewMode(settings);
        setListViewModeState(nextView);
        persistClubdeskListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: ClubdeskColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistClubdeskListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(CLUBDESK_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: ClubdeskListViewMode) => {
      setListViewModeState(mode);
      persistClubdeskListViewModeSession(mode);
      updateSettings(CLUBDESK_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: ClubdeskSortField) => {
    setPrimarySort(field);
    setSortOrder(isClubdeskStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: ClubdeskSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isClubdeskAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = listViewMode === 'table';

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

    if (categoryFilter !== 'all' && !isTableView) {
      return [...filtered].sort((a, b) => {
        const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) {
          return ao - bo;
        }
        return (a.title || '').localeCompare(b.title || '', 'sv');
      });
    }

    return [...filtered].sort((a, b) => compareClubdesksByField(a, b, primarySort, sortOrder));
  }, [clubdesk, searchTerm, primarySort, sortOrder, activeFilters, categoryFilter, isTableView]);

  const canReorderCategory =
    !isTableView &&
    categoryFilter !== 'all' &&
    searchTerm.trim() === '' &&
    activeFilters.length === 0;

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
    // sortCategoryNames only appends uncategorized if present in names; namedKeys excludes it
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

  const handleOpenForView = (item: (typeof clubdesk)[0]) => {
    attemptNavigation(() => {
      openClubdeskForView(item);
    });
  };

  const handleStatusChange = (item: (typeof clubdesk)[0], status: PublicationStatus) => {
    void updateClubdeskPublicationStatus(item, status);
  };

  const handleFeaturedChange = (item: (typeof clubdesk)[0], featured: boolean) => {
    void updateClubdeskFeatured(item, featured);
  };

  const handleMoveInCategory = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!canReorderCategory) {
        return;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sortedClubdesks.length) {
        return;
      }
      const orderedIds = sortedClubdesks.map((row) => String(row.id));
      const tmp = orderedIds[index];
      orderedIds[index] = orderedIds[nextIndex];
      orderedIds[nextIndex] = tmp;
      const category = categoryFilter === UNCATEGORIZED_FILTER ? null : String(categoryFilter);
      await reorderClubdesksInCategory(category, orderedIds);
    },
    [canReorderCategory, sortedClubdesks, categoryFilter, reorderClubdesksInCategory],
  );

  const listStatusError = getClubdeskListStatusErrorMessage(validationErrors);

  if (clubdeskContentView === 'settings') {
    return (
      <div className="plugin-clubdesk min-h-full bg-background">
        <div className="px-6 py-4">
          <ClubdeskSettingsView
            selectedTab={settingsTab}
            onSelectedTabChange={setSettingsTab}
            renderTabButtonsInline
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeClubdeskSettingsView}
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
    <div className="plugin-clubdesk h-full min-h-full w-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.clubdesk')}</h2>
            <p className="text-sm text-muted-foreground">{t('clubdesk.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openClubdeskSettings()}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openClubdeskPanel(null))}
            >
              {t('clubdesk.addClubdesk')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ListFilterStatCard
            label={t('clubdesk.filter.all')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('clubdesk.filter.draft')}
            value={stats.draft}
            dotClassName="bg-slate-400"
            active={isFilterActive('draft')}
            onClick={() => toggleFilter('draft')}
          />
          <ListFilterStatCard
            label={t('clubdesk.filter.published')}
            value={stats.published}
            dotClassName="bg-emerald-500"
            active={isFilterActive('published')}
            onClick={() => toggleFilter('published')}
          />
        </div>

        {categoryOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
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
          </div>
        ) : null}

        {listStatusError ? (
          <p className="text-sm text-destructive" role="alert">
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

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedClubdesks.length > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={onToggleAllVisible}
              >
                {t('common.selectAll')}
              </Button>
            }
            search={
              <ListSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('clubdesk.searchPlaceholder', {
                  count: clubdesk.length,
                })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) => handlePrimarySortChange(value as ClubdeskSortField)}
                    >
                      <SelectTrigger
                        className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                        aria-label={t('clubdesk.sortBy')}
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
                            {t(option.labelKey)}
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
                      aria-label={
                        sortOrder === 'asc' ? t('clubdesk.sortDesc') : t('clubdesk.sortAsc')
                      }
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
                  columnAriaLabel={(count) => t(`clubdesk.columns${count}`)}
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
                  onClick={clearClubdeskSelection}
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
          ) : isTableView ? (
            <ClubdeskListTable
              clubdesks={sortedClubdesks}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={isSelected}
              onRowClick={handleOpenForView}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={onToggleAllVisible}
              recentlyDuplicatedClubdeskId={recentlyDuplicatedClubdeskId}
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
              {sortedClubdesks.map((item, index) => {
                const itemIsSelected = isSelected(item.id);
                return (
                  <ClubdeskListItem
                    key={item.id}
                    clubdesk={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedClubdeskId === String(item.id)}
                    onClick={() => handleOpenForView(item)}
                    columnCount={columnCount}
                    onStatusChange={(status) => handleStatusChange(item, status)}
                    onFeaturedChange={(featured) => handleFeaturedChange(item, featured)}
                    canReorder={canReorderCategory}
                    reorderDisabled={isSaving}
                    onMoveUp={
                      canReorderCategory ? () => void handleMoveInCategory(index, -1) : undefined
                    }
                    onMoveDown={
                      canReorderCategory ? () => void handleMoveInCategory(index, 1) : undefined
                    }
                    isFirst={index === 0}
                    isLast={index === sortedClubdesks.length - 1}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={itemIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          itemIsSelected
                            ? t('clubdesk.unselectClubdesk')
                            : t('clubdesk.selectClubdesk')
                        }
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
                {t('clubdesk.showingCount', {
                  shown: sortedClubdesks.length,
                  total: clubdesk.length,
                })}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
