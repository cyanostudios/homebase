import {
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileEdit,
  LayoutGrid,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
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
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useGuides } from '../hooks/useGuides';
import { type Guide } from '../types/guides';
import {
  getInitialGuideColumnCount,
  GUIDES_COLUMN_COUNT_STORAGE_KEY,
  type GuideColumnCount,
} from '../utils/guideColumnCount';
import {
  guideMatchesListFilters,
  toggleGuideListFilter,
  type GuideListFilter,
  type GuideListFilterSelection,
} from '../utils/guideListFilter';
import {
  compareGuidesByField,
  isGuideAscDefaultField,
  type GuideSortField,
  type GuideSortOrder,
} from '../utils/guideListSort';
import {
  getInitialGuideListViewMode,
  persistGuideListViewModeSession,
  type GuideListViewMode,
} from '../utils/guideListViewMode';

import { BulkStatusDialog } from './BulkStatusDialog';
import { GuideListItem } from './GuideListItem';
import { GuideListTable } from './GuideListTable';
import { GuideSettingsView, type GuideSettingsCategory } from './GuideSettingsView';

type SortField = GuideSortField;
type SortOrder = GuideSortOrder;

export const GuideList: React.FC = () => {
  const { t } = useTranslation();
  const {
    guides,
    openGuidePanel,
    openGuideForView,
    deleteGuides,
    selectedGuideIds,
    toggleGuideSelected,
    mergeIntoGuideSelection,
    selectAllGuides,
    clearGuideSelection,
    selectedCount,
    isSelected,
    refreshGuides,
    guidesContentView,
    openGuideSettings,
    closeGuideSettingsView,
  } = useGuides();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openGuidePanel(null)),
    onSettings: () => openGuideSettings(),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('guides.searchPlaceholder', { count: guides.length }),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('displayName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<GuideColumnCount>(() => {
    const initial = getInitialGuideColumnCount();
    return (initial === 1 || initial === 2 ? 3 : initial) as GuideColumnCount;
  });
  const [listViewMode, setListViewModeState] = useState<GuideListViewMode>(
    getInitialGuideListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<GuideListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<GuideSettingsCategory>('production');

  const setColumnCount = useCallback((_count: GuideColumnCount) => {
    const next = 3 as GuideColumnCount;
    setColumnCountState(next);
    setListViewModeState('cards');
    persistGuideListViewModeSession('cards');
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(GUIDES_COLUMN_COUNT_STORAGE_KEY, String(next));
    }
  }, []);

  const setListViewMode = useCallback((mode: GuideListViewMode) => {
    setListViewModeState(mode);
    persistGuideListViewModeSession(mode);
  }, []);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isGuideAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isGuideAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const sortFieldOptions = useMemo(
    (): { value: SortField; label: string }[] => [
      { value: 'displayName', label: t('guides.colName') },
      { value: 'id', label: t('guides.colId') },
      { value: 'updatedAt', label: t('guides.colUpdated') },
      { value: 'createdAt', label: t('guides.colCreated') },
      { value: 'lifecycleStatus', label: t('guides.colStatus') },
      { value: 'languages', label: t('guides.colLanguages') },
    ],
    [t],
  );

  const selectedGuides = useMemo(() => {
    const idSet = new Set(selectedGuideIds.map(String));
    return guides.filter((guide) => idSet.has(String(guide.id)));
  }, [guides, selectedGuideIds]);

  const stats = useMemo(() => {
    let draft = 0;
    let active = 0;
    let audioReady = 0;
    for (const guide of guides) {
      if (guide.lifecycleStatus === 'draft') draft += 1;
      else if (guide.lifecycleStatus === 'active') active += 1;
      if (guide.hasReadyAudio) audioReady += 1;
    }
    return { total: guides.length, draft, active, audioReady };
  }, [guides]);

  const filteredAndSorted = useMemo(() => {
    const byFilter = guides.filter((guide) => guideMatchesListFilters(guide, activeFilters));

    const needle = searchTerm.trim().toLowerCase();
    const filtered = needle
      ? byFilter.filter((guide) => {
          return (
            guide.displayName.toLowerCase().includes(needle) ||
            String(guide.id).toLowerCase().includes(needle) ||
            (guide.geographicReference ?? '').toLowerCase().includes(needle)
          );
        })
      : byFilter;

    return [...filtered].sort((a, b) => compareGuidesByField(a, b, primarySort, sortOrder));
  }, [guides, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: GuideListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: GuideListFilter) => {
    setActiveFilters((prev) => toggleGuideListFilter(prev, filter));
  };

  const visibleGuideIds = useMemo(
    () => filteredAndSorted.map((guide) => String(guide.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleGuideIds,
      mergeIntoSelection: mergeIntoGuideSelection,
      toggleOne: toggleGuideSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleGuideIds.length > 0 && visibleGuideIds.every((id) => isSelected(id)),
    [visibleGuideIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleGuideIds);
      const remaining = selectedGuideIds.filter((id) => !set.has(id));
      selectAllGuides(remaining);
    } else {
      const union = Array.from(new Set([...selectedGuideIds, ...visibleGuideIds]));
      selectAllGuides(union);
    }
  }, [allVisibleSelected, visibleGuideIds, selectedGuideIds, selectAllGuides]);

  const handleOpenForView = (guide: Guide) => {
    attemptNavigation(() => openGuideForView(guide));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearGuideSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (guide: Guide) => {
    if (selectionMode) {
      toggleGuideSelected(String(guide.id));
      return;
    }
    handleOpenForView(guide);
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'status',
        label: t('guides.bulkStatusAction'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkStatusDialog(true),
      },
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

  const handleBulkDelete = async () => {
    if (selectedGuideIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteGuides(selectedGuideIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (guidesContentView === 'settings') {
    return (
      <div className="plugin-guides min-h-full bg-background">
        <div className="px-6 py-4">
          <GuideSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeGuideSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-guides', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('guides.title')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={() => openGuideSettings()}
                  />
                  {filteredAndSorted.length > 0 ? (
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
                placeholder={t('guides.searchPlaceholder', { count: guides.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`guides.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('guides.addPlace')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openGuidePanel(null))}
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
                {t('guides.stats.total')}{' '}
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
              <FileEdit className="h-3.5 w-3.5" />
              <span>
                {t('guides.stats.draft')}{' '}
                <span className="tabular-nums font-semibold">({stats.draft})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('active')}
              className={cn(
                isFilterActive('active') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('guides.stats.active')}{' '}
                <span className="tabular-nums font-semibold">({stats.active})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('audioReady')}
              className={cn(
                isFilterActive('audioReady')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>
                {t('guides.stats.audioReady')}{' '}
                <span className="tabular-nums font-semibold">({stats.audioReady})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as SortField)}
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
                {sortFieldOptions.map((option) => (
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
        </div>

        <BulkStatusDialog
          isOpen={showBulkStatusDialog}
          onClose={() => setShowBulkStatusDialog(false)}
          selectedGuides={selectedGuides}
          onSuccess={async () => {
            await refreshGuides();
            clearGuideSelection();
          }}
        />
        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="places"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm || activeFilters.length > 0 ? t('guides.noMatch') : t('guides.noYet')
              }
              createLabel={
                !searchTerm && activeFilters.length === 0 ? t('guides.addPlace') : undefined
              }
              onCreate={
                !searchTerm && activeFilters.length === 0
                  ? () => attemptNavigation(() => openGuidePanel(null))
                  : undefined
              }
            />
          ) : isTableView ? (
            <GuideListTable
              guides={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={(id) => isSelected(id)}
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={onToggleAllVisible}
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
              {filteredAndSorted.map((guide, index) => {
                const guideIsSelected = isSelected(guide.id);
                return (
                  <GuideListItem
                    key={guide.id}
                    guide={guide}
                    selected={guideIsSelected}
                    columnCount={effectiveCardColumnCount}
                    onClick={() => handleRowActivate(guide)}
                    checkbox={
                      selectionMode ? (
                        <input
                          type="checkbox"
                          checked={guideIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(guide.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={
                            guideIsSelected ? t('guides.unselectPlace') : t('guides.selectPlace')
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
            meta={t('guides.showingCount', {
              shown: filteredAndSorted.length,
              total: guides.length,
            })}
          />
        </div>
      </div>
    </div>
  );
};
