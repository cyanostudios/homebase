import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  FileText,
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { nextListTableSort } from '@/core/list/listViewMode';
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
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
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
import { getInstructionListStatusErrorMessage } from '../utils/instructionListStatusError';
import {
  getInitialInstructionListViewMode,
  persistInstructionListViewModeSession,
  resolveInstructionListViewMode,
  type InstructionListViewMode,
} from '../utils/instructionListViewMode';
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

  const { searchTerm, setSearchTerm } = usePersistedListSearch('instructions');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsTab, setSettingsTab] = useState(instructionsSettingsTab);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('instructions.searchPlaceholder', {
      count: instructions.length,
    }),
  });

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [primarySort, setPrimarySort] = useState<InstructionSortField>('title');
  const [sortOrder, setSortOrder] = useState<InstructionSortOrder>('asc');
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
        const resolved = resolveInstructionColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as InstructionColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(INSTRUCTIONS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
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
    (_count: InstructionColumnCount) => {
      const next = 3 as InstructionColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistInstructionListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(INSTRUCTIONS_SETTINGS_KEY, {
        columnCount: next,
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

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearInstructionSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: (typeof instructions)[0]) => {
    if (selectionMode) {
      toggleInstructionSelected(String(item.id));
      return;
    }
    handleOpenForView(item);
  };

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
    <div className={cn('plugin-instructions', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.instructions')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={() => openInstructionSettings()}
                  />
                  {sortedInstructions.length > 0 ? (
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
                placeholder={t('instructions.searchPlaceholder', {
                  count: instructions.length,
                })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`instructions.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('instructions.addInstruction')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openInstructionPanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
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
                {t('instructions.filter.all')}{' '}
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
                {t('instructions.filter.draft')}{' '}
                <span className="tabular-nums font-semibold">({stats.draft})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('published')}
              className={cn(
                isFilterActive('published')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('instructions.filter.published')}{' '}
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
                    categoryFilter === 'all'
                      ? LIST_FILTER_CHIP_ACTIVE_CLASS
                      : LIST_FILTER_CHIP_CLASS,
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
                    option.key === UNCATEGORIZED_FILTER
                      ? t('instructions.uncategorized')
                      : option.key;
                  return (
                    <Button
                      key={option.key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCategoryFilter(isActive ? 'all' : option.key)}
                      className={cn(
                        isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                      )}
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
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as InstructionSortField)}
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
        </div>

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

        <div className="flex flex-col gap-3">
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
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={onToggleAllVisible}
              recentlyDuplicatedInstructionId={recentlyDuplicatedInstructionId}
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
              {sortedInstructions.map((item, index) => {
                const itemIsSelected = isSelected(item.id);
                return (
                  <InstructionListItem
                    key={item.id}
                    instruction={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedInstructionId === String(item.id)}
                    onClick={() => handleRowActivate(item)}
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
                      selectionMode ? (
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
                      ) : undefined
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
