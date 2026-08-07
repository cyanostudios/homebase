import { ArrowDown, ArrowUp, CheckSquare, Plus, Search, Trash2, XCircle } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { PublicationStatus } from '../types/clubdesk';
import {
  getInitialClubdeskColumnCount,
  type ClubdeskColumnCount,
} from '../utils/clubdeskColumnCount';
import {
  compareClubdesksByField,
  isClubdeskStringSortField,
  type ClubdeskSortField,
  type ClubdeskSortOrder,
} from '../utils/clubdeskListSort';
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';

import { PriceListListItem } from './PriceListListItem';
type PriceListFilter = 'all' | 'draft' | 'published';

const SORT_FIELD_OPTIONS: { value: ClubdeskSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'clubdesk.sort.updated' },
  { value: 'title', labelKey: 'clubdesk.sort.title' },
  { value: 'createdAt', labelKey: 'clubdesk.sort.created' },
  { value: 'publicationStatus', labelKey: 'clubdesk.sort.status' },
];

const COLUMN_OPTIONS: ClubdeskColumnCount[] = [1, 2, 3];

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
    validationErrors,
    reorderPriceLists,
    isSaving,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<ClubdeskSortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<ClubdeskSortOrder>('desc');
  const [columnCount, setColumnCount] = useState<ClubdeskColumnCount>(
    getInitialClubdeskColumnCount,
  );
  const [activeFilter, setActiveFilter] = useState<PriceListFilter>('all');

  const handlePrimarySortChange = (field: ClubdeskSortField) => {
    setPrimarySort(field);
    setSortOrder(isClubdeskStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortedPriceLists = useMemo(() => {
    const byFilter = priceLists.filter((item) => {
      if (activeFilter === 'draft') {
        return item.publicationStatus === 'draft';
      }
      if (activeFilter === 'published') {
        return item.publicationStatus === 'published';
      }
      return true;
    });

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.slug || '').toLowerCase().includes(q) ||
        (item.currency || '').toLowerCase().includes(q),
    );

    if (searchTerm.trim() === '' && activeFilter === 'all') {
      return [...filtered].sort((a, b) => {
        const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) {
          return ao - bo;
        }
        return (a.title || '').localeCompare(b.title || '', 'sv');
      });
    }

    return [...filtered].sort((a, b) =>
      compareClubdesksByField(
        a as unknown as Parameters<typeof compareClubdesksByField>[0],
        b as unknown as Parameters<typeof compareClubdesksByField>[0],
        primarySort,
        sortOrder,
      ),
    );
  }, [priceLists, searchTerm, primarySort, sortOrder, activeFilter]);

  const canReorder = searchTerm.trim() === '' && activeFilter === 'all';

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

  const handleStatusChange = (item: (typeof priceLists)[0], status: PublicationStatus) => {
    void updatePriceListPublicationStatus(item, status);
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
    <div className="plugin-clubdesk h-full min-h-full w-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.clubdesk')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('clubdesk.priceList.listDescription')}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openPriceListPanel(null))}
            >
              {t('clubdesk.priceList.add')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ListFilterStatCard
            label={t('clubdesk.filter.all')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label={t('clubdesk.filter.draft')}
            value={stats.draft}
            dotClassName="bg-slate-400"
            active={activeFilter === 'draft'}
            onClick={() => setActiveFilter('draft')}
          />
          <ListFilterStatCard
            label={t('clubdesk.filter.published')}
            value={stats.published}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'published'}
            onClick={() => setActiveFilter('published')}
          />
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
          <ListToolbar
            selectedCount={priceListSelectedCount}
            showSelectAll={sortedPriceLists.length > 0}
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
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('clubdesk.priceList.searchPlaceholder', {
                    count: priceLists.length,
                  })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
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
                <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                  {COLUMN_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                        columnCount === count
                          ? 'bg-background text-foreground shadow-sm hover:bg-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setColumnCount(count)}
                      aria-label={t(`clubdesk.columns${count}`)}
                      aria-pressed={columnCount === count}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearPriceListSelection}
                  type="button"
                >
                  {t('common.clearSelection')}
                </Button>
                <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {t('bulk.selected', { count: priceListSelectedCount })}
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

          {sortedPriceLists.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm || activeFilter !== 'all'
                  ? t('clubdesk.priceList.noMatch')
                  : t('clubdesk.priceList.noYet')
              }
              createLabel={
                !searchTerm && activeFilter === 'all' ? t('clubdesk.priceList.add') : undefined
              }
              onCreate={
                !searchTerm && activeFilter === 'all'
                  ? () => attemptNavigation(() => openPriceListPanel(null))
                  : undefined
              }
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
              {sortedPriceLists.map((item, index) => {
                const itemIsSelected = isPriceListSelected(item.id);
                return (
                  <PriceListListItem
                    key={item.id}
                    priceList={item}
                    selected={itemIsSelected}
                    highlighted={recentlyDuplicatedPriceListId === String(item.id)}
                    onClick={() => handleOpenForView(item)}
                    columnCount={columnCount}
                    onStatusChange={(status) => handleStatusChange(item, status)}
                    canReorder={canReorder}
                    reorderDisabled={isSaving}
                    onMoveUp={canReorder ? () => void handleMove(index, -1) : undefined}
                    onMoveDown={canReorder ? () => void handleMove(index, 1) : undefined}
                    isFirst={index === 0}
                    isLast={index === sortedPriceLists.length - 1}
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
                            ? t('clubdesk.priceList.unselect')
                            : t('clubdesk.priceList.select')
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
