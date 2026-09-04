import {
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileEdit,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Plus,
  Send,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';
import {
  getInitialEstimateColumnCount,
  resolveEstimateColumnCount,
  ESTIMATES_COLUMN_COUNT_STORAGE_KEY,
  ESTIMATES_SETTINGS_KEY,
  type EstimateColumnCount,
} from '../utils/estimateColumnCount';
import {
  estimateMatchesListFilters,
  toggleEstimateListFilter,
  type EstimateListFilter,
  type EstimateListFilterSelection,
} from '../utils/estimateListFilter';
import {
  compareEstimatesByField,
  isEstimateStringSortField,
  type EstimateSortField,
  type EstimateSortOrder,
} from '../utils/estimateListSort';
import {
  getInitialEstimateListViewMode,
  persistEstimateListViewModeSession,
  resolveEstimateListViewMode,
  type EstimateListViewMode,
} from '../utils/estimateListViewMode';
import {
  resolveVisibleEstimateTableColumns,
  type EstimateTableColumnId,
} from '../utils/estimateTableColumns';

import { EstimateListItem } from './EstimateListItem';
import { EstimateListTable } from './EstimateListTable';
import { EstimateSettingsView, type EstimateSettingsCategory } from './EstimateSettingsView';

type SortField = EstimateSortField;
type SortOrder = EstimateSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'contactName', label: 'Contact' },
  { value: 'estimateNumber', label: 'Estimate #' },
  { value: 'status', label: 'Status' },
  { value: 'total', label: 'Total' },
  { value: 'validTo', label: 'Valid To' },
];

