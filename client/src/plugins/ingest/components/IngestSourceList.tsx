import { CheckSquare, ArrowDown, ArrowUp, Plus, Search, Trash2, XCircle } from 'lucide-react';
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
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
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
type IngestFilter = 'all' | 'active' | 'success' | 'failed';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<IngestColumnCount>(
    getInitialIngestColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<IngestListViewMode>(
    getInitialIngestListViewMode,
  );
  const [activeFilter, setActiveFilter] = useState<IngestFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(INGEST_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveIngestColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INGEST_COLUMN_COUNT_STORAGE_KEY, String(next));
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
    (count: IngestColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistIngestListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INGEST_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(INGEST_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
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

  const isTableView = listViewMode === 'table';

  const filteredAndSorted = useMemo(() => {
    const byFilter = ingest.filter((s) => {
      if (activeFilter === 'active') {
        return Boolean(s.isActive);
      }
      if (activeFilter === 'success') {
        return s.lastFetchStatus === 'success';
      }
      if (activeFilter === 'failed') {
        return s.lastFetchStatus === 'failed';
      }
      return true;
    });

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
  }, [ingest, searchTerm, primarySort, sortOrder, activeFilter]);

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
    <div className="plugin-ingest min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.ingest')}</h2>
            <p className="text-sm text-muted-foreground">{t('ingest.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openIngestPanel(null))}
          >
            {t('ingest.addSource')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label="Active"
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'active'}
            onClick={() => setActiveFilter('active')}
          />
          <ListFilterStatCard
            label="Success"
            value={stats.success}
            dotClassName="bg-amber-500"
            active={activeFilter === 'success'}
            onClick={() => setActiveFilter('success')}
          />
          <ListFilterStatCard
            label="Failed"
            value={stats.failed}
            dotClassName="bg-rose-500"
            active={activeFilter === 'failed'}
            onClick={() => setActiveFilter('failed')}
          />
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
                Select all
              </Button>
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('ingest.searchPlaceholder', { count: ingest.length })}
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
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => t(`ingest.columns${count}`)}
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
                  onClick={clearIngestSelection}
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
              {filteredAndSorted.map((source, index) => {
                const sourceIsSelected = isSelected(source.id);
                return (
                  <IngestSourceListItem
                    key={source.id}
                    source={source}
                    selected={sourceIsSelected}
                    onClick={() => handleOpenForView(source)}
                    columnCount={columnCount}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={sourceIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(String(source.id))}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={sourceIsSelected ? 'Unselect source' : 'Select source'}
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
                Showing {filteredAndSorted.length} of {ingest.length} Sources
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
