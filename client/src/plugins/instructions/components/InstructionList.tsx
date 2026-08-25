import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  LayoutGrid,
  Plus,
  Settings,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useInstructions } from '../hooks/useInstructions';
import type { PublicationStatus } from '../types/instructions';
import {
  getInitialInstructionColumnCount,
  INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY,
  INSTRUCTIONS_SETTINGS_KEY,
  resolveInstructionColumnCount,
  type InstructionColumnCount,
} from '../utils/instructionColumnCount';
import {
  instructionMatchesListFilters,
  toggleInstructionListFilter,
  type InstructionListFilter,
  type InstructionListFilterSelection,
} from '../utils/instructionListFilter';
import {
  compareInstructionsByField,
  isInstructionAscDefaultField,
  isInstructionStringSortField,
  type InstructionSortField,
  type InstructionSortOrder,
} from '../utils/instructionListSort';
import {
  getInitialInstructionListViewMode,
  persistInstructionListViewModeSession,
  resolveInstructionListViewMode,
  type InstructionListViewMode,
} from '../utils/instructionListViewMode';
import { getInstructionListStatusErrorMessage } from '../utils/instructionListStatusError';
import { sortCategoryNames } from '../utils/sortCategoryNames';

import { InstructionListItem } from './InstructionListItem';
import { InstructionListTable } from './InstructionListTable';
import { InstructionSettingsView } from './InstructionSettingsView';

const UNCATEGORIZED_FILTER = '__uncategorized__';

type CategoryFilter = 'all' | typeof UNCATEGORIZED_FILTER | string;

function instructionCategoryKey(category: string | null | undefined): string {
  const trimmed = (category || '').trim();
  return trimmed ? trimmed : UNCATEGORIZED_FILTER;
}
const SORT_FIELD_OPTIONS: { value: InstructionSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'instructions.sort.updated' },
  { value: 'title', labelKey: 'instructions.sort.title' },
  { value: 'createdAt', labelKey: 'instructions.sort.created' },
  { value: 'publicationStatus', labelKey: 'instructions.sort.status' },
];

