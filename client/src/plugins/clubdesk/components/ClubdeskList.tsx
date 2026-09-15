import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  FileText,
  LayoutGrid,
  Plus,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { pathToNavPage } from '@/core/routing/routeMap';
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
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
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
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
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
import { getClubdeskListStatusErrorMessage } from '../utils/clubdeskListStatusError';
import { sortCategoryNames } from '../utils/sortCategoryNames';

import { ClubdeskForm } from './ClubdeskForm';
import { ClubdeskInfoView } from './ClubdeskInfoView';
import { ClubdeskListTable } from './ClubdeskListTable';
import { ClubdeskView } from './ClubdeskView';
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
    validationErrors,
    isClubdeskPanelOpen,
    panelMode,
    currentClubdesk,
    closeClubdeskPanel,
    saveClubdesk,
    activeDomain,
  } = useClubdesk();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
  const showGuideInlinePanel = showDesktopSplit && isClubdeskPanelOpen && activeDomain === 'guides';
  const inlineGuideForm = showGuideInlinePanel && (panelMode === 'create' || panelMode === 'edit');
  const inlineGuideView = showGuideInlinePanel && panelMode === 'view' && currentClubdesk != null;
  const inlineFormRef = useRef<PanelFormHandle | null>(null);

  useMobileActions({
    onAdd: () => attemptNavigation(() => openClubdeskPanel(null)),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('clubdesk');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('clubdesk.searchPlaceholder', {
      count: clubdesk.length,
    }),
  });

  const [primarySort, setPrimarySort] = useState<ClubdeskSortField>('title');
  const [sortOrder, setSortOrder] = useState<ClubdeskSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<ClubdeskListFilterSelection>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

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

    return [...filtered].sort((a, b) => compareClubdesksByField(a, b, primarySort, sortOrder));
  }, [clubdesk, searchTerm, primarySort, sortOrder, activeFilters, categoryFilter]);

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

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearClubdeskSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: (typeof clubdesk)[0]) => {
    if (selectionMode) {
      toggleClubdeskSelected(String(item.id));
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

  const listStatusError = getClubdeskListStatusErrorMessage(validationErrors);

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const listBody = (
    <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
      <div className="hidden md:block">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="min-w-0">
              <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.clubdesk')}</h2>
                {sortedClubdesks.length > 0 ? (
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
              placeholder={t('clubdesk.searchPlaceholder', {
                count: clubdesk.length,
              })}
            />
            <ExpandableIconButton
              icon={Plus}
              label={t('clubdesk.addClubdesk')}
              variant="soft"
              alwaysExpanded
              onClick={() => attemptNavigation(() => openClubdeskPanel(null))}
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
              isFilterActive('published') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {t('clubdesk.filter.published')}{' '}
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
                <SelectItem key={option.value} value={option.value} className="rounded-md text-xs">
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
        itemCount={selectedCount}
        itemLabel="clubdesk"
        isLoading={deleting}
      />

      <div className="flex flex-col gap-3">
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
        ) : (
          <ClubdeskListTable
            clubdesks={sortedClubdesks}
            primarySort={primarySort}
            sortOrder={sortOrder}
            onSort={handleTableSort}
            isSelected={isSelected}
            onRowClick={handleRowActivate}
            onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
            onCheckboxChange={onVisibleRowCheckboxChange}
            allVisibleSelected={allVisibleSelected}
            onHeaderCheckboxChange={onToggleAllVisible}
            recentlyDuplicatedClubdeskId={recentlyDuplicatedClubdeskId}
            selectionEnabled={selectionMode}
          />
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
  );

  return (
    <div
      className={cn(
        'plugin-clubdesk flex min-h-0 flex-1 flex-col',
        PLUGIN_PAGE_LIST_SHELL_CLASS,
        showGuideInlinePanel && 'overflow-hidden',
      )}
    >
      <div
        className={cn(
          'min-h-0 min-w-0 flex-1',
          showGuideInlinePanel &&
            'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-2 overflow-hidden',
        )}
      >
        <div className={cn(showGuideInlinePanel && 'min-h-0 overflow-y-auto overscroll-contain')}>
          {listBody}
        </div>
        {showGuideInlinePanel ? (
          <aside
            className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
            role="region"
            aria-label={t('nav.clubdesk-guides')}
            aria-live="polite"
          >
            {inlineGuideForm ? (
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
                <ClubdeskForm
                  ref={inlineFormRef}
                  currentClubdesk={currentClubdesk}
                  onSave={saveClubdesk}
                  onCancel={closeClubdeskPanel}
                  stacked
                />
              </div>
            ) : inlineGuideView ? (
              <ClubdeskView clubdesk={currentClubdesk} stacked />
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
};
