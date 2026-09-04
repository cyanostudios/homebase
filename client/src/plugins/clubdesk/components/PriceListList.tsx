import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  FileText,
  LayoutGrid,
  Plus,
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

import { useClubdesk } from '../hooks/useClubdesk';
import type { PublicationStatus } from '../types/clubdesk';
import {
  getInitialClubdeskColumnCount,
  CLUBDESK_COLUMN_COUNT_STORAGE_KEY,
  CLUBDESK_SETTINGS_KEY,
  resolveClubdeskColumnCount,
  type ClubdeskColumnCount,
} from '../utils/clubdeskColumnCount';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import {
  priceListMatchesListFilters,
  togglePriceListListFilter,
  type PriceListListFilter,
  type PriceListListFilterSelection,
} from '../utils/priceListListFilter';
import {
  getInitialClubdeskListViewMode,
  persistClubdeskListViewModeSession,
  resolveClubdeskListViewMode,
  type ClubdeskListViewMode,
} from '../utils/clubdeskListViewMode';
import {
  comparePriceListsByField,
  isPriceListAscDefaultField,
  type PriceListSortField,
  type PriceListSortOrder,
} from '../utils/priceListListSort';

import { PriceListListItem } from './PriceListListItem';
import { PriceListListTable } from './PriceListListTable';

const SORT_FIELD_OPTIONS: { value: PriceListSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'clubdesk.sort.updated' },
  { value: 'title', labelKey: 'clubdesk.sort.title' },
  { value: 'createdAt', labelKey: 'clubdesk.sort.created' },
  { value: 'publicationStatus', labelKey: 'clubdesk.sort.status' },
  { value: 'currency', labelKey: 'clubdesk.priceList.currency' },
  { value: 'itemCount', labelKey: 'clubdesk.priceList.itemsCard' },
];