export const InstructionList: React.FC = () => {
  const { t } = useTranslation();
  const {
    instructions,
    categories,
    openInstructionForView,
    deleteInstructions,
    selectedInstructionIds,
    toggleInstructionSelected,
    mergeIntoInstructionSelection,
    selectAllInstructions,
    clearInstructionSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedInstructionId,
    openInstructionPanel,
    updateInstructionPublicationStatus,
    validationErrors,
    reorderInstructionsInCategory,
    isSaving,
    instructionsContentView,
    instructionsSettingsTab,
    openInstructionSettings,
    closeInstructionSettingsView,
  } = useInstructions();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openInstructionPanel(null)),
    onSettings: () => openInstructionSettings(),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsTab, setSettingsTab] = useState(instructionsSettingsTab);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [primarySort, setPrimarySort] = useState<InstructionSortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<InstructionSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<InstructionColumnCount>(
    getInitialInstructionColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<InstructionListViewMode>(
    getInitialInstructionListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<InstructionListFilterSelection>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    setSettingsTab(instructionsSettingsTab);
  }, [instructionsSettingsTab]);

  useEffect(() => {
    let cancelled = false;
    getSettings(INSTRUCTIONS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveInstructionColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveInstructionListViewMode(settings);
        setListViewModeState(nextView);
        persistInstructionListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: InstructionColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistInstructionListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(INSTRUCTIONS_SETTINGS_KEY, {
        columnCount: count,
        listViewMode: 'cards',
      }).catch(() => {});
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: InstructionListViewMode) => {
      setListViewModeState(mode);
      persistInstructionListViewModeSession(mode);
      updateSettings(INSTRUCTIONS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: InstructionSortField) => {
    setPrimarySort(field);
    setSortOrder(isInstructionStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: InstructionSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isInstructionAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const catalogOrder = useMemo(() => categories.map((c) => c.name), [categories]);

  const sortedInstructions = useMemo(() => {
    const byFilter = instructions.filter((item) =>
      instructionMatchesListFilters(item, activeFilters),
    );

    const byCategory =
      categoryFilter === 'all'
        ? byFilter
        : byFilter.filter((item) => instructionCategoryKey(item.category) === categoryFilter);

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

    return [...filtered].sort((a, b) => compareInstructionsByField(a, b, primarySort, sortOrder));
  }, [
    instructions,
    searchTerm,
    primarySort,
    sortOrder,
    activeFilters,
    categoryFilter,
    isTableView,
  ]);

  const canReorderCategory =
    !isTableView &&
    categoryFilter !== 'all' &&
    searchTerm.trim() === '' &&
    activeFilters.length === 0;

  const isFilterActive = (filter: InstructionListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: InstructionListFilter) => {
    setActiveFilters((prev) => toggleInstructionListFilter(prev, filter));
  };

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of instructions) {
      const key = instructionCategoryKey(item.category);
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
  }, [instructions, catalogOrder]);

  const visibleIds = useMemo(
    () => sortedInstructions.map((item) => String(item.id)),
    [sortedInstructions],
  );

  const stats = useMemo(
    () => ({
      total: instructions.length,
      draft: instructions.filter((i) => i.publicationStatus === 'draft').length,
      published: instructions.filter((i) => i.publicationStatus === 'published').length,
    }),
    [instructions],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoInstructionSelection,
      toggleOne: toggleInstructionSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedInstructionIds.filter((id) => !set.has(id));
      selectAllInstructions(remaining);
    } else {
      const union = Array.from(new Set([...selectedInstructionIds, ...visibleIds]));
      selectAllInstructions(union);
    }
  }, [allVisibleSelected, visibleIds, selectedInstructionIds, selectAllInstructions]);

  const handleBulkDelete = async () => {
    if (selectedInstructionIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteInstructions(selectedInstructionIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: (typeof instructions)[0]) => {
    attemptNavigation(() => {
      openInstructionForView(item);
    });
  };

  const handleStatusChange = (item: (typeof instructions)[0], status: PublicationStatus) => {
    void updateInstructionPublicationStatus(item, status);
  };

  const handleMoveInCategory = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!canReorderCategory) {
        return;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sortedInstructions.length) {
        return;
      }
      const orderedIds = sortedInstructions.map((row) => String(row.id));
      const tmp = orderedIds[index];
      orderedIds[index] = orderedIds[nextIndex];
      orderedIds[nextIndex] = tmp;
      const category = categoryFilter === UNCATEGORIZED_FILTER ? null : String(categoryFilter);
      await reorderInstructionsInCategory(category, orderedIds);
    },
    [canReorderCategory, sortedInstructions, categoryFilter, reorderInstructionsInCategory],
  );

  const listStatusError = getInstructionListStatusErrorMessage(validationErrors);

  if (instructionsContentView === 'settings') {
    return (
      <div className="plugin-instructions min-h-full bg-background">
        <div className="px-6 py-4">
          <InstructionSettingsView
            selectedTab={settingsTab}
            onSelectedTabChange={setSettingsTab}
            renderTabButtonsInline
            onClose={closeInstructionSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-instructions min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('nav.instructions')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('instructions.listDescription')}</p>
          </div>
          <div className="flex w-full flex-shrink-0 items-center gap-2 md:w-auto md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={() => openInstructionSettings()}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openInstructionPanel(null))}
            >
              {t('instructions.addInstruction')}
            </Button>
          </div>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-3')}>
          <ListFilterStatCard
            label={t('instructions.filter.all')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('instructions.filter.draft')}
            value={stats.draft}
            dotClassName="bg-slate-400"
            active={isFilterActive('draft')}
            onClick={() => toggleFilter('draft')}
          />
          <ListFilterStatCard
            label={t('instructions.filter.published')}
            value={stats.published}
            dotClassName="bg-emerald-500"
            active={isFilterActive('published')}
            onClick={() => toggleFilter('published')}
          />
        </div>

        {categoryOptions.length > 0 ? (
          <div className={LIST_FILTER_CHIP_ROW_CLASS}>
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
                {t('instructions.filter.all')}{' '}
                <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            {categoryOptions.map((option) => {
              const isActive = categoryFilter === option.key;
              const label =
                option.key === UNCATEGORIZED_FILTER ? t('instructions.uncategorized') : option.key;
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
          itemLabel="instructions"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-0 md:gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedInstructions.length > 0}
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
                placeholder={t('instructions.searchPlaceholder', {
                  count: instructions.length,
                })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) =>
                        handlePrimarySortChange(value as InstructionSortField)
                      }
                    >
                      <SelectTrigger
                        className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                        aria-label={t('instructions.sortBy')}
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
                        sortOrder === 'asc' ? t('instructions.sortDesc') : t('instructions.sortAsc')
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
                  columnAriaLabel={(count) => t(`instructions.columns${count}`)}
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
                  onClick={clearInstructionSelection}
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

          {sortedInstructions.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm || activeFilters.length > 0 || categoryFilter !== 'all'
                  ? t('instructions.noMatch')
                  : t('instructions.noYet')
              }
              createLabel={
                !searchTerm && activeFilters.length === 0 && categoryFilter === 'all'
                  ? t('instructions.addInstruction')
                  : undefined
              }
              onCreate={
                !searchTerm && activeFilters.length === 0 && categoryFilter === 'all'
                  ? () => attemptNavigation(() => openInstructionPanel(null))
                  : undefined
              }
            />
          ) : isTableView ? (
            <InstructionListTable
              instructions={sortedInstructions}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={isSelected}
              onRowClick={handleOpenForView}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={onToggleAllVisible}
              recentlyDuplicatedInstructionId={recentlyDuplicatedInstructionId}
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
              {sortedInstructions.map((item, index) => {
                const itemIsSelected = isSelected(item.id);
                return (
                  <InstructionListItem
                    key={item.id}
                    instruction={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedInstructionId === String(item.id)}
                    onClick={() => handleOpenForView(item)}
                    columnCount={effectiveCardColumnCount}
                    onStatusChange={(status) => handleStatusChange(item, status)}
                    canReorder={canReorderCategory}
                    reorderDisabled={isSaving}
                    onMoveUp={
                      canReorderCategory ? () => void handleMoveInCategory(index, -1) : undefined
                    }
                    onMoveDown={
                      canReorderCategory ? () => void handleMoveInCategory(index, 1) : undefined
                    }
                    isFirst={index === 0}
                    isLast={index === sortedInstructions.length - 1}
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
                            ? t('instructions.unselectInstruction')
                            : t('instructions.selectInstruction')
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
                {t('instructions.showingCount', {
                  shown: sortedInstructions.length,
                  total: instructions.length,
                })}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
