import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
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
  compareEstimatesByField,
  isEstimateStringSortField,
  type EstimateSortField,
  type EstimateSortOrder,
} from '../utils/estimateListSort';

import { EstimateListItem } from './EstimateListItem';
import { EstimateSettingsView } from './EstimateSettingsView';

type SortField = EstimateSortField;
type SortOrder = EstimateSortOrder;
type EstimateFilter = 'all' | 'draft' | 'sent' | 'accepted';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'contactName', label: 'Contact' },
  { value: 'estimateNumber', label: 'Estimate #' },
  { value: 'status', label: 'Status' },
  { value: 'total', label: 'Total' },
  { value: 'validTo', label: 'Valid To' },
];

const COLUMN_OPTIONS: EstimateColumnCount[] = [1, 2, 3];

export function EstimateList() {
  const { t } = useTranslation();
  const {
    estimates,
    estimatesContentView,
    openEstimateSettings,
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
  } = useEstimates();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<EstimateColumnCount>(
    getInitialEstimateColumnCount,
  );
  const [activeFilter, setActiveFilter] = useState<EstimateFilter>('all');

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveEstimateColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: EstimateColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(ESTIMATES_SETTINGS_KEY, { columnCount: count }).catch(() => {});
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

  const sortedEstimates = useMemo(() => {
    const byFilter = estimates.filter((estimate) => {
      if (activeFilter === 'draft') {
        return estimate.status === 'draft';
      }
      if (activeFilter === 'accepted') {
        return estimate.status === 'accepted';
      }
      if (activeFilter === 'sent') {
        return estimate.status === 'sent';
      }
      return true;
    });

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (estimate) =>
        estimate.estimateNumber.toLowerCase().includes(q) ||
        estimate.contactName.toLowerCase().includes(q) ||
        estimate.notes.toLowerCase().includes(q) ||
        estimate.status.toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareEstimatesByField(a, b, primarySort, sortOrder));
  }, [estimates, searchTerm, primarySort, sortOrder, activeFilter]);

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
    return <EstimateSettingsView />;
  }

  return (
    <div className="plugin-estimates min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.estimates')}</h2>
            <p className="text-sm text-muted-foreground">{t('estimates.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => openEstimateSettings()}
              className="h-9 px-2.5 text-xs"
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openEstimatePanel(null))}
            >
              {t('estimates.addEstimate')}
            </Button>
          </div>
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
            label="Draft"
            value={stats.draft}
            dotClassName="bg-slate-500"
            active={activeFilter === 'draft'}
            onClick={() => setActiveFilter('draft')}
          />
          <ListFilterStatCard
            label="Sent"
            value={stats.sent}
            dotClassName="bg-amber-500"
            active={activeFilter === 'sent'}
            onClick={() => setActiveFilter('sent')}
          />
          <ListFilterStatCard
            label="Accepted"
            value={stats.accepted}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'accepted'}
            onClick={() => setActiveFilter('accepted')}
          />
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
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedEstimates.length > 0}
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
                  placeholder={t('estimates.searchPlaceholder')}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
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
                      aria-label={t(`estimates.columns${count}`)}
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
                  onClick={clearEstimateSelection}
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
                  icon={FileSpreadsheet}
                  onClick={handleExportCSV}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FileText}
                  onClick={handleExportPDF}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  Export PDF
                </Button>
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

          {sortedEstimates.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950">
              {searchTerm ? t('estimates.noMatch') : t('estimates.noYet')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
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
                    columnCount={columnCount}
                    onClick={() => handleOpenForView(estimate)}
                    onStatusChange={(status) => handleListStatusChange(estimate, status)}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={estimateIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(estimate.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
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
                Showing {sortedEstimates.length} of {estimates.length} Estimates
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
