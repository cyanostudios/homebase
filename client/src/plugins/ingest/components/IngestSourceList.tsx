import {
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Plus,
  Power,
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

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';
import {
  getInitialIngestColumnCount,
  INGEST_COLUMN_COUNT_STORAGE_KEY,
  INGEST_SETTINGS_KEY,
  resolveIngestColumnCount,
  type IngestColumnCount,
} from '../utils/ingestColumnCount';
import {
  ingestMatchesListFilters,
  toggleIngestListFilter,
  type IngestListFilter,
  type IngestListFilterSelection,
} from '../utils/ingestListFilter';
import {
  compareIngestByField,
  isIngestAscDefaultField,
  type IngestSortField,
  type IngestSortOrder,
} from '../utils/ingestListSort';
import {
  getInitialIngestListViewMode,
  persistIngestListViewModeSession,
  resolveIngestListViewMode,
  type IngestListViewMode,
} from '../utils/ingestListViewMode';

import { IngestSourceListItem } from './IngestSourceListItem';
import { IngestSourceListTable } from './IngestSourceListTable';

type SortField = IngestSortField;
type SortOrder = IngestSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'sourceType', label: 'Type' },
  { value: 'isActive', label: 'Active' },
  { value: 'lastFetchStatus', label: 'Status' },
  { value: 'lastFetchedAt', label: 'Last Fetched' },
];

export const IngestSourceList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openIngestPanel(null)),
  });

  const {
    ingest,
    openIngestPanel,
    openIngestForView,
    validationErrors,
    selectedIngestIds,
    toggleIngestSelected,
    mergeIntoIngestSelection,
    selectAllIngest,
    clearIngestSelection,
    selectedCount,
    isSelected,
    deleteIngestSources,
  } = useIngest();

  const { searchTerm, setSearchTerm } = usePersistedListSearch('ingest');
  const [selectionMode, setSelectionMode] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('ingest.searchPlaceholder', { count: ingest.length }),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<IngestColumnCount>(
    getInitialIngestColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<IngestListViewMode>(
    getInitialIngestListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<IngestListFilterSelection>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(INGEST_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveIngestColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as IngestColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INGEST_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(INGEST_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveIngestListViewMode(settings);
        setListViewModeState(nextView);
        persistIngestListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: IngestColumnCount) => {
      const next = 3 as IngestColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistIngestListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INGEST_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(INGEST_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: IngestListViewMode) => {
      setListViewModeState(mode);
      persistIngestListViewModeSession(mode);
      updateSettings(INGEST_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isIngestAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isIngestAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const filteredAndSorted = useMemo(() => {
    const byFilter = ingest.filter((s) => ingestMatchesListFilters(s, activeFilters));

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((s) => {
      if (!needle) {
        return true;
      }
      return (
        s.name.toLowerCase().includes(needle) ||
        s.sourceUrl.toLowerCase().includes(needle) ||
        s.sourceType.toLowerCase().includes(needle) ||
        s.lastFetchStatus.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => compareIngestByField(a, b, primarySort, sortOrder));
  }, [ingest, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: IngestListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: IngestListFilter) => {
    setActiveFilters((prev) => toggleIngestListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: ingest.length,
      active: ingest.filter((s) => Boolean(s.isActive)).length,
      success: ingest.filter((s) => s.lastFetchStatus === 'success').length,
      failed: ingest.filter((s) => s.lastFetchStatus === 'failed').length,
    }),
    [ingest],
  );

  const visibleSourceIds = useMemo(
    () => filteredAndSorted.map((s) => String(s.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleSourceIds,
      mergeIntoSelection: mergeIntoIngestSelection,
      toggleOne: (id) => toggleIngestSelected(String(id)),
    });

  const allVisibleSelected = useMemo(
    () => visibleSourceIds.length > 0 && visibleSourceIds.every((id) => isSelected(id)),
    [visibleSourceIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearIngestSelection();
    } else {
      const union = Array.from(new Set([...selectedIngestIds, ...visibleSourceIds]));
      selectAllIngest(union);
    }
  };

  const handleOpenForView = (row: IngestSource) => attemptNavigation(() => openIngestForView(row));

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearIngestSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (row: IngestSource) => {
    if (selectionMode) {
      toggleIngestSelected(String(row.id));
      return;
    }
    handleOpenForView(row);
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

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteIngestSources(selectedIngestIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteIngestSources, selectedIngestIds]);

  const generalError = validationErrors.find((e) => e.field === 'general');

  return (
    <div className={cn('plugin-ingest', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.ingest')}</h2>
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
                placeholder={t('ingest.searchPlaceholder', { count: ingest.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`ingest.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('ingest.addSource')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openIngestPanel(null))}
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
                Total <span className="tabular-nums font-semibold">({stats.total})</span>
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
              <Power className="h-3.5 w-3.5" />
              <span>
                Active <span className="tabular-nums font-semibold">({stats.active})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('success')}
              className={cn(
                isFilterActive('success') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Success <span className="tabular-nums font-semibold">({stats.success})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('failed')}
              className={cn(
                isFilterActive('failed') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>
                Failed <span className="tabular-nums font-semibold">({stats.failed})</span>
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
        </div>

        {generalError ? (
          <p className="text-sm text-destructive" role="alert">
            {generalError.message}
          </p>
        ) : null}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="ingest sources"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm.trim() ? t('ingest.noMatch') : t('ingest.noYet')}
              createLabel={!searchTerm.trim() ? t('ingest.addSource') : undefined}
              onCreate={
                !searchTerm.trim()
                  ? () => attemptNavigation(() => openIngestPanel(null))
                  : undefined
              }
            />
          ) : isTableView ? (
            <IngestSourceListTable
              sources={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={(id) => isSelected(id)}
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
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
              {filteredAndSorted.map((source, index) => {
                const sourceIsSelected = isSelected(source.id);
                return (
                  <IngestSourceListItem
                    key={source.id}
                    source={source}
                    selected={sourceIsSelected}
                    onClick={() => handleRowActivate(source)}
                    columnCount={effectiveCardColumnCount}
                    checkbox={
                      selectionMode ? (
                        <input
                          type="checkbox"
                          checked={sourceIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(String(source.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={sourceIsSelected ? 'Unselect source' : 'Select source'}
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
                Showing {filteredAndSorted.length} of {ingest.length} Sources
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