export const PriceListList: React.FC = () => {
  const { t } = useTranslation();
  const {
    priceLists,
    openPriceListForView,
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
    updatePriceListPublicationStatus,
    updatePriceListFeatured,
    validationErrors,
    reorderPriceLists,
    isSaving,
  } = useClubdesk();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openPriceListPanel(null)),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('clubdesk-pricelists');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('clubdesk.priceList.searchPlaceholder', {
      count: priceLists.length,
    }),
  });

  const [primarySort, setPrimarySort] = useState<PriceListSortField>('title');
  const [sortOrder, setSortOrder] = useState<PriceListSortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<ClubdeskColumnCount>(
    getInitialClubdeskColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<ClubdeskListViewMode>(
    getInitialClubdeskListViewMode,
  );

  const [activeFilters, setActiveFilters] = useState<PriceListListFilterSelection>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(CLUBDESK_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveClubdeskColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as ClubdeskColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(CLUBDESK_SETTINGS_KEY, { columnCount: next }).catch(() => {});
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
    (_count: ClubdeskColumnCount) => {
      const next = 3 as ClubdeskColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistClubdeskListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(CLUBDESK_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
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

  const handlePrimarySortChange = (field: PriceListSortField) => {
    setPrimarySort(field);
    setSortOrder(isPriceListAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: PriceListSortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isPriceListAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

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

    if (!isTableView && searchTerm.trim() === '' && activeFilters.length === 0) {
      return [...filtered].sort((a, b) => {
        const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) {
          return ao - bo;
        }
        return (a.title || '').localeCompare(b.title || '', 'sv');
      });
    }

    return [...filtered].sort((a, b) => comparePriceListsByField(a, b, primarySort, sortOrder));
  }, [priceLists, searchTerm, primarySort, sortOrder, activeFilters, isTableView]);

  const canReorder = !isTableView && searchTerm.trim() === '' && activeFilters.length === 0;

  const isFilterActive = (filter: PriceListListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: PriceListListFilter) => {
    setActiveFilters((prev) => togglePriceListListFilter(prev, filter));
  };

  const visibleIds = useMemo(
    () => sortedPriceLists.map((item) => String(item.id)),
    [sortedPriceLists],
  );

  const stats = useMemo(
    () => ({
      total: priceLists.length,
      draft: priceLists.filter((i) => i.publicationStatus === 'draft').length,
      published: priceLists.filter((i) => i.publicationStatus === 'published').length,
    }),
    [priceLists],
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

  const handleOpenForView = (item: (typeof priceLists)[0]) => {
    attemptNavigation(() => {
      openPriceListForView(item);
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearPriceListSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: (typeof priceLists)[0]) => {
    if (selectionMode) {
      togglePriceListSelected(String(item.id));
      return;
    }
    handleOpenForView(item);
  };

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

  const handleStatusChange = (item: (typeof priceLists)[0], status: PublicationStatus) => {
    void updatePriceListPublicationStatus(item, status);
  };

  const handleFeaturedChange = (item: (typeof priceLists)[0], featured: boolean) => {
    void updatePriceListFeatured(item, featured);
  };

  const handleMove = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!canReorder) {
        return;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sortedPriceLists.length) {
        return;
      }
      const orderedIds = sortedPriceLists.map((row) => String(row.id));
      const tmp = orderedIds[index];
      orderedIds[index] = orderedIds[nextIndex];
      orderedIds[nextIndex] = tmp;
      await reorderPriceLists(orderedIds);
    },
    [canReorder, sortedPriceLists, reorderPriceLists],
  );

  const listStatusError = getClubdeskListStatusErrorMessage(validationErrors);

  return (
    <div className={cn('plugin-clubdesk', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.clubdesk')}</h2>
                  {sortedPriceLists.length > 0 ? (
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
                  selectedCount={priceListSelectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('clubdesk.priceList.searchPlaceholder', {
                  count: priceLists.length,
                })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`clubdesk.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('clubdesk.priceList.add')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openPriceListPanel(null))}
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
                isFilterActive('published')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('clubdesk.filter.published')}{' '}
                <span className="tabular-nums font-semibold">({stats.published})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as PriceListSortField)}
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
              aria-label={sortOrder === 'asc' ? t('clubdesk.sortDesc') : t('clubdesk.sortAsc')}
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
          itemCount={priceListSelectedCount}
          itemLabel="clubdesk"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          {sortedPriceLists.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm || activeFilters.length > 0
                  ? t('clubdesk.priceList.noMatch')
                  : t('clubdesk.priceList.noYet')
              }
              createLabel={
                !searchTerm && activeFilters.length === 0 ? t('clubdesk.priceList.add') : undefined
              }
              onCreate={
                !searchTerm && activeFilters.length === 0
                  ? () => attemptNavigation(() => openPriceListPanel(null))
                  : undefined
              }
            />
          ) : isTableView ? (
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
              {sortedPriceLists.map((item, index) => {
                const itemIsSelected = isPriceListSelected(item.id);
                return (
                  <PriceListListItem
                    key={item.id}
                    priceList={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedPriceListId === String(item.id)}
                    onClick={() => handleRowActivate(item)}
                    columnCount={effectiveCardColumnCount}
                    onStatusChange={(status) => handleStatusChange(item, status)}
                    onFeaturedChange={(featured) => handleFeaturedChange(item, featured)}
                    canReorder={canReorder}
                    reorderDisabled={isSaving}
                    onMoveUp={canReorder ? () => void handleMove(index, -1) : undefined}
                    onMoveDown={canReorder ? () => void handleMove(index, 1) : undefined}
                    isFirst={index === 0}
                    isLast={index === sortedPriceLists.length - 1}
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
                              ? t('clubdesk.priceList.unselect')
                              : t('clubdesk.priceList.select')
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
                {t('clubdesk.priceList.showingCount', {
                  shown: sortedPriceLists.length,
                  total: priceLists.length,
                })}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