export function EstimateList() {
  const { t } = useTranslation();
  const {
    estimates,
    openEstimatePanel,
    openEstimateForView,
    deleteEstimates,
    selectedEstimateIds,
    toggleEstimateSelected,
    mergeIntoEstimateSelection,
    selectAllEstimates,
    clearEstimateSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedEstimateId,
    saveEstimate,
    estimatesContentView,
    openEstimateSettings,
    closeEstimateSettingsView,
  } = useEstimates();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openEstimatePanel(null)),
    onSettings: openEstimateSettings,
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('estimates');
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('estimates.searchPlaceholder'),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<EstimateColumnCount>(
    getInitialEstimateColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<EstimateListViewMode>(
    getInitialEstimateListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<EstimateTableColumnId[]>(() =>
    resolveVisibleEstimateTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<EstimateListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<EstimateSettingsCategory>('columns');

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveEstimateColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as EstimateColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(ESTIMATES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveEstimateListViewMode(settings);
        setListViewModeState(nextView);
        persistEstimateListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleEstimateTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: EstimateColumnCount) => {
      const next = 3 as EstimateColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistEstimateListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(ESTIMATES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: EstimateListViewMode) => {
      setListViewModeState(mode);
      persistEstimateListViewModeSession(mode);
      updateSettings(ESTIMATES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isEstimateStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isEstimateStringSortField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const sortedEstimates = useMemo(() => {
    const byFilter = estimates.filter((estimate) =>
      estimateMatchesListFilters(estimate, activeFilters),
    );

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (estimate) =>
        estimate.estimateNumber.toLowerCase().includes(q) ||
        estimate.contactName.toLowerCase().includes(q) ||
        estimate.notes.toLowerCase().includes(q) ||
        estimate.status.toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareEstimatesByField(a, b, primarySort, sortOrder));
  }, [estimates, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: EstimateListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: EstimateListFilter) => {
    setActiveFilters((prev) => toggleEstimateListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: estimates.length,
      draft: estimates.filter((e) => e.status === 'draft').length,
      sent: estimates.filter((e) => e.status === 'sent').length,
      accepted: estimates.filter((e) => e.status === 'accepted').length,
    }),
    [estimates],
  );

  const visibleEstimateIds = useMemo(
    () => sortedEstimates.map((estimate) => String(estimate.id)),
    [sortedEstimates],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleEstimateIds,
      mergeIntoSelection: mergeIntoEstimateSelection,
      toggleOne: toggleEstimateSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleEstimateIds.length > 0 && visibleEstimateIds.every((id) => isSelected(id)),
    [visibleEstimateIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearEstimateSelection();
    } else {
      selectAllEstimates(visibleEstimateIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEstimateIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteEstimates(selectedEstimateIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedEstimateIds.length === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const csvHeaders = [
      'estimateNumber',
      'contactName',
      'organizationNumber',
      'currency',
      'total',
      'status',
      'validTo',
      'createdAt',
      'updatedAt',
    ];
    const csvData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      organizationNumber: est.organizationNumber ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo: est.validTo instanceof Date ? est.validTo.toISOString() : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date ? est.createdAt.toISOString() : String(est.createdAt ?? ''),
      updatedAt:
        est.updatedAt instanceof Date ? est.updatedAt.toISOString() : String(est.updatedAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedEstimateIds.length === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const pdfHeaders = [
      { key: 'estimateNumber', label: 'Estimate #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'validTo', label: 'Valid To' },
      { key: 'createdAt', label: 'Created' },
    ];
    const pdfData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo:
        est.validTo instanceof Date
          ? est.validTo.toLocaleDateString('sv-SE')
          : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date
          ? est.createdAt.toLocaleDateString('sv-SE')
          : String(est.createdAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Estimates Export');
  };

  const handleOpenForView = (estimate: Estimate) => {
    attemptNavigation(() => {
      openEstimateForView(estimate);
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearEstimateSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (estimate: Estimate) => {
    if (selectionMode) {
      toggleEstimateSelected(String(estimate.id));
      return;
    }
    handleOpenForView(estimate);
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'csv',
        label: 'Export CSV',
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: 'Export PDF',
        icon: FileText,
        disabled,
        onClick: () => {
          void handleExportPDF();
        },
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
  }, [selectedCount, t, handleExportCSV, handleExportPDF]);

  const handleListStatusChange = useCallback(
    async (estimate: Estimate, newStatus: string) => {
      if (estimate.status === newStatus) {
        return;
      }
      await saveEstimate({ status: newStatus }, estimate.id);
    },
    [saveEstimate],
  );

  if (estimatesContentView === 'settings') {
    return (
      <div className="plugin-estimates min-h-full bg-background">
        <div className="px-6 py-4">
          <EstimateSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeEstimateSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-estimates', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.estimates')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={openEstimateSettings}
                  />
                  {sortedEstimates.length > 0 ? (
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
                placeholder={t('estimates.searchPlaceholder')}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`estimates.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('estimates.addEstimate')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openEstimatePanel(null))}
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
              onClick={() => toggleFilter('draft')}
              className={cn(
                isFilterActive('draft') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <FileEdit className="h-3.5 w-3.5" />
              <span>
                Draft <span className="tabular-nums font-semibold">({stats.draft})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('sent')}
              className={cn(
                isFilterActive('sent') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Send className="h-3.5 w-3.5" />
              <span>
                Sent <span className="tabular-nums font-semibold">({stats.sent})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('accepted')}
              className={cn(
                isFilterActive('accepted') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Accepted <span className="tabular-nums font-semibold">({stats.accepted})</span>
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

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="estimates"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          {sortedEstimates.length === 0 ? (
            <ListEmptyState
              message={searchTerm ? t('estimates.noMatch') : t('estimates.noYet')}
              createLabel={!searchTerm ? t('estimates.addEstimate') : undefined}
              onCreate={
                !searchTerm ? () => attemptNavigation(() => openEstimatePanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <EstimateListTable
              estimates={sortedEstimates}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={isSelected}
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              recentlyDuplicatedEstimateId={recentlyDuplicatedEstimateId}
              selectionEnabled={selectionMode}
              visibleColumnIds={visibleColumnIds}
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
              {sortedEstimates.map((estimate, index) => {
                const estimateIsSelected = isSelected(estimate.id);
                return (
                  <EstimateListItem
                    key={estimate.id}
                    estimate={estimate}
                    selected={estimateIsSelected}
                    highlighted={recentlyDuplicatedEstimateId === String(estimate.id)}
                    columnCount={effectiveCardColumnCount}
                    onClick={() => handleRowActivate(estimate)}
                    onStatusChange={(status) => handleListStatusChange(estimate, status)}
                    checkbox={
                      selectionMode ? (
                        <input
                          type="checkbox"
                          checked={estimateIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(estimate.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
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
                Showing {sortedEstimates.length} of {estimates.length} Estimates
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
